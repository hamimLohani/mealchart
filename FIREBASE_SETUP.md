# Firebase Setup

This project already expects a Firebase web app with:

- `Authentication`
- `Cloud Firestore`

Use this exact setup so the current code works.

## 1. Create Firebase project

1. Open Firebase console
2. Create a new project
3. Add a `Web App`
4. Copy the Firebase web config values

Exact console path:

1. Go to `Project Overview`
2. Click the gear icon `Project settings`
3. In `Your apps`, click the web icon `</>`
4. Register app name like `meat-chart-web`
5. Skip Firebase Hosting for now
6. Copy the `firebaseConfig`

## 2. Create local env file

Create `.env.local` in the project root:

```bash
cp .env.example .env.local
```

Fill these values from Firebase:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

## 3. Enable Authentication

In Firebase Console:

1. Go to `Authentication`
2. Click `Get started`
3. Enable `Email/Password`
4. Save

Current app usage:
- admin registration uses `email + password`
- admin login uses `email + password`
- members do not need Firebase Auth in MVP

## 4. Enable Firestore

In Firebase Console:

1. Go to `Firestore Database`
2. Click `Create database`
3. Start in `production mode`
4. Choose a region close to your users
5. Click `Enable`

## 5. Apply Firestore rules

This repo includes:

- [firestore.rules](/Users/Inz_mac/Developer/Websites/Meat%20Chart/firestore.rules)
- [firestore.indexes.json](/Users/Inz_mac/Developer/Websites/Meat%20Chart/firestore.indexes.json)

In Firebase Console:

1. Go to `Firestore Database`
2. Open `Rules`
3. Replace rules with `firestore.rules`
4. Open `Indexes`
5. Keep `firestore.indexes.json` as the repo baseline for now

Or use Firebase CLI later if you want deployment from terminal.

If you want CLI deployment later:

1. Install Firebase CLI
2. Run `firebase login`
3. Replace the placeholder project id in `.firebaserc`
4. Run `firebase deploy --only firestore:rules,firestore:indexes`

## 6. Current collection structure

- `groups/{groupId}`
- `admins/{adminId}`
- `groups/{groupId}/members/{memberId}`
- `groups/{groupId}/deposits/{depositId}`
- `groups/{groupId}/notices/{noticeId}`

Planned next:

- `groups/{groupId}/costs/{costId}`
- `groups/{groupId}/meals/{mealId}`

## 7. Current working flows after connection

Once Firebase is connected, these features already work:

- admin registration with group token generation
- admin login
- token-based group lookup
- member add/edit/remove
- add money as member deposit
- automatic notices for member and deposit actions

## 8. Firestore index note

The currently implemented queries do not require any custom composite index yet.

If Firebase later asks for an index when costs, meals, or monthly chart queries are added, create the suggested index from the Firebase console and then save it back into `firestore.indexes.json`.

## 9. Recommended first test

After adding env values:

1. Run `npm run dev`
2. Open `/register`
3. Create one admin and one group
4. Copy the generated token
5. Open `/admin/login` and log in
6. Add two or three members
7. Open `/admin/add-money` and add deposits
8. Open `/enter-group` and test the token flow

## 10. Files you must edit

1. `.env.local`
   Replace every `PASTE_..._HERE` value with real Firebase values.
2. `.firebaserc`
   Replace `PASTE_YOUR_FIREBASE_PROJECT_ID_HERE` with your real Firebase project id.

## 11. Important limitation right now

Security rules are set up for the current implemented features only. Costs, meals, chart math, and full notice management still need their final read/write rules once those features are built.
