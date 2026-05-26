# ClockClock - Employee Attendance System

View your app in AI Studio: https://ai.studio/apps/a54cdb0d-49ea-48d3-a8e9-68f18185983a

A secure, enterprise-ready Employee Attendance System with QR and token authentication, featuring role-based views for Employees, Admins, and Super Admins.

## 🚀 Features

- **Role-Based Access Control (RBAC):** Distinct dashboards and views for Employees, Admins, and Super Admins.
- **Authentication:** Secure login with QR code generation and parsing (via `qrcode` and `jsqr`), alongside standard credential access.
- **Offline Sandbox Mode:** All attendance saves, edits, and deletes can run locally on your device without an internet connection.
- **Firebase Integration:** Seamlessly sync offline data with a live Firebase database once connected.
- **Dynamic UI:** Smooth animations using `motion/react`, clean responsive design via `Tailwind CSS`, and modern icons provided by `lucide-react`.

## 🛠 Tech Stack

- **Frontend:** React 19, TypeScript, Vite
- **Styling:** Tailwind CSS v4, Lucide React
- **Backend/Services:** Node.js Express Server, Firebase Firestore, Google Gemini API
- **Utilities:** `jsqr`, `qrcode`, `motion`

## 🏃‍♂️ Run Locally

**Prerequisites:**  
- [Node.js](https://nodejs.org/) installed
- A Firebase project (for live data syncing)

### 1. Install dependencies:
```bash
npm install
```

### 2. Environment Setup:
Create a `.env.local` (using `.env.example` as a template) and add your API keys:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```
Also ensure your `firebase-applet-config.json` and Firebase configurations are properly set up.

### 3. Run the app:
Start the development server (runs both Vite frontend and Express server via `tsx`):
```bash
npm run dev
```

## 📦 Build & Production

To build the project for production:
```bash
npm run build
```
This bundles the Vite application and compiles the server code to `dist/server.cjs`.

To start the production server:
```bash
npm run start
```

## 🧹 Utilities

- **Clean build artifacts:** `npm run clean`
- **Type checking / Linting:** `npm run lint`

## 🔐 Offline Sandbox vs Live Mode

By default, the application may run in an **Offline Sandbox Mode**, keeping data operations local to your machine. To connect to a live database, ensure you configure your Firebase credentials and enable the **Email/Password** provider within Firebase Authentication settings.
