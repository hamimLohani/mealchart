# Meal Chart

Meal Chart is a multi-group hostel and mess meal-management app built with `Next.js`, `Firebase`, `SWR`, `Zustand`, and `nodemailer`.

## What it does

The app supports two roles:

- `Admin`
  Creates and manages a group, members, monthly charts, meals, deposits, costs, notices, CSV exports, and month locking.
- `Member`
  Signs in with Google, joins a group, views monthly reports, and updates their own meals.

## Main features

- Google sign-in for both admin and member flows
- Group registration with admin profile creation
- Member join-request workflow with admin approval/rejection
- Member management: add, edit, remove, search
- Monthly chart creation and lock/unlock
- Admin meal editing table with quarter-step meal quantities
- Member self meal editing on personal page
- Chart-scoped deposit and cost tracking
- Group and member financial summaries
- Manual and system-generated notices
- CSV export for monthly chart reports
- Welcome, receipt, and month-summary emails
- English / Bangla UI
- Responsive admin and member dashboards

## App routes

- `/` : landing page
- `/register` : create group as admin
- `/enter-group` : member login / join flow
- `/admin` : admin dashboard
- `/admin/members`
- `/admin/add-money`
- `/admin/edit-meals`
- `/admin/costs`
- `/admin/create-chart`
- `/admin/notices`
- `/group/[groupId]`
- `/group/[groupId]/chart`
- `/group/[groupId]/money`
- `/group/[groupId]/notices`
- `/group/[groupId]/members`
- `/group/[groupId]/member/[memberId]`

## Tech stack

- `Next.js 16`
- `React 19`
- `Firebase Auth`
- `Cloud Firestore`
- `SWR`
- `Zustand`
- `nodemailer`

## Project structure

- `src/app`
  Route entrypoints and layouts
- `src/components/admin`
  Admin dashboard and management UIs
- `src/components/group`
  Group and member-facing dashboards
- `src/components/forms`
  Registration, login, and join forms
- `src/lib/firebase`
  Firestore config, factories, paths, repositories
- `src/lib/hooks`
  Shared SWR hooks, group session, global loading hook
- `src/lib/email`
  SMTP transport and email actions/templates
- `src/lib/utils`
  Date, session, member-row, and calculation helpers
- `src/i18n`
  Translation and error-map utilities
- `src/store`
  UI and auth Zustand stores

## Setup

1. Create `.env.local`.
2. Add Firebase web config values.
3. Add SMTP config values for email delivery.
4. Install dependencies:

```bash
npm install
```

5. Start development:

```bash
npm run dev
```

## Required environment variables

Firebase:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

SMTP:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `NEXT_PUBLIC_BASE_URL`

## Notes

- Member id is the normalized member email.
- Deposits and costs are stored under each monthly chart.
- Meals are stored at the group level with `monthKey` for locking and monthly reporting.
- Month locking prevents further edits to meals, costs, deposits, and notices for that month.

## Documentation

- Project audit and improvement plan:
  [PROJECT_FEATURES_AND_IMPROVEMENTS.md](./PROJECT_FEATURES_AND_IMPROVEMENTS.md)
