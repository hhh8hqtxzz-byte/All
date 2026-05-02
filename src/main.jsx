import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const apiBase = "";
const money = (value) =>
  new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(Number(value || 0));

function useApi() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [session, setSession] = useState(null);
  const [publicData, setPublicData] = useState({ packages: [], tasks: [], ads: [], settings: {}, leaderboard: [] });
  const [adminDb, setAdminDb] = useState(null);
  const [history, setHistory] = useState({ transactions: [], deposits: [], withdrawals: [], submissions: [], notifications: [] });
  const [message, setMessage] = useState("");

  async function request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${apiBase}${path}`, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  async function loadPublic() {
    setPublicData(await request("/api/public"));
  }

  async function loadMe() {
    if (!token) return;
    setSession(await request("/api/me"));
    setHistory(await request("/api/history"));
  }

  async function loadAdmin() {
    if (session?.user?.role === "admin") setAdminDb(await request("/api/admin/db"));
  }

  useEffect(() => {
    loadPublic().catch((error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    loadMe().catch(() => {
      setToken("");
      localStorage.removeItem("token");
    });
  }, [token]);

  useEffect(() => {
    loadAdmin().catch(() => {});
  }, [session?.user?.role]);

  return {
    token,
    setToken: (value) => {
      localStorage.setItem("token", value);
      setToken(value);
    },
    logout: () => {
      localStorage.removeItem("token");
      setToken("");
      setSession(null);
      setAdminDb(null);
    },
    session,
    setSession,
    publicData,
    history,
    adminDb,
    setAdminDb,
    message,
    setMessage,
    request,
    loadPublic,
    loadMe,
    loadAdmin
  };
}

function Header({ session, logout, view, setView, language, setLanguage }) {
  const isAdmin = session?.user?.role === "admin";
  const nav = ["home", "packages", "tasks", "wallet", "referrals", "leaderboard", "support"];
  return (
    <header className="app-header">
      <div className="brand" onClick={() => setView("home")}>
        <span className="brand-icon">EP</span>
        <div>
          <strong>EarnInvest Pro</strong>
          <small>Smart earning dashboard</small>
        </div>
      </div>
      <nav>
        {nav.map((item) => (
          <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}>
            {item}
          </button>
        ))}
        {isAdmin && (
          <button className={view === "admin" ? "active" : ""} onClick={() => setView("admin")}>
            admin
          </button>
        )}
      </nav>
      <div className="header-actions">
        <button className="ghost" onClick={() => setLanguage(language === "en" ? "ur" : "en")}>
          {language === "en" ? "اردو" : "English"}
        </button>
        {session ? (
          <button className="ghost" onClick={logout}>
            logout
          </button>
        ) : null}
      </div>
    </header>
  );
}

function Auth({ api }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    fullName: "",
    email: "demo@earninvest.local",
    phone: "",
    password: "demo123",
    referralCode: ""
  });

  async function submit(event) {
    event.preventDefault();
    try {
      const data = await api.request(`/api/auth/${mode === "login" ? "login" : "register"}`, {
        method: "POST",
        body: JSON.stringify(form)
      });
      api.setToken(data.token);
      api.setMessage("Logged in successfully");
    } catch (error) {
      api.setMessage(error.message);
    }
  }

  return (
    <main className="auth-page">
      <section className="hero">
        <div className="hero-orbit one" />
        <div className="hero-orbit two" />
        <div className="badge">Pakistan Market · Premium MVP</div>
        <h1>Grow daily with packages, tasks, and referrals</h1>
        <p>
          A polished mobile-first earning platform with wallet controls, task rewards, manual deposits, withdrawals, referrals,
          and complete admin management.
        </p>
        <div className="hero-grid">
          <span>6 premium packages</span>
          <span>5+ task categories</span>
          <span>3-level referrals</span>
          <span>Mobile responsive UI</span>
        </div>
      </section>
      <form className="card auth-card" onSubmit={submit}>
        <h2>{mode === "login" ? "Login" : "Create account"}</h2>
        {mode === "register" && (
          <>
            <label>
              Full name
              <input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
            </label>
            <label>
              Phone
              <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            </label>
            <label>
              Referral code optional
              <input value={form.referralCode} onChange={(event) => setForm({ ...form, referralCode: event.target.value })} />
            </label>
          </>
        )}
        <label>
          Email
          <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </label>
        <label>
          Password
          <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
        </label>
        <button type="submit">{mode === "login" ? "Login" : "Signup without OTP"}</button>
        <button className="link-button" type="button" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "Need account? Signup" : "Already have account? Login"}
        </button>
        <div className="demo-box">
          <strong>Demo logins</strong>
          <span>User: demo@earninvest.local / demo123</span>
          <span>Admin: admin@earninvest.local / admin123</span>
        </div>
      </form>
    </main>
  );
}

function StatCard({ label, value, hint }) {
  return (
    <article className="stat-card reveal-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </article>
  );
}

function Home({ api, setView }) {
  const { session, publicData, history } = api;
  const wallets = session.user.wallets;
  return (
    <main className="page">
      <section className="welcome-panel">
        <div>
          <span className="badge">Welcome back, {session.user.fullName}</span>
          <h1>Today’s earning dashboard</h1>
          <p>Complete daily tasks to unlock package earnings, referral commissions, and bonus rewards.</p>
        </div>
        <div className="hero-actions">
          <button onClick={() => setView("tasks")}>Start tasks</button>
          <button className="light-button" onClick={() => setView("wallet")}>Open wallet</button>
        </div>
      </section>
      <section className="stats-grid">
        <StatCard label="Main wallet" value={money(wallets.main)} />
        <StatCard label="Referral wallet" value={money(wallets.referral)} />
        <StatCard label="Bonus wallet" value={money(wallets.bonus)} />
        <StatCard label="Locked investment" value={money(wallets.locked)} />
        <StatCard label="Tasks today" value={`${session.tasksToday.completed}/${session.tasksToday.limit}`} />
        <StatCard label="Rank" value={`#${session.rank}`} />
      </section>
      <section className="grid-2">
        <div className="card">
          <h2>Active packages</h2>
          {session.activePackages.length ? (
            session.activePackages.map((item) => (
              <div className="row-card" key={item.id}>
                <span>{item.package?.icon}</span>
                <div>
                  <strong>{item.package?.name}</strong>
                  <small>
                    Daily {money(item.dailyReturnAmount)} · ends {new Date(item.endDate).toLocaleDateString()}
                  </small>
                </div>
              </div>
            ))
          ) : (
            <p>No active package yet. Add deposit, then buy a package.</p>
          )}
        </div>
        <div className="card">
          <h2>Notifications</h2>
          {history.notifications.slice(0, 5).map((item) => (
            <div className="timeline-item" key={item.id}>
              <strong>{item.title}</strong>
              <small>{item.message}</small>
            </div>
          ))}
        </div>
      </section>
      <section className="ad-grid">
        {publicData.ads.map((ad) => (
          <a className="ad-card" key={ad.id} href={ad.targetUrl || "#"}>
            <small>{ad.format} · {ad.placement}</small>
            <strong>{ad.title}</strong>
          </a>
        ))}
      </section>
    </main>
  );
}

