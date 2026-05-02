import "dotenv/config";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  addNotification,
  addTransaction,
  adjustWallet,
  createId,
  currentTime,
  ensureDb,
  getDueDate,
  getReferralChain,
  publicDb,
  sanitizeUser,
  withDb
} from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 5000);
const jwtSecret = process.env.JWT_SECRET || "dev-change-me";
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, "uploads");

await mkdir(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^\w.-]/g, "_")}`)
});
const upload = multer({ storage });

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(uploadDir));

function tokenFor(user) {
  return jwt.sign({ id: user.id, role: user.role }, jwtSecret, { expiresIn: "7d" });
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Login required" });
  try {
    req.auth = jwt.verify(token, jwtSecret);
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

function requireAdmin(req, res, next) {
  if (req.auth?.role !== "admin") return res.status(403).json({ error: "Admin access required" });
  return next();
}

async function getAuthUser(req) {
  const db = await ensureDb();
  return db.users.find((user) => user.id === req.auth.id);
}

function activePackageInstances(db, userId) {
  const today = Date.now();
  return db.userPackages.filter(
    (item) => item.userId === userId && item.status === "active" && new Date(item.endDate).getTime() >= today
  );
}

function dailyTaskLimit(db, userId) {
  const active = activePackageInstances(db, userId);
  if (!active.length) return 0;
  return active.reduce((total, item) => {
    const pkg = db.packages.find((packageItem) => packageItem.id === item.packageId);
    return total + Number(pkg?.dailyTasks || 0);
  }, 0);
}

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
}

function taskStatus(db, userId, taskId) {
  const submission = db.taskSubmissions.find(
    (item) => item.userId === userId && item.taskId === taskId && item.dayKey === todayKey()
  );
  return submission?.status || "available";
}

function userSummary(db, user) {
  const activePackages = activePackageInstances(db, user.id);
  const activePackageDetails = activePackages.map((instance) => ({
    ...instance,
    package: db.packages.find((item) => item.id === instance.packageId)
  }));
  const day = todayKey();
  const todaysSubmissions = db.taskSubmissions.filter((item) => item.userId === user.id && item.dayKey === day);
  const completedToday = todaysSubmissions.filter((item) => item.status === "approved").length;
  const taskLimit = dailyTaskLimit(db, user.id);
  const referrals = db.users.filter((item) => item.referredBy === user.referralCode);
  const totalEarnings = db.transactions
    .filter((item) => item.userId === user.id && item.status === "completed" && item.amount > 0)
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const rank = [...db.users]
    .sort((a, b) => b.wallets.main + b.wallets.referral - (a.wallets.main + a.wallets.referral))
    .findIndex((item) => item.id === user.id) + 1;

  return {
    user: sanitizeUser(user),
    activePackages: activePackageDetails,
    tasksToday: { completed: completedToday, limit: taskLimit },
    referrals: referrals.map(sanitizeUser),
    totalEarnings,
    rank
  };
}

function calculateWithdrawalFee(settings, method, amount) {
  const fee = settings.withdrawalFees[method] || { percent: 0, minimum: 0 };
  const percentFee = (Number(amount) * Number(fee.percent || 0)) / 100;
  return Math.max(percentFee + Number(fee.fixed || 0), Number(fee.minimum || 0));
}

app.get("/api/health", async (_req, res) => {
  const db = await ensureDb();
  res.json({ ok: true, app: db.settings.appName, time: currentTime() });
});

app.post("/api/auth/register", async (req, res) => {
  const { fullName, email, phone, password, referralCode, cnic } = req.body;
  if (!fullName || !email || !phone || !password) {
    return res.status(400).json({ error: "Full name, email, phone, and password are required" });
  }

  const result = await withDb(async (db) => {
    if (!db.settings.registrationEnabled) throw new Error("Registration is disabled");
    const normalizedEmail = normalizeEmail(email);
    if (db.users.some((user) => normalizeEmail(user.email) === normalizedEmail || user.phone === phone)) {
      throw new Error("Email or phone already registered");
    }
    const cleanReferral = String(referralCode || "").trim().toUpperCase();
    const validReferrer = cleanReferral ? db.users.find((user) => user.referralCode === cleanReferral) : null;
    const user = {
      id: createId("user"),
      fullName: String(fullName).trim(),
      email: normalizedEmail,
      phone: String(phone).trim(),
      cnic: String(cnic || "").trim(),
      passwordHash: await bcrypt.hash(password, 10),
      role: "user",
      status: "active",
      verified: !db.settings.verificationRequired,
      referralCode: `EP${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      referredBy: validReferrer?.referralCode || "",
      wallets: { main: 0, locked: 0, bonus: Number(db.settings.welcomeBonus || 0), referral: 0 },
      level: "Bronze",
      streak: 0,
      badges: ["New Member"],
      createdAt: currentTime(),
      lastLoginAt: currentTime()
    };
    db.users.push(user);
    if (user.wallets.bonus > 0) {
      addTransaction(db, user.id, "bonus", "bonus", user.wallets.bonus, "Welcome bonus");
    }
    addNotification(db, user.id, "Account created", "Signup completed without OTP for development mode.");
    return { user: sanitizeUser(user), token: tokenFor(user) };
  }).catch((error) => ({ error: error.message }));

  if (result.error) return res.status(400).json(result);
  return res.json(result);
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const db = await ensureDb();
  const user = db.users.find((item) => normalizeEmail(item.email) === normalizeEmail(email));
  if (!user || !(await bcrypt.compare(String(password || ""), user.passwordHash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  if (user.status !== "active") return res.status(403).json({ error: "Account is not active" });
  await withDb(async (mutableDb) => {
    const mutableUser = mutableDb.users.find((item) => item.id === user.id);
    mutableUser.lastLoginAt = currentTime();
  });
  return res.json({ user: sanitizeUser(user), token: tokenFor(user) });
});

app.get("/api/me", requireAuth, async (req, res) => {
  const user = await getAuthUser(req);
  if (!user) return res.status(404).json({ error: "User not found" });
  const db = await ensureDb();
  return res.json(userSummary(db, user));
});

app.get("/api/public", async (_req, res) => {
  const db = await ensureDb();
  const leaderboard = [...db.users]
    .filter((user) => user.role === "user")
    .map((user) => ({
      id: user.id,
      fullName: user.fullName,
      level: user.level,
      earnings: user.wallets.main + user.wallets.referral + user.wallets.bonus
    }))
    .sort((a, b) => b.earnings - a.earnings)
    .slice(0, 10);
  res.json({
    packages: db.packages.filter((item) => item.active),
    tasks: db.tasks.filter((item) => item.active),
    ads: db.ads.filter((item) => item.active),
    settings: db.settings,
    leaderboard
  });
});

app.get("/api/tasks", requireAuth, async (req, res) => {
  const db = await ensureDb();
  const limit = dailyTaskLimit(db, req.auth.id);
  const tasks = db.tasks
    .filter((task) => task.active)
    .slice(0, limit || 3)
    .map((task) => ({ ...task, status: taskStatus(db, req.auth.id, task.id) }));
  return res.json({ tasks, limit, dayKey: todayKey() });
});

app.post("/api/tasks/:taskId/submit", requireAuth, upload.single("proof"), async (req, res) => {
  const result = await withDb(async (db) => {
    const task = db.tasks.find((item) => item.id === req.params.taskId && item.active);
    if (!task) throw new Error("Task not found");
    const existing = db.taskSubmissions.find(
      (item) => item.userId === req.auth.id && item.taskId === task.id && item.dayKey === todayKey()
    );
    if (existing && existing.status !== "rejected") throw new Error("Task already submitted today");
    const status = task.verification === "timer" ? "approved" : "pending";
    const submission = {
      id: createId("sub"),
      userId: req.auth.id,
      taskId: task.id,
      status,
      proofUrl: req.file ? `/uploads/${req.file.filename}` : "",
      note: req.body.note || "",
      dayKey: todayKey(),
      reward: task.reward,
      createdAt: currentTime(),
      reviewedAt: status === "approved" ? currentTime() : ""
    };
    db.taskSubmissions.unshift(submission);
    if (status === "approved") {
      adjustWallet(db, req.auth.id, "main", task.reward, "task_reward", `Task approved: ${task.title}`);
      addNotification(db, req.auth.id, "Task reward credited", `${task.title} earned PKR ${task.reward}.`);
      getReferralChain(db, db.users.find((user) => user.id === req.auth.id)?.referredBy).forEach(({ level, user }) => {
        const rate = db.settings.referral.levels.find((item) => item.level === level)?.earningPercent || 0;
        const commission = (Number(task.reward) * rate) / 100;
        if (commission > 0) adjustWallet(db, user.id, "referral", commission, "referral_daily", `L${level} task commission`);
      });
    }
    return submission;
  }).catch((error) => ({ error: error.message }));
  if (result.error) return res.status(400).json(result);
  return res.json(result);
});

app.post("/api/packages/:packageId/buy", requireAuth, async (req, res) => {
  const result = await withDb(async (db) => {
    const pkg = db.packages.find((item) => item.id === req.params.packageId && item.active);
    const user = db.users.find((item) => item.id === req.auth.id);
    if (!pkg || !user) throw new Error("Package not found");
    const useBonus = Boolean(req.body.useBonus);
    const spendWallet = useBonus && user.wallets.bonus >= pkg.investment ? "bonus" : "main";
    if (user.wallets[spendWallet] < pkg.investment) {
      throw new Error("Insufficient balance. Submit a deposit first or use bonus wallet if available.");
    }
    user.wallets[spendWallet] -= pkg.investment;
    user.wallets.locked += pkg.investment;
    const instance = {
      id: createId("up"),
      userId: user.id,
      packageId: pkg.id,
      status: "active",
      investment: pkg.investment,
      dailyReturnAmount: (pkg.investment * pkg.dailyReturnPercent) / 100,
      startDate: currentTime(),
      endDate: getDueDate(pkg.durationDays),
      autoRenew: Boolean(req.body.autoRenew)
    };
    db.userPackages.unshift(instance);
    addTransaction(db, user.id, "package_purchase", spendWallet, -pkg.investment, `Purchased ${pkg.name}`);
    addNotification(db, user.id, "Package activated", `${pkg.name} package is active.`);
    getReferralChain(db, user.referredBy).forEach(({ level, user: referrer }) => {
      const rate = db.settings.referral.levels.find((item) => item.level === level)?.depositPercent || 0;
      const commission = (pkg.investment * rate) / 100;
      if (commission > 0) adjustWallet(db, referrer.id, "referral", commission, "referral_deposit", `L${level} ${pkg.name} commission`);
    });
    return instance;
  }).catch((error) => ({ error: error.message }));
  if (result.error) return res.status(400).json(result);
  return res.json(result);
});

app.post("/api/deposits", requireAuth, upload.single("proof"), async (req, res) => {
  const amount = Number(req.body.amount);
  const method = String(req.body.method || "JazzCash");
  if (!amount || amount < 1) return res.status(400).json({ error: "Valid amount is required" });
  const result = await withDb(async (db) => {
    const deposit = {
      id: createId("dep"),
      userId: req.auth.id,
      amount,
      method,
      transactionId: req.body.transactionId || "",
      proofUrl: req.file ? `/uploads/${req.file.filename}` : "",
      status: "pending",
      note: req.body.note || "",
      createdAt: currentTime(),
      reviewedAt: ""
    };
    db.deposits.unshift(deposit);
    addNotification(db, req.auth.id, "Deposit submitted", "Admin will review your payment proof.");
    return deposit;
  });
  return res.json(result);
});

app.post("/api/withdrawals", requireAuth, async (req, res) => {
  const amount = Number(req.body.amount);
  const method = String(req.body.method || "JazzCash");
  const accountTitle = String(req.body.accountTitle || "").trim();
  const accountNumber = String(req.body.accountNumber || "").trim();
  if (!amount || !accountTitle || !accountNumber) return res.status(400).json({ error: "Amount and account details are required" });
  const result = await withDb(async (db) => {
    const user = db.users.find((item) => item.id === req.auth.id);
    if (amount < db.settings.minWithdrawal) throw new Error(`Minimum withdrawal is ${db.settings.minWithdrawal}`);
    if (user.wallets.main + user.wallets.referral < amount) throw new Error("Insufficient withdrawable balance");
    const fee = calculateWithdrawalFee(db.settings, method, amount);
    const withdrawal = {
      id: createId("wd"),
      userId: user.id,
      amount,
      fee,
      netAmount: amount - fee,
      method,
      accountTitle,
      accountNumber,
      status: "pending",
      note: "",
      createdAt: currentTime(),
      reviewedAt: ""
    };
    let remaining = amount;
    const mainDeduction = Math.min(user.wallets.main, remaining);
    user.wallets.main -= mainDeduction;
    remaining -= mainDeduction;
    if (remaining > 0) user.wallets.referral -= remaining;
    db.withdrawals.unshift(withdrawal);
    addTransaction(db, user.id, "withdrawal_request", "main", -amount, `Withdrawal requested via ${method}`, "pending");
    addNotification(db, user.id, "Withdrawal requested", `Request for PKR ${amount} is pending admin approval.`);
    return withdrawal;
  }).catch((error) => ({ error: error.message }));
  if (result.error) return res.status(400).json(result);
  return res.json(result);
});

app.get("/api/history", requireAuth, async (req, res) => {
  const db = await ensureDb();
  res.json({
    transactions: db.transactions.filter((item) => item.userId === req.auth.id).slice(0, 100),
    deposits: db.deposits.filter((item) => item.userId === req.auth.id),
    withdrawals: db.withdrawals.filter((item) => item.userId === req.auth.id),
    submissions: db.taskSubmissions.filter((item) => item.userId === req.auth.id),
    notifications: db.notifications.filter((item) => item.userId === req.auth.id)
  });
});

app.get("/api/admin/overview", requireAuth, requireAdmin, async (_req, res) => {
  const db = await ensureDb();
  const today = todayKey();
  const totalDeposits = db.deposits.filter((item) => item.status === "approved").reduce((sum, item) => sum + item.amount, 0);
  const totalWithdrawals = db.withdrawals.filter((item) => item.status === "approved").reduce((sum, item) => sum + item.amount, 0);
  const fees = db.withdrawals.filter((item) => item.status === "approved").reduce((sum, item) => sum + item.fee, 0);
  res.json({
    users: db.users.length,
    activeUsersToday: db.users.filter((user) => user.lastLoginAt?.startsWith(today)).length,
    depositsPending: db.deposits.filter((item) => item.status === "pending").length,
    withdrawalsPending: db.withdrawals.filter((item) => item.status === "pending").length,
    tasksCompletedToday: db.taskSubmissions.filter((item) => item.dayKey === today && item.status === "approved").length,
    totalDeposits,
    totalWithdrawals,
    revenue: fees,
    liabilities: db.users.reduce((sum, user) => sum + user.wallets.main + user.wallets.referral + user.wallets.bonus, 0)
  });
});

app.get("/api/admin/db", requireAuth, requireAdmin, async (_req, res) => {
  const db = await ensureDb();
  res.json(publicDb(db));
});

app.post("/api/admin/users/:userId", requireAuth, requireAdmin, async (req, res) => {
  const result = await withDb(async (db) => {
    const user = db.users.find((item) => item.id === req.params.userId);
    if (!user) throw new Error("User not found");
    ["fullName", "phone", "email", "status", "level"].forEach((field) => {
      if (req.body[field] !== undefined) user[field] = req.body[field];
    });
    if (req.body.wallet && req.body.amount) {
      adjustWallet(db, user.id, req.body.wallet, Number(req.body.amount), "admin_adjustment", req.body.note || "Admin adjustment");
    }
    db.adminLogs.unshift({ id: createId("log"), adminId: req.auth.id, action: "update_user", targetId: user.id, createdAt: currentTime() });
    return sanitizeUser(user);
  }).catch((error) => ({ error: error.message }));
  if (result.error) return res.status(400).json(result);
  return res.json(result);
});

app.post("/api/admin/packages", requireAuth, requireAdmin, async (req, res) => {
  const result = await withDb(async (db) => {
    const pkg = {
      id: req.body.id || createId("pkg"),
      name: req.body.name,
      icon: req.body.icon || "📦",
      investment: Number(req.body.investment || 0),
      dailyReturnPercent: Number(req.body.dailyReturnPercent || 0),
      durationDays: Number(req.body.durationDays || 30),
      totalReturn: Number(req.body.totalReturn || 0),
      dailyTasks: Number(req.body.dailyTasks || 0),
      referralBonusPercent: Number(req.body.referralBonusPercent || 0),
      withdrawalLimit: Number(req.body.withdrawalLimit || 0),
      active: req.body.active !== false,
      promo: Boolean(req.body.promo)
    };
    const index = db.packages.findIndex((item) => item.id === pkg.id);
    if (index >= 0) db.packages[index] = pkg;
    else db.packages.unshift(pkg);
    return pkg;
  }).catch((error) => ({ error: error.message }));
  if (result.error) return res.status(400).json(result);
  return res.json(result);
});

app.post("/api/admin/tasks", requireAuth, requireAdmin, upload.single("thumbnail"), async (req, res) => {
  const result = await withDb(async (db) => {
    const task = {
      id: req.body.id || createId("task"),
      title: req.body.title,
      category: req.body.category || "General",
      description: req.body.description || "",
      instructions: req.body.instructions || "",
      verification: req.body.verification || "screenshot",
      reward: Number(req.body.reward || 0),
      link: req.body.link || "",
      timeLimitMinutes: Number(req.body.timeLimitMinutes || 5),
      active: req.body.active !== "false",
      packageIds: req.body.packageIds ? String(req.body.packageIds).split(",").map((item) => item.trim()) : [],
      thumbnail: req.file ? `/uploads/${req.file.filename}` : req.body.thumbnail || ""
    };
    const index = db.tasks.findIndex((item) => item.id === task.id);
    if (index >= 0) db.tasks[index] = task;
    else db.tasks.unshift(task);
    return task;
  }).catch((error) => ({ error: error.message }));
  if (result.error) return res.status(400).json(result);
  return res.json(result);
});

app.post("/api/admin/submissions/:submissionId/review", requireAuth, requireAdmin, async (req, res) => {
  const result = await withDb(async (db) => {
    const submission = db.taskSubmissions.find((item) => item.id === req.params.submissionId);
    if (!submission) throw new Error("Submission not found");
    const status = req.body.status === "approved" ? "approved" : "rejected";
    submission.status = status;
    submission.reviewNote = req.body.note || "";
    submission.reviewedAt = currentTime();
    const task = db.tasks.find((item) => item.id === submission.taskId);
    if (status === "approved") {
      adjustWallet(db, submission.userId, "main", submission.reward, "task_reward", `Task approved: ${task?.title || "Task"}`);
      addNotification(db, submission.userId, "Task approved", `PKR ${submission.reward} credited to main wallet.`);
    } else {
      addNotification(db, submission.userId, "Task rejected", submission.reviewNote || "Please retry with clear proof.");
    }
    return submission;
  }).catch((error) => ({ error: error.message }));
  if (result.error) return res.status(400).json(result);
  return res.json(result);
});

app.post("/api/admin/deposits/:depositId/review", requireAuth, requireAdmin, async (req, res) => {
  const result = await withDb(async (db) => {
    const deposit = db.deposits.find((item) => item.id === req.params.depositId);
    if (!deposit) throw new Error("Deposit not found");
    deposit.status = req.body.status === "approved" ? "approved" : "rejected";
    deposit.note = req.body.note || "";
    deposit.reviewedAt = currentTime();
    if (deposit.status === "approved") {
      adjustWallet(db, deposit.userId, "main", Number(req.body.amount || deposit.amount), "deposit", "Deposit approved");
      addNotification(db, deposit.userId, "Deposit approved", `PKR ${deposit.amount} credited.`);
    } else {
      addNotification(db, deposit.userId, "Deposit rejected", deposit.note || "Payment proof could not be verified.");
    }
    return deposit;
  }).catch((error) => ({ error: error.message }));
  if (result.error) return res.status(400).json(result);
  return res.json(result);
});

app.post("/api/admin/withdrawals/:withdrawalId/review", requireAuth, requireAdmin, async (req, res) => {
  const result = await withDb(async (db) => {
    const withdrawal = db.withdrawals.find((item) => item.id === req.params.withdrawalId);
    if (!withdrawal) throw new Error("Withdrawal not found");
    withdrawal.status = req.body.status === "approved" ? "approved" : "rejected";
    withdrawal.note = req.body.note || "";
    withdrawal.reviewedAt = currentTime();
    if (withdrawal.status === "rejected") {
      adjustWallet(db, withdrawal.userId, "main", withdrawal.amount, "withdrawal_refund", "Withdrawal rejected refund");
    }
    addNotification(db, withdrawal.userId, `Withdrawal ${withdrawal.status}`, withdrawal.note || `Withdrawal ${withdrawal.status}.`);
    return withdrawal;
  }).catch((error) => ({ error: error.message }));
  if (result.error) return res.status(400).json(result);
  return res.json(result);
});

app.post("/api/admin/ads", requireAuth, requireAdmin, async (req, res) => {
  const result = await withDb(async (db) => {
    const ad = {
      id: req.body.id || createId("ad"),
      title: req.body.title,
      placement: req.body.placement || "homepage",
      format: req.body.format || "banner",
      targetUrl: req.body.targetUrl || "",
      imageUrl: req.body.imageUrl || "",
      active: req.body.active !== false,
      impressions: Number(req.body.impressions || 0),
      clicks: Number(req.body.clicks || 0)
    };
    const index = db.ads.findIndex((item) => item.id === ad.id);
    if (index >= 0) db.ads[index] = ad;
    else db.ads.unshift(ad);
    return ad;
  }).catch((error) => ({ error: error.message }));
  if (result.error) return res.status(400).json(result);
  return res.json(result);
});

app.post("/api/admin/settings", requireAuth, requireAdmin, async (req, res) => {
  const result = await withDb(async (db) => {
    db.settings = { ...db.settings, ...req.body };
    return db.settings;
  });
  return res.json(result);
});

app.post("/api/admin/broadcast", requireAuth, requireAdmin, async (req, res) => {
  const result = await withDb(async (db) => {
    const users = req.body.userId ? db.users.filter((user) => user.id === req.body.userId) : db.users.filter((user) => user.role === "user");
    users.forEach((user) => addNotification(db, user.id, req.body.title || "Announcement", req.body.message || ""));
    return { sent: users.length };
  });
  return res.json(result);
});

if (process.env.NODE_ENV === "production") {
  const dist = path.join(process.cwd(), "dist");
  app.use(express.static(dist));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) return next();
    return res.sendFile(path.join(dist, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`EarnInvest Pro API running on port ${port}`);
});
