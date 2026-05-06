# Meat Chart

Multi-group hostel and mess meal management app built with `Next.js`, `Tailwind CSS`, `Firebase`, and `Zustand`.

## Current scope

- Admin registration with immediate group token generation
- Token-based group entry for members
- Firebase-only MVP structure
- Route shell for meals, members, costs, deposits, notices, chart, money, and history
- Theme and language toggles for `light/dark` and `English/Bangla`

## Setup

1. Copy `.env.example` to `.env.local`
2. Fill in your Firebase web app credentials
3. Install dependencies:

```bash
npm install
```

4. Start the app:

```bash
npm run dev
```

5. Follow the full Firebase connection guide:

- [FIREBASE_SETUP.md](/Users/Inz_mac/Developer/Websites/Meat%20Chart/FIREBASE_SETUP.md)

## Connected now

After Firebase is connected, these parts already work:

- admin registration with generated group token
- admin login
- group entry by token
- member add, edit, remove, search
- add money as member deposit
- automatic notices for member and deposit actions

## Still pending

- Implement costs
- Implement meals and meal editing
- Implement full monthly calculation screens
- Implement notice management UI
- Add monthly calculation and history logic