function Packages({ api }) {
  async function buyPackage(packageId, useBonus = false) {
    try {
      await api.request(`/api/packages/${packageId}/buy`, {
        method: "POST",
        body: JSON.stringify({ useBonus })
      });
      await api.loadMe();
      api.setMessage("Package activated");
    } catch (error) {
      api.setMessage(error.message);
    }
  }

  return (
    <main className="page">
      <div className="section-heading">
        <h1>Investment packages</h1>
        <p>Admin can edit all amounts, task counts, durations, and referral rates.</p>
      </div>
      <section className="package-grid">
        {api.publicData.packages.map((pkg) => (
          <article className="package-card" key={pkg.id}>
            <div className="package-icon">{pkg.icon}</div>
            <h2>{pkg.name}</h2>
            <strong>{money(pkg.investment)}</strong>
            <ul>
              <li>{pkg.dailyReturnPercent}% daily return</li>
              <li>{pkg.durationDays} days duration</li>
              <li>{pkg.dailyTasks === 999 ? "Unlimited" : pkg.dailyTasks} daily tasks</li>
              <li>{pkg.referralBonusPercent}% package referral bonus</li>
            </ul>
            <div className="button-row">
              <button onClick={() => buyPackage(pkg.id)}>Buy</button>
              <button className="ghost" onClick={() => buyPackage(pkg.id, true)}>
                Use bonus
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

function Tasks({ api }) {
  const [tasks, setTasks] = useState([]);
  const [proofs, setProofs] = useState({});

  async function loadTasks() {
    const data = await api.request("/api/tasks");
    setTasks(data.tasks);
  }

  useEffect(() => {
    loadTasks().catch((error) => api.setMessage(error.message));
  }, []);

  async function submitTask(task) {
    const form = new FormData();
    if (proofs[task.id]) form.append("proof", proofs[task.id]);
    form.append("note", "Submitted from web dashboard");
    try {
      await api.request(`/api/tasks/${task.id}/submit`, { method: "POST", body: form });
      await loadTasks();
      await api.loadMe();
      api.setMessage(task.verification === "timer" ? "Task auto-approved" : "Task sent for admin review");
    } catch (error) {
      api.setMessage(error.message);
    }
  }

  return (
    <main className="page">
      <div className="section-heading">
        <h1>Daily tasks</h1>
        <p>TikTok, YouTube, app, ad watch, website visit, and sponsored tasks.</p>
      </div>
      <section className="task-grid">
        {tasks.map((task) => (
          <article className="task-card" key={task.id}>
            <small>{task.category} · {task.verification}</small>
            <h2>{task.title}</h2>
            <p>{task.description}</p>
            <div className="reward">{money(task.reward)}</div>
            <a href={task.link} target="_blank" rel="noreferrer">
              Open task link
            </a>
            {task.verification === "screenshot" && (
              <input type="file" onChange={(event) => setProofs({ ...proofs, [task.id]: event.target.files[0] })} />
            )}
            <button disabled={task.status !== "available" && task.status !== "rejected"} onClick={() => submitTask(task)}>
              {task.status === "available" ? "Submit task" : task.status}
            </button>
          </article>
        ))}
      </section>
    </main>
  );
}

function Wallet({ api }) {
  const [deposit, setDeposit] = useState({ amount: 500, method: "JazzCash", transactionId: "" });
  const [withdrawal, setWithdrawal] = useState({ amount: 200, method: "JazzCash", accountTitle: "", accountNumber: "" });
  const [proof, setProof] = useState(null);

  async function submitDeposit(event) {
    event.preventDefault();
    const form = new FormData();
    Object.entries(deposit).forEach(([key, value]) => form.append(key, value));
    if (proof) form.append("proof", proof);
    try {
      await api.request("/api/deposits", { method: "POST", body: form });
      await api.loadMe();
      api.setMessage("Deposit submitted for admin approval");
    } catch (error) {
      api.setMessage(error.message);
    }
  }

  async function submitWithdrawal(event) {
    event.preventDefault();
    try {
      await api.request("/api/withdrawals", { method: "POST", body: JSON.stringify(withdrawal) });
      await api.loadMe();
      api.setMessage("Withdrawal requested");
    } catch (error) {
      api.setMessage(error.message);
    }
  }

  return (
    <main className="page">
      <section className="stats-grid">
        {Object.entries(api.session.user.wallets).map(([key, value]) => (
          <StatCard key={key} label={`${key} wallet`} value={money(value)} />
        ))}
      </section>
      <section className="grid-2">
        <form className="card" onSubmit={submitDeposit}>
          <h2>Deposit</h2>
          <p>Send payment to admin account, upload screenshot, then admin approves.</p>
          <label>
            Method
            <select value={deposit.method} onChange={(event) => setDeposit({ ...deposit, method: event.target.value })}>
              <option>JazzCash</option>
              <option>EasyPaisa</option>
              <option>Bank</option>
              <option>Card</option>
            </select>
          </label>
          <label>
            Amount
            <input type="number" value={deposit.amount} onChange={(event) => setDeposit({ ...deposit, amount: event.target.value })} />
          </label>
          <label>
            Transaction ID
            <input value={deposit.transactionId} onChange={(event) => setDeposit({ ...deposit, transactionId: event.target.value })} />
          </label>
          <input type="file" onChange={(event) => setProof(event.target.files[0])} />
          <button>Submit deposit</button>
        </form>
        <form className="card" onSubmit={submitWithdrawal}>
          <h2>Withdraw</h2>
          <label>
            Method
            <select value={withdrawal.method} onChange={(event) => setWithdrawal({ ...withdrawal, method: event.target.value })}>
              <option>JazzCash</option>
              <option>EasyPaisa</option>
              <option>Bank</option>
              <option>Card</option>
            </select>
          </label>
          {["amount", "accountTitle", "accountNumber"].map((field) => (
            <label key={field}>
              {field}
              <input value={withdrawal[field]} onChange={(event) => setWithdrawal({ ...withdrawal, [field]: event.target.value })} />
            </label>
          ))}
          <button>Request withdrawal</button>
        </form>
      </section>
      <section className="card">
        <h2>Transaction history</h2>
        <div className="table">
          {api.history.transactions.map((item) => (
            <div className="table-row" key={item.id}>
              <span>{item.type}</span>
              <span>{item.wallet}</span>
              <span>{money(item.amount)}</span>
              <span>{item.status}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Referrals({ api }) {
  const link = `${window.location.origin}/?ref=${api.session.user.referralCode}`;
  return (
    <main className="page">
      <section className="welcome-panel">
        <div>
          <span className="badge">Referral Center</span>
          <h1>{api.session.user.referralCode}</h1>
          <p>{link}</p>
        </div>
        <button onClick={() => navigator.clipboard.writeText(link)}>Copy link</button>
      </section>
      <section className="grid-2">
        <div className="card">
          <h2>Direct referrals</h2>
          {api.session.referrals.map((user) => (
            <div className="row-card" key={user.id}>
              <span>👤</span>
              <div>
                <strong>{user.fullName}</strong>
                <small>{user.email}</small>
              </div>
            </div>
          ))}
        </div>
        <div className="card">
          <h2>Commission levels</h2>
          {api.publicData.settings.referral?.levels?.map((level) => (
            <div className="table-row" key={level.level}>
              <span>Level {level.level}</span>
              <span>{level.depositPercent}% deposit</span>
              <span>{level.earningPercent}% earning</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Leaderboard({ publicData }) {
  return (
    <main className="page">
      <section className="card">
        <h1>Leaderboard</h1>
        {publicData.leaderboard.map((user, index) => (
          <div className="leader-row" key={user.id}>
            <span>#{index + 1}</span>
            <strong>{user.fullName}</strong>
            <span>{user.level}</span>
            <span>{money(user.earnings)}</span>
          </div>
        ))}
      </section>
    </main>
  );
}

function Support() {
  return (
    <main className="page">
      <section className="grid-2">
        <div className="card">
          <h1>Support / Help</h1>
          <p>Connect WhatsApp, Tawk.to, or a ticket system here for production support.</p>
          <button>Open WhatsApp placeholder</button>
        </div>
        <div className="card">
          <h2>FAQ</h2>
          <details open>
            <summary>Do I need OTP?</summary>
            <p>Development mode disables OTP/KYC. Production should enable verification.</p>
          </details>
          <details>
            <summary>How are deposits approved?</summary>
            <p>User uploads proof. Admin approves manually from the admin panel.</p>
          </details>
        </div>
      </section>
    </main>
  );
}

function Admin({ api }) {
  const [overview, setOverview] = useState(null);
  const [userAdjust, setUserAdjust] = useState({ userId: "", wallet: "main", amount: 0, note: "" });
  const db = api.adminDb;

  async function load() {
    setOverview(await api.request("/api/admin/overview"));
    await api.loadAdmin();
  }

  useEffect(() => {
    load().catch((error) => api.setMessage(error.message));
  }, []);

  async function review(type, id, status) {
    try {
      await api.request(`/api/admin/${type}/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ status, note: `Admin ${status}` })
      });
      await load();
      api.setMessage(`${type} ${status}`);
    } catch (error) {
      api.setMessage(error.message);
    }
  }

  async function adjustUser(event) {
    event.preventDefault();
    try {
      await api.request(`/api/admin/users/${userAdjust.userId}`, {
        method: "POST",
        body: JSON.stringify(userAdjust)
      });
      await load();
      api.setMessage("User wallet adjusted");
    } catch (error) {
      api.setMessage(error.message);
    }
  }

  if (!db || !overview) return <main className="page">Loading admin...</main>;

  return (
    <main className="page admin-page">
      <div className="section-heading">
        <h1>Admin panel</h1>
        <p>Full MVP controls for users, funds, tasks, packages, ads, notifications, and settings.</p>
      </div>
      <section className="stats-grid">
        {Object.entries(overview).map(([key, value]) => (
          <StatCard key={key} label={key} value={typeof value === "number" ? value.toLocaleString() : value} />
        ))}
      </section>
      <section className="grid-2">
        <div className="card">
          <h2>Pending deposits</h2>
          {db.deposits.filter((item) => item.status === "pending").map((item) => (
            <div className="admin-item" key={item.id}>
              <strong>{money(item.amount)} · {item.method}</strong>
              <small>{db.users.find((user) => user.id === item.userId)?.email}</small>
              {item.proofUrl ? <a href={item.proofUrl} target="_blank" rel="noreferrer">proof</a> : null}
              <div className="button-row">
                <button onClick={() => review("deposits", item.id, "approved")}>Approve</button>
                <button className="danger" onClick={() => review("deposits", item.id, "rejected")}>Reject</button>
              </div>
            </div>
          ))}
        </div>
        <div className="card">
          <h2>Pending withdrawals</h2>
          {db.withdrawals.filter((item) => item.status === "pending").map((item) => (
            <div className="admin-item" key={item.id}>
              <strong>{money(item.amount)} · fee {money(item.fee)}</strong>
              <small>{item.method} · {item.accountNumber}</small>
              <div className="button-row">
                <button onClick={() => review("withdrawals", item.id, "approved")}>Approve</button>
                <button className="danger" onClick={() => review("withdrawals", item.id, "rejected")}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="grid-2">
        <div className="card">
          <h2>Task approval queue</h2>
          {db.taskSubmissions.filter((item) => item.status === "pending").map((item) => (
            <div className="admin-item" key={item.id}>
              <strong>{db.tasks.find((task) => task.id === item.taskId)?.title}</strong>
              {item.proofUrl ? <a href={item.proofUrl} target="_blank" rel="noreferrer">proof</a> : null}
              <div className="button-row">
                <button onClick={() => review("submissions", item.id, "approved")}>Approve</button>
                <button className="danger" onClick={() => review("submissions", item.id, "rejected")}>Reject</button>
              </div>
            </div>
          ))}
        </div>
        <form className="card" onSubmit={adjustUser}>
          <h2>Add/deduct wallet balance</h2>
          <select value={userAdjust.userId} onChange={(event) => setUserAdjust({ ...userAdjust, userId: event.target.value })}>
            <option value="">Select user</option>
            {db.users.map((user) => (
              <option key={user.id} value={user.id}>{user.fullName} · {user.email}</option>
            ))}
          </select>
          <select value={userAdjust.wallet} onChange={(event) => setUserAdjust({ ...userAdjust, wallet: event.target.value })}>
            <option>main</option>
            <option>bonus</option>
            <option>referral</option>
            <option>locked</option>
          </select>
          <input type="number" value={userAdjust.amount} onChange={(event) => setUserAdjust({ ...userAdjust, amount: event.target.value })} />
          <input placeholder="note" value={userAdjust.note} onChange={(event) => setUserAdjust({ ...userAdjust, note: event.target.value })} />
          <button>Apply adjustment</button>
        </form>
      </section>
      <section className="grid-3">
        <AdminList title="Users" items={db.users} fields={["fullName", "email", "phone", "status"]} />
        <AdminList title="Packages" items={db.packages} fields={["name", "investment", "dailyReturnPercent", "dailyTasks"]} />
        <AdminList title="Ads" items={db.ads} fields={["title", "placement", "format", "active"]} />
      </section>
    </main>
  );
}

function AdminList({ title, items, fields }) {
  return (
    <div className="card compact-list">
      <h2>{title}</h2>
      {items.slice(0, 12).map((item) => (
        <div className="mini-row" key={item.id}>
          {fields.map((field) => (
            <span key={field}>{String(item[field])}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

function App() {
  const api = useApi();
  const [view, setView] = useState("home");
  const [language, setLanguage] = useState("en");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) localStorage.setItem("referralCode", ref);
  }, []);

  useEffect(() => {
    if (!api.session) return;
    if (view === "admin" && api.session.user.role !== "admin") setView("home");
  }, [api.session?.user?.id, api.session?.user?.role, view]);

  const page = useMemo(() => {
    if (!api.session) return <Auth api={api} />;
    if (view === "packages") return <Packages api={api} />;
    if (view === "tasks") return <Tasks api={api} />;
    if (view === "wallet") return <Wallet api={api} />;
    if (view === "referrals") return <Referrals api={api} />;
    if (view === "leaderboard") return <Leaderboard publicData={api.publicData} />;
    if (view === "support") return <Support />;
    if (view === "admin" && api.session.user.role === "admin") return <Admin api={api} />;
    return <Home api={api} setView={setView} />;
  }, [api.session, view, api.publicData, api.history, api.adminDb]);

  return (
    <>
      <div className="app-bg one" />
      <div className="app-bg two" />
      {api.session && (
        <Header session={api.session} logout={api.logout} view={view} setView={setView} language={language} setLanguage={setLanguage} />
      )}
      {api.message && <div className="toast" onClick={() => api.setMessage("")}>{api.message}</div>}
      {language === "ur" && (
        <div className="language-note">اردو موڈ placeholder ہے؛ production میں مکمل translations JSON سے connect کریں۔</div>
      )}
      {page}
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
