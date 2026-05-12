# Meal Chart Project Audit

## 1. Project Summary

`Meal Chart` is a multi-group hostel/mess meal-management web app built with:

- `Next.js 16` with the App Router
- `React 19`
- `Firebase Auth`
- `Cloud Firestore`
- `SWR` for shared client-side data fetching
- `Zustand` for lightweight UI/auth state
- `nodemailer` for email notifications
- Custom bilingual UI (`English` and `Bangla`)

The app supports two main roles:

- `Admin`: creates and manages a group, members, charts, meals, money, costs, notices, and month locking
- `Member`: signs in with Google, joins a group, views reports, and updates own meals

## 2. Current App Structure

### 2.1 Route Structure

- `/` : marketing / feature landing page
- `/register` : admin group registration
- `/enter-group` : shared login/join flow for members and non-admin users
- `/admin` : admin dashboard
- `/admin/members` : member management + join request approval
- `/admin/add-money` : deposit management
- `/admin/edit-meals` : meal chart editing
- `/admin/costs` : monthly cost management
- `/admin/create-chart` : monthly chart creation, CSV export, lock/unlock
- `/admin/notices` : notice management
- `/group/[groupId]` : group home / monthly summary
- `/group/[groupId]/chart` : monthly meal chart
- `/group/[groupId]/money` : monthly financial view
- `/group/[groupId]/notices` : notices for selected chart
- `/group/[groupId]/members` : member list
- `/group/[groupId]/member/[memberId]` : individual member page with meal editing and personal report

### 2.2 Core Layers

- `src/lib/firebase/repositories.ts`
  Central data-access layer for Firestore reads/writes
- `src/lib/hooks/use-data.ts`
  Shared SWR hooks for groups, members, charts, meals, costs, deposits, notices
- `src/lib/utils/*`
  Date, chart-session, member-row, and meal-money calculation helpers
- `src/i18n/*`
  Translation system and error-message mapping
- `src/lib/email/*`
  SMTP transport + email templates/actions
- `src/store/*`
  UI state and auth-loaded state

## 3. Firestore Data Model

### 3.1 Top-Level Collections

- `groups`
- `admins`

### 3.2 Group Subcollections

Under `groups/{groupId}`:

- `members`
- `joinRequests`
- `charts`
- `meals`
- `lockedMonths`

Under `groups/{groupId}/charts/{chartId}`:

- `deposits`
- `costs`
- `notices`

### 3.3 Main Domain Objects

- `Group`
  id, name, token, adminId, currentChartId, currentChartMonth, createdAt, active
- `AdminProfile`
  id, email, groupId, createdAt
- `Member`
  id, fullName, joinDate, email, active
- `Chart`
  id, label, monthKey, year, month, totalDays, active, locked, createdAt
- `MealEntry`
  id, memberId, date, quantity, monthKey
- `DepositEntry`
  id, memberId, amount, date, collectedByAdminId
- `CostEntry`
  id, itemName, amount, date
- `Notice`
  id, title, body, systemGenerated, createdAt
- `JoinRequest`
  id, fullName, email, createdAt

## 4. Implemented Features

### 4.1 Authentication and Access

- Google sign-in based login for both admin and member flows
- Admin account registration with automatic group creation
- Auto-routing after sign-in:
  - existing member goes to their group
  - existing admin goes to admin dashboard
  - unknown user is shown join-request flow
- Admin profile migration logic if Firebase UID changes but email matches existing admin profile

### 4.2 Group Registration

- Admin creates a new group
- Group record and admin profile are written in one batch
- Group token is generated
- Admin is considered signed in immediately after registration

### 4.3 Member Join Request Flow

- Non-member users can request to join a selected group
- Requests are stored under the group
- Admin can approve or reject join requests
- Approval creates the member record and removes the request

### 4.4 Member Management

- Add member manually
- Edit member name and join date
- Remove member
- Search members by name or email
- Approve/reject pending join requests
- System notices are created for member add/update/remove
- Welcome email is sent when a member is added or approved

### 4.5 Monthly Chart Management

- Admin creates a chart by month/year
- Duplicate month creation is blocked
- New chart is set as current group chart
- Chart list is shown in descending month order
- Lock/unlock month support
- `lockedMonths` mirror docs are maintained for rule enforcement
- Backfill utility exists for older meal docs missing `monthKey`

### 4.6 Meal Tracking

