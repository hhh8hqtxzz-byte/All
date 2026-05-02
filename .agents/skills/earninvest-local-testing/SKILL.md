---
name: earninvest-local-testing
description: How to run and browser-test EarnInvest Pro locally, including seeded credentials and admin/user session checks.
---

# EarnInvest Pro local testing

Use this skill when testing the EarnInvest Pro React/Vite + Express MVP in this repo.

## Local production run

1. Install dependencies if needed:
   ```bash
   npm install
   ```
2. Build before production testing:
   ```bash
   npm run build
   ```
3. Start the production server with an isolated data directory:
   ```bash
   rm -rf /home/ubuntu/earninvest-test-data /home/ubuntu/earninvest-test-uploads
   mkdir -p /home/ubuntu/earninvest-test-data /home/ubuntu/earninvest-test-uploads
   PORT=5081 DATA_DIR=/home/ubuntu/earninvest-test-data UPLOAD_DIR=/home/ubuntu/earninvest-test-uploads JWT_SECRET=test-secret npm start
   ```
4. Open `http://localhost:5081` in Chrome.

Use port `5081` or another safe high port for browser testing. Chrome blocks some ports such as `5060` as unsafe.

## Seeded credentials

These are local/demo credentials seeded by the app, not production secrets:

- User: `demo@earninvest.local` / `demo123`
- Admin: `admin@earninvest.local` / `admin123`

Change seeded credentials before any public deployment.

## Focused admin-to-user regression flow

To verify that a normal user cannot get stuck in admin view:

1. Log in as `admin@earninvest.local`.
2. Click the `Admin` nav button.
3. Confirm the heading reads `Admin panel` and the `Admin` nav item is visible.
4. Click `logout`.
5. Log in as `demo@earninvest.local` in the same browser tab.
6. Confirm the dashboard heading reads `Today’s earning dashboard`, the greeting contains `Demo User`, there is no `Loading admin...`, no `Admin access required` toast, and no `Admin` nav item.
7. Click `Wallet` and confirm wallet stat cards plus the `Deposit` form appear.

## Recording guidance

For browser UI tests, maximize Chrome before recording:

```bash
wmctrl -r :ACTIVE: -b add,maximized_vert,maximized_horz
```

Record only the actual test flow, not setup steps, and annotate the recording at major assertions.
