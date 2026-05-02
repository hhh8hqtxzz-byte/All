# EarnInvest Pro

Full-stack MVP for the EarnInvest Pro PRD: user signup/login without OTP for development, package purchases, daily tasks, wallets, referrals, deposits, withdrawals, ads, notifications, leaderboard, and admin controls.

> Production note: this MVP intentionally keeps OTP/KYC disabled because that was requested for the development build. Do not run a real-money public launch without legal review, payment-provider approval, KYC/AML controls, audit logging, liquidity controls, and clear risk disclosures.

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Auth: JWT + bcrypt password hashing
- Storage: JSON database for MVP/demo, using `DATA_DIR`
- Uploads: local upload folder, using `UPLOAD_DIR`
- Deployment target: Render web service with persistent disk

## Local setup

```bash
npm install
cp .env.example .env
npm run dev
```

Open the Vite URL printed in the terminal.

## Demo logins

| Role | Email | Password |
| --- | --- | --- |
| User | `demo@earninvest.local` | `demo123` |
| Admin | `admin@earninvest.local` | `admin123` |

Change these after first deployment by editing the JSON database or adding a proper admin-management flow.

## Main scripts

```bash
npm run dev      # run frontend + API together
npm run server   # run API only on PORT, default 5000
npm run client   # run Vite frontend only
npm run build    # build frontend into dist
npm run start    # production server, serves API + dist
npm run lint     # lightweight repo lint checks
```

## Render deployment

### Option A: Blueprint

1. Push this repo to GitHub.
2. In Render, choose **New → Blueprint**.
3. Select this repository.
4. Render will read `render.yaml`, install dependencies, build the frontend, start the Express server, and attach a 1GB persistent disk at `/var/data`.

### Option B: Manual web service

Create a Render **Web Service**:

- Runtime: Node
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Environment variables:
  - `NODE_ENV=production`
  - `JWT_SECRET=<long random secret>`
  - `DATA_DIR=/var/data`
  - `UPLOAD_DIR=/var/data/uploads`
- Add persistent disk:
  - Mount path: `/var/data`
  - Size: 1GB or higher

## Backend guide

The backend lives in `server/index.js` and exposes REST APIs:

- `POST /api/auth/register` — signup without OTP in dev mode
- `POST /api/auth/login` — login
- `GET /api/me` — dashboard summary
- `GET /api/public` — public packages, tasks, ads, settings, leaderboard
- `GET /api/tasks` — daily tasks for logged-in user
- `POST /api/tasks/:taskId/submit` — submit screenshot/timer task
- `POST /api/deposits` — submit manual payment proof
- `POST /api/withdrawals` — request withdrawal
- `GET /api/history` — user transaction/deposit/withdrawal/task history
- `GET /api/admin/db` — admin data snapshot
- `GET /api/admin/overview` — admin metrics
- `POST /api/admin/users/:userId` — edit user or adjust wallet
- `POST /api/admin/packages` — create/update package
- `POST /api/admin/tasks` — create/update task
- `POST /api/admin/submissions/:submissionId/review` — approve/reject task proof
- `POST /api/admin/deposits/:depositId/review` — approve/reject deposit
- `POST /api/admin/withdrawals/:withdrawalId/review` — approve/reject withdrawal
- `POST /api/admin/ads` — create/update ads
- `POST /api/admin/settings` — update settings
- `POST /api/admin/broadcast` — send in-app notifications

## Data model

The JSON database is created automatically at `DATA_DIR/db.json` and includes:

- users
- packages
- userPackages
- tasks
- taskSubmissions
- deposits
- withdrawals
- transactions
- notifications
- ads
- settings
- adminLogs

For serious production use, migrate this data model to PostgreSQL/MySQL with transactional wallet updates.

## What is implemented from the PRD

- User registration/login without verification for dev
- English/Urdu toggle placeholder
- Mobile-first responsive UI
- Six investment packages
- Daily task list with screenshot/timer verification
- Wallets: main, locked, bonus, referral
- Manual deposit proof upload
- Manual withdrawal requests and admin review
- Three-level referral commissions
- Leaderboard and notification feed
- Admin dashboard metrics
- User wallet adjustment
- Deposit/withdrawal/task approval queues
- Package/task/ad/settings API controls
- Render deployment config

## Recommended production upgrades

- Replace JSON storage with PostgreSQL/MySQL and Redis.
- Add OTP/SMS verification, KYC, withdrawal PIN, device fingerprinting, and reCAPTCHA.
- Integrate licensed Pakistani payment providers instead of manual proof uploads.
- Add RBAC admin roles, admin 2FA, IP allowlist, and immutable audit logs.
- Move uploads to S3/Cloudflare R2.
- Add automated tests and monitoring.
- Have a Pakistani fintech lawyer review the business model before launch.
