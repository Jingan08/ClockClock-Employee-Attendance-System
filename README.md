# 🕒 ClockClock - Employee Attendance System

Checkout the live demo here: [ClockClock Live App](https://clock-clock-eas.vercel.app)

ClockClock is a secure, modern, enterprise-ready **Employee Attendance System (EAS)** featuring dynamic QR-based check-in protocols, advanced Role-Based Access Control (RBAC), and automatic credential dispatch via secure SMTP.

---

## ✨ Features

- **🛡️ Secure Role-Based Dashboards:** Isolated workflows and metrics custom-tailored for:
  - **Super Admins:** Provision/deprovision administrative accounts, oversee organizational settings, and monitor attendance registers.
  - **Admins:** Register employees, monitor live check-ins, manage attendance logs, and generate shifts.
  - **Employees:** Check-in/out and view historical attendance records.
- **🔄 Dynamic QR Cryptographic Verification:** Auto refreshed QR code that updates every 60 seconds with countdown to prevent token replication.
- **📧 Automated SMTP Mailer:** Built-in email sender using Gmail SMTP to send system-generated credentials to new staff and administrators.
- **🎨 Premium Visual Design:** Responsive and modern Glassmorphic UI featuring smooth dynamic micro-animations built using `motion/react`, clean typography, custom high-resolution branding favicons, and beautiful, harmonized tailwind palettes.
- **🔥 Segregated Database & Security Rules:** Employs advanced Firestore collection isolation schemas (`employees` and `admins` collections) guarded by strict security rules.

---

## 🛠️ Technology Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend Framework** | React 19, TypeScript, Vite |
| **Styling & UI** | Tailwind CSS v4, Lucide React Icons |
| **Backend/API** | Node.js, Express Server, tsx |
| **Security & Database** | Firebase Firestore, Firestore Security Rules |
| **Email Dispatcher** | Nodemailer with Gmail SMTP Gateway |
| **Utilities** | `jsqr` (QR reader), `qrcode` (QR generator), `motion` (animations) |

---

## ⚙️ Environment Configuration

Ensure the following configuration layers are set up in your repository:

### 1. Local Environment Variables (`.env`)
Create a `.env` file in the root directory:
```env
# Google Gemini Integration API Key
GEMINI_API_KEY="your_gemini_api_key_here"

# Application Hosting URL
APP_URL="http://localhost:3000"

# Gmail SMTP Credentials for Credentials Dispatch
# Set SMTP_USER to your Gmail address, e.g., "admin@yourcompany.com"
# Set SMTP_PASS to your 16-character Gmail App Password (NOT your account password)
SMTP_USER="your-email@gmail.com"
SMTP_PASS="xxxx xxxx xxxx xxxx"
```

### 2. Firebase App Config (`firebase-applet-config.json`)
Configure your Firebase connection details in `firebase-applet-config.json`:
```json
{
  "projectId": "your-firebase-project-id",
  "appId": "your-firebase-app-id",
  "apiKey": "your-firebase-api-key",
  "authDomain": "your-firebase-auth-domain.firebaseapp.com",
  "firestoreDatabaseId": "your-firestore-database-id",
  "storageBucket": "your-firebase-storage-bucket"
}
```

---

## 🏃‍♂️ Quick Start Guide

### 1. Install Dependencies
```bash
npm install
```

### 2. Run in Development Mode
Launches the dual Vite frontend server and Express backend server:
```bash
npm run dev
```

### 3. Build for Production
Compiles the React application bundle and packages the Express backend with esbuild:
```bash
npm run build
```

### 4. Launch Production Server
```bash
npm run start
```

---

## 🧹 Maintenance Commands

- **Clean build artifacts:** `npm run clean`
- **TypeScript compilation check:** `npm run lint`

---

## 🔒 Advanced Firestore Architecture & Security

The system separates personnel accounts into explicit Firestore collections for superior security:
- `/employees/{employeeId}`: Holds employee accounts, shift records, and clock times.
- `/admins/{adminId}`: Holds administrative accounts, credential configurations, and logging data.

Firestore Rules enforce that employees can only view or manage their own data, while only validated administrators can access administrative collections and provision credentials.