- Admin monthly meal table editor
- Supports quarter-step quantities through normalization
- Per-day default value can be applied to all active members
- Member self-update page supports personal meal editing for own profile
- Admin can also edit any member’s meal from the individual page
- Lock state prevents editing
- Daily and monthly meal views are available

### 4.7 Money / Deposit Management

- Admin selects a chart/month
- Deposit entries are stored inside the chart scope
- Deposit history is visible
- Per-member deposited totals are calculated in the UI
- Deposit notice is auto-generated
- Deposit receipt email is sent to the member
- Negative deposits are supported for deduction/return flows

### 4.8 Cost Management

- Admin selects a chart/month
- Adds cost entries with item name, amount, and date
- Chart-month date validation is enforced
- Cost list and total are shown
- Deletion is supported until month is locked

### 4.9 Notices

- Admin can add, edit, and delete manual notices
- System notices are auto-generated for important actions
- Members can read chart-specific notices
- System-generated notices are visually marked

### 4.10 Reporting and Calculation

- Group dashboard shows:
  - total meals
  - total cost
  - total paid
  - meal rate
  - remaining taka
  - member count
- Group chart page shows month-wide meal table
- Group money page shows:
  - total cost
  - total paid
  - total meals
  - meal rate
  - group surplus/deficit
  - member balances
  - deposit history
  - cost history
- Member page shows:
  - total meals
  - total cost
  - total paid
  - balance
  - meal history
  - payment history

### 4.11 Export and Email

- CSV export for monthly member totals from admin chart screen
- Welcome email for new members
- Receipt email for deposits
- Month-lock summary email containing:
  - individual total meals
  - total paid
  - meal rate
  - personal cost
  - remaining balance
  - payment history
  - meal chart
  - monthly cost breakdown

### 4.12 UI / UX

- Bilingual interface (`en`, `bn`)
- Theme support via Zustand
- Responsive admin and group layouts
- Global loading overlay
- Admin-specific loading-state component
- Skeleton loaders in group-facing screens

## 5. Important Behavioral Rules

- Member email is used as normalized member id
- Member email cannot be changed after creation
- Deposit and cost dates must match the selected chart month
- Meal doc ids are deterministic: `memberId_date`
- Locked month prevents meal, deposit, cost, and notice changes
- Historical member rows are preserved in chart views through helper logic even if a member is later removed

## 6. Current Technical Strengths

- Clear separation between route pages, UI components, repositories, hooks, and utilities
- SWR is already introduced for group-facing shared reads
- Firestore rules are relatively strict for lock enforcement and admin-only writes
- Domain model is simple and understandable
- Chart-scoped deposits/costs are the right shape for monthly isolation
- Month summaries and calculations are centralized in utility functions
- i18n/error translation system is already established

## 7. Main Weaknesses and Risks

### 7.1 Repository Layer Uses Firebase Client SDK Everywhere

`src/lib/firebase/repositories.ts` is built around the browser Firestore client SDK. That means:

- server actions cannot safely reuse it
- email/report/background jobs need special handling
- there is no clean server-side data layer yet

This already caused the offline Firestore issue you saw in email actions.

### 7.2 Repeated Full-Collection Reads

Many screens fetch entire collections repeatedly:

- all members for a group
- all charts for a group
- all meals for a whole month
- all costs for a chart
- all deposits for a chart

This is acceptable for small groups, but it will slow down as data grows.

### 7.3 Admin Screens Mostly Bypass SWR Reuse

Group-facing pages use shared SWR hooks more consistently. Admin manager screens still use manual `useEffect` + `useState` fetch loops. This causes:

- duplicated data-fetching logic
- harder cache invalidation
- more repeated reads
- more inconsistent loading/error states

### 7.4 Calculations Are Recomputed on Every Screen Load

Monthly totals are recalculated from raw meals/costs/deposits every time the UI loads. This is fine for small data, but expensive for large charts or many users.

### 7.5 No Pagination / Windowing

History lists and management lists currently assume moderate-sized collections. There is no pagination or list virtualization.

### 7.6 Some Legacy / Drift Signals Exist

- README is outdated compared with actual implementation
- some auth files still import `signInWithRedirect` without using it
- there are still mixed loading patterns across the app

## 8. Performance Improvement Recommendations

### Priority 1: Create a Proper Server-Side Data Layer

Add a dedicated server-side Firebase layer using `firebase-admin` for:

