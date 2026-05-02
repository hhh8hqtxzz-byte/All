import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "server", "data");
const dbPath = path.join(dataDir, "db.json");

const now = () => new Date().toISOString();
const id = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const clone = (value) => JSON.parse(JSON.stringify(value));

const packages = [
  {
    id: "pkg_starter",
    name: "Starter",
    icon: "🥉",
    investment: 500,
    dailyReturnPercent: 1.5,
    durationDays: 30,
    totalReturn: 725,
    dailyTasks: 3,
    referralBonusPercent: 5,
    withdrawalLimit: 2000,
    active: true,
    promo: false
  },
  {
    id: "pkg_basic",
    name: "Basic",
    icon: "🥈",
    investment: 1500,
    dailyReturnPercent: 2,
    durationDays: 30,
    totalReturn: 2400,
    dailyTasks: 5,
    referralBonusPercent: 7,
    withdrawalLimit: 10000,
    active: true,
    promo: false
  },
  {
    id: "pkg_silver",
    name: "Silver",
    icon: "🥇",
    investment: 5000,
    dailyReturnPercent: 2.5,
    durationDays: 30,
    totalReturn: 8750,
    dailyTasks: 8,
    referralBonusPercent: 9,
    withdrawalLimit: 25000,
    active: true,
    promo: false
  },
  {
    id: "pkg_gold",
    name: "Gold",
    icon: "💎",
    investment: 15000,
    dailyReturnPercent: 3,
    durationDays: 30,
    totalReturn: 28500,
    dailyTasks: 12,
    referralBonusPercent: 11,
    withdrawalLimit: 50000,
    active: true,
    promo: false
  },
  {
    id: "pkg_platinum",
    name: "Platinum",
    icon: "💠",
    investment: 50000,
    dailyReturnPercent: 3.5,
    durationDays: 30,
    totalReturn: 102500,
    dailyTasks: 18,
    referralBonusPercent: 13,
    withdrawalLimit: 150000,
    active: true,
    promo: false
  },
  {
    id: "pkg_vip",
    name: "VIP Elite",
    icon: "👑",
    investment: 150000,
    dailyReturnPercent: 4,
    durationDays: 30,
    totalReturn: 330000,
    dailyTasks: 999,
    referralBonusPercent: 15,
    withdrawalLimit: 99999999,
    active: true,
    promo: false
  }
];

const tasks = [
  {
    id: "task_tiktok_like",
    title: "Like TikTok Video",
    category: "TikTok",
    description: "Like the assigned TikTok video and upload a screenshot.",
    instructions: "Open the link, like the video, then upload screenshot proof.",
    verification: "screenshot",
    reward: 25,
    link: "https://www.tiktok.com/",
    timeLimitMinutes: 5,
    active: true,
    packageIds: [],
    thumbnail: ""
  },
  {
    id: "task_ad_watch",
    title: "Watch Sponsored Ad",
    category: "Ad Watch",
    description: "Watch the sponsored ad for 30 seconds.",
    instructions: "Click start, keep the page open, then submit completion.",
    verification: "timer",
    reward: 15,
    link: "https://example.com",
    timeLimitMinutes: 1,
    active: true,
    packageIds: [],
    thumbnail: ""
  },
  {
    id: "task_youtube_subscribe",
    title: "Subscribe YouTube Channel",
    category: "YouTube",
    description: "Subscribe to the channel and upload screenshot proof.",
    instructions: "Open YouTube, subscribe, then upload screenshot proof.",
    verification: "screenshot",
    reward: 30,
    link: "https://www.youtube.com/",
    timeLimitMinutes: 5,
    active: true,
    packageIds: [],
    thumbnail: ""
  },
  {
    id: "task_website_visit",
    title: "Visit Partner Website",
    category: "Website Visit",
    description: "Visit the website and stay for 30 seconds.",
    instructions: "Open the website, browse for 30 seconds, then submit.",
    verification: "timer",
    reward: 20,
    link: "https://example.com",
    timeLimitMinutes: 1,
    active: true,
    packageIds: [],
    thumbnail: ""
  }
];

const ads = [
  {
    id: "ad_home_top",
    title: "Eid Bonus Package",
    placement: "homepage",
    format: "banner",
    targetUrl: "#packages",
    imageUrl: "",
    active: true,
    impressions: 0,
    clicks: 0
  },
  {
    id: "ad_task_native",
    title: "Sponsored Task Campaign",
    placement: "tasks",
    format: "native",
    targetUrl: "#tasks",
    imageUrl: "",
    active: true,
    impressions: 0,
    clicks: 0
  }
];

