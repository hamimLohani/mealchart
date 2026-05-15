# Meal Chart - Features Documentation

Meal Chart is a comprehensive, real-time management solution for hostels and mess facilities. It simplifies the complex task of tracking meals, managing finances, and coordinating between administrators and members.

## 🌟 Core Features

### 1. Group & Member Management
- **Group Registration**: Easy setup for new hostels or mess groups.
- **Join Requests**: Members can find their group and request to join using Google Authentication.
- **Member Approval**: Admins have full control over who joins the group through a dedicated member management panel.
- **Profile Tracking**: Individual member profiles with meal and payment history.

### 2. Monthly Chart System
- **Dynamic Charts**: Create fresh charts for each month to keep records organized.
- **Meal Grid**: A clear, tabular view of daily meal counts for all members.
- **Month Locking**: Finalize and lock months to prevent accidental changes after accounting is completed.

### 3. Financial Accounting
- **Cost Tracking**: Record all group expenses (groceries, utilities, etc.) with dates and descriptions.
- **Deposit Management**: Log money collected from members.
- **Automatic Calculations**:
    - **Total Meals**: Sum of all meals in a month.
    - **Meal Rate**: Automatically calculated based on total costs and total meals.
    - **Individual Costs**: Calculated per member based on their meal count and the current rate.
    - **Balance Tracking**: Real-time balance for each member (Paid - Cost).

### 4. Communication & Notices
- **Notice Board**: Admins can post announcements and important updates for all members.
- **Real-time Updates**: Changes to meals or notices are reflected instantly for all users.

## 🛠 Admin Capabilities
- **Edit Meals**: Full grid access to enter or correct meal counts for any member.
- **Add Money**: Interface to quickly record deposits as they are collected.
- **Manage Costs**: Add, edit, or remove expense records.
- **Data Repair Tools**: Built-in utilities to fix legacy data or sync records.
- **PDF Export**: Generate professional, centered PDF reports of the monthly chart for offline sharing or printing.

## 👤 Member Features
- **Self-Service Meals**: Members can log in and add their own daily meal counts (if permitted by the admin).
- **Personal Dashboard**: View individual meal history, deposits, and current balance.
- **Group Transparency**: Access to the group's total costs, meal rate, and notices.

## 📱 Mobile & App Experience (PWA)
- **Installable App**: Fully configured as a Progressive Web App (PWA).
- **Add to Home Screen**: Prompt for users to install the app directly on Android and iOS.
- **Native Feel**: Standalone display mode with no browser address bar.
- **Offline Support**: Service worker integration for basic offline viewing.
- **Optimized UI**: Modern, responsive design that works perfectly on all screen sizes.

## 🌐 Technical Highlights
- **Bilingual Support**: Full interface available in both **English** and **Bengali**.
- **Dark Mode**: High-quality light and dark themes for comfortable viewing in any environment.
- **Secure Auth**: Powered by Google Authentication for secure and easy login.
- **Real-time Backend**: Built with Next.js and Firebase for speed and reliability.
- **Automated Emails**:
    - **Receipts**: Automated email receipts when money is deposited.
    - **Summaries**: Monthly summary reports sent to all members when a month is locked.

---
*Hosted at: [mealchart.vercel.app](https://mealchart.vercel.app)*