- email/report generation
- future scheduled jobs
- secure server actions
- admin-only server workflows

Why this matters:

- avoids client-SDK misuse on the server
- reduces auth/state edge cases
- makes reporting and automation cleaner

### Priority 2: Move Admin Screens to Shared SWR Hooks

Refactor admin managers to consume shared hooks instead of repeating direct repository calls.

Examples:

- `useMembers(groupId)`
- `useJoinRequests(groupId)`
- `useCharts(groupId)`
- `useDeposits(groupId, chartId)`
- `useCosts(groupId, chartId)`
- `useNotices(groupId, chartId)`

Benefits:

- cached reads shared across screens
- less duplicate fetch code
- easier optimistic updates
- lower Firestore read count

### Priority 3: Introduce Summary Documents

Persist computed monthly summaries under each chart, for example:

- `groups/{groupId}/charts/{chartId}/summary/main`
- `groups/{groupId}/charts/{chartId}/summary/members/{memberId}`

Store:

- total meals
- total cost
- total paid
- meal rate
- remaining taka
- per-member totals

Update these through:

- Cloud Functions
- or explicit write-side recalculation logic after meal/cost/deposit changes

Benefits:

- dashboard loads become much faster
- email generation becomes simpler
- export becomes cheaper

### Priority 4: Reduce Chart Boot-Time Repair Work

`backfillMealMonthKeys()` and `syncLockedMonthDocsFromCharts()` currently run from the admin chart manager load path.

These should become one-time migration tasks, not repeated UI-time tasks.

Better options:

- standalone admin repair script
- one-off migration route
- Cloud Function / batch migration process

### Priority 5: Add Firestore Query Optimization

Potential improvements:

- fetch only active/current chart metadata for dashboard-first views
- load expensive month data only after month selection
- add pagination for notices / deposits / costs when lists get long
- consider limiting joins or ordering where possible

### Priority 6: Minimize Repeated Group Metadata Reads

Several places fetch `getGroupById()` again just for the group name.

Improvements:

- keep current group in cache/store once resolved
- pass group metadata down where already loaded
- centralize group session context

## 9. Product / UX Improvement Recommendations

### High Value

- Add a dedicated admin test-email screen
- Add success toasts for email sent / chart locked / deposit saved
- Add member status indicators:
  - active
  - pending approval
  - removed/former
- Add a previous-month history index in group views
- Add filtering/search to deposits, costs, and notices

### Medium Value

- Add resend welcome email / resend month summary actions
- Add downloadable PDF summary in addition to CSV/email
- Add admin audit log for sensitive changes
- Add chart duplication / carry-forward tools for next month setup

### Nice to Have

- Mobile-first quick actions in admin panel
- Better empty states with recovery hints
- Offline banner for actual network disconnect cases

## 10. Suggested Refactor Roadmap

### Phase 1: Stability

1. Add `firebase-admin` server data layer
2. Remove outdated README claims
3. Clean auth form warnings/import drift
4. Standardize admin loading/error/success patterns

### Phase 2: Performance

1. Convert admin screens to SWR hooks
2. Add summary documents for chart totals
3. Remove UI-triggered migration/backfill work
4. Introduce more selective Firestore fetches

### Phase 3: Scale

1. Pagination / virtualization for long lists
2. background recalculation or cloud-trigger aggregation
3. reporting API / admin export improvements
4. operational monitoring for email and Firestore failures

## 11. Fast Wins You Can Implement Next

These are the best short-term improvements for speed and maintainability:

1. Add `firebase-admin` and move all server-only email/report reads to it
2. Refactor admin `members`, `costs`, `notices`, and `add-money` screens to SWR hooks
3. Create chart summary docs and stop recomputing everything from raw entries on every load
4. Move backfill/repair logic out of interactive page loads
5. Fix README so it matches the actual project behavior

## 12. Overall Assessment

The project already has a strong functional base:

- the domain model is sensible
- the main user flows are real and usable
- Firestore rules are meaningful
- bilingual support and reporting logic are in place

The biggest gap is not missing features. It is `architecture maturity for scale`.

Today the app is good for small-to-medium groups. To make it faster and more reliable as data grows, the main work should focus on:

- separating client and server data access properly
- caching and reusing reads consistently
- persisting summary data instead of recalculating from raw collections
- removing migration/repair logic from normal UI load paths