const settings = {
  appName: "EarnInvest Pro",
  currency: "PKR",
  locale: "en-PK",
  registrationEnabled: true,
  verificationRequired: false,
  kycRequiredForWithdrawal: false,
  welcomeBonus: 50,
  minWithdrawal: 200,
  withdrawalHoldDays: 0,
  forfeitedEarningsEnabled: true,
  taskRefreshTimezone: "Asia/Karachi",
  withdrawalFees: {
    JazzCash: { percent: 5, minimum: 20 },
    EasyPaisa: { percent: 5, minimum: 20 },
    Bank: { percent: 2, minimum: 50 },
    Card: { percent: 3.5, fixed: 100 }
  },
  paymentAccounts: {
    JazzCash: "0300-0000000",
    EasyPaisa: "0300-0000000",
    Bank: "EarnInvest Pro - 00000000000000"
  },
  referral: {
    levels: [
      { level: 1, depositPercent: 10, earningPercent: 5 },
      { level: 2, depositPercent: 5, earningPercent: 2 },
      { level: 3, depositPercent: 2, earningPercent: 1 }
    ],
    milestones: [
      { referrals: 5, bonus: 500 },
      { referrals: 20, bonus: 2500 },
      { referrals: 50, bonus: 10000 }
    ]
  },
  smsGateway: "manual",
  emailSmtp: "manual",
  pushProvider: "firebase-placeholder",
  maintenanceMode: false,
  maintenanceMessage: "We are upgrading the platform. Please check back soon."
};

function dueDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString();
}

function userPublic(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

function getDefaultDb() {
  const passwordHash = bcrypt.hashSync("admin123", 10);
  const admin = {
    id: "user_admin",
    fullName: "Super Admin",
    email: "admin@earninvest.local",
    phone: "03000000000",
    cnic: "",
    passwordHash,
    role: "admin",
    status: "active",
    verified: true,
    referralCode: "ADMIN001",
    referredBy: "",
    wallets: { main: 0, locked: 0, bonus: 0, referral: 0 },
    level: "VIP",
    streak: 0,
    badges: ["Super Admin"],
    createdAt: now(),
    lastLoginAt: ""
  };
  const demo = {
    id: "user_demo",
    fullName: "Demo User",
    email: "demo@earninvest.local",
    phone: "03111111111",
    cnic: "",
    passwordHash: bcrypt.hashSync("demo123", 10),
    role: "user",
    status: "active",
    verified: true,
    referralCode: "DEMO123",
    referredBy: "ADMIN001",
    wallets: { main: 350, locked: 500, bonus: 50, referral: 0 },
    level: "Bronze",
    streak: 2,
    badges: ["First Login"],
    createdAt: now(),
    lastLoginAt: "",
    packageIds: ["up_demo_starter"]
  };
  return {
    meta: { createdAt: now(), updatedAt: now() },
    users: [admin, demo],
    packages,
    userPackages: [
      {
        id: "up_demo_starter",
        userId: "user_demo",
        packageId: "pkg_starter",
        status: "active",
        investment: 500,
        dailyReturnAmount: 7.5,
        startDate: now(),
        endDate: dueDate(30),
        autoRenew: false
      }
    ],
    tasks,
    taskSubmissions: [],
    deposits: [],
    withdrawals: [],
    transactions: [
      {
        id: "txn_demo_bonus",
        userId: "user_demo",
        type: "bonus",
        wallet: "bonus",
        amount: 50,
        status: "completed",
        note: "Welcome bonus",
        createdAt: now()
      }
    ],
    notifications: [
      {
        id: "note_demo",
        userId: "user_demo",
        title: "Welcome to EarnInvest Pro",
        message: "Your dashboard is ready. Complete tasks to unlock earnings.",
        read: false,
        createdAt: now()
      }
    ],
    supportTickets: [],
    ads,
    settings,
    adminLogs: []
  };
}

export async function ensureDb() {
  await mkdir(dataDir, { recursive: true });
  try {
    const raw = await readFile(dbPath, "utf8");
    return JSON.parse(raw);
  } catch {
    const db = getDefaultDb();
    await saveDb(db);
    return db;
  }
}

export async function saveDb(db) {
  db.meta.updatedAt = now();
  await mkdir(dataDir, { recursive: true });
  await writeFile(dbPath, JSON.stringify(db, null, 2));
}

export async function withDb(mutator) {
  const db = await ensureDb();
  const result = await mutator(db);
  await saveDb(db);
  return result;
}

export function createId(prefix) {
  return id(prefix);
}

export function currentTime() {
  return now();
}

export function getDueDate(days) {
  return dueDate(days);
}

export function sanitizeUser(user) {
  return userPublic(clone(user));
}

export function publicDb(db) {
  return {
    ...clone(db),
    users: db.users.map(userPublic)
  };
}

export function addTransaction(db, userId, type, wallet, amount, note, status = "completed") {
  const tx = {
    id: id("txn"),
    userId,
    type,
    wallet,
    amount: Number(amount),
    status,
    note,
    createdAt: now()
  };
  db.transactions.unshift(tx);
  return tx;
}

export function addNotification(db, userId, title, message) {
  const notification = {
    id: id("note"),
    userId,
    title,
    message,
    read: false,
    createdAt: now()
  };
  db.notifications.unshift(notification);
  return notification;
}

export function adjustWallet(db, userId, wallet, amount, type, note) {
  const user = db.users.find((item) => item.id === userId);
  if (!user) throw new Error("User not found");
  user.wallets[wallet] = Number(user.wallets[wallet] || 0) + Number(amount);
  return addTransaction(db, userId, type, wallet, Number(amount), note);
}

export function getReferralChain(db, referralCode) {
  const chain = [];
  let code = referralCode;
  for (let level = 1; level <= 3; level += 1) {
    const referrer = db.users.find((user) => user.referralCode === code);
    if (!referrer) break;
    chain.push({ level, user: referrer });
    code = referrer.referredBy;
  }
  return chain;
}
