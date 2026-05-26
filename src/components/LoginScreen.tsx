import React, { useState } from 'react';
import { User, UserRole, AccountStatus } from '../types';
import { database } from '../database';
import { forceOfflineMode } from '../firebase';
import { LogIn, ShieldAlert, KeyRound, UserSquare2, Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showAuthDisabledGuide, setShowAuthDisabledGuide] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Simulate network latency for high fidelity feel
      await new Promise((resolve) => setTimeout(resolve, 600));

      const user = await database.loginWithCredentials(email, password);

      if (!user) {
        setError('Invalid credentials or password. Please try again.');
        setIsLoading(false);
        return;
      }

      if (user.status === AccountStatus.DISABLED) {
        setError('Your account has been deactivated. Please contact your administrator.');
        setIsLoading(false);
        return;
      }

      onLoginSuccess(user);
    } catch (err: any) {
      console.error(err);
      if (err?.code === 'auth/operation-not-allowed' || err?.message?.includes('operation-not-allowed')) {
        setShowAuthDisabledGuide(true);
      } else {
        setError(err?.message || 'A database error occurred during login verification.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOfflineFallback = async () => {
    setIsLoading(true);
    setShowAuthDisabledGuide(false);
    setError(null);
    try {
      forceOfflineMode();
      // Re-run the login request (which will now use offline mode local storage)
      const user = await database.loginWithCredentials(email || 'admin@attendance.com', password || 'adminpassword');
      if (user) {
        onLoginSuccess(user);
      } else {
        setError('Failed to authenticate offline with those credentials. Please use the Fast-Track buttons below.');
      }
    } catch (err: any) {
      setError('An error occurred during offline login: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fillQuickCredential = (role: UserRole) => {
    switch (role) {
      case UserRole.SUPERADMIN:
        setEmail('superadmin@attendance.com');
        setPassword('Superadmin@1234');
        break;
      case UserRole.ADMIN:
        setEmail('admin@attendance.com');
        setPassword('Adminpassword@1234');
        break;
      case UserRole.EMPLOYEE:
        setEmail('employee@attendance.com');
        setPassword('Employee@1234');
        break;
    }
    setError(null);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8 font-sans">
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <div className="text-center">
          <span className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-indigo-55 bg-indigo-50 text-indigo-600 mb-4 ring-8 ring-indigo-50/50">
            <KeyRound className="h-6 w-6" id="login-app-icon" />
          </span>
          <h2 className="text-2xl font-black tracking-tight text-slate-800 italic">
            ClockClock <span className="text-indigo-600 not-italic">v1.0</span>
          </h2>
          <p className="mt-2 text-xs font-bold text-slate-400 uppercase tracking-widest font-sans">
            Employee Attendance System
          </p>
        </div>

        {showAuthDisabledGuide ? (
          <div className="mt-8 space-y-6">
            {error && (
              <div className="rounded-lg bg-red-50 p-4 border border-red-100 flex items-start space-x-3 text-red-700 text-xs font-semibold">
                <ShieldAlert className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="rounded-xl bg-amber-50 p-4 border border-amber-200 text-slate-800 text-sm">
              <div className="flex items-center space-x-2 text-amber-800 font-bold mb-3">
                <ShieldAlert className="h-4.5 w-4.5 text-amber-600" />
                <span>Firebase Authentication Action Required</span>
              </div>
              <p className="font-medium text-slate-600 text-xs mb-4 leading-relaxed">
                The **Email/Password** sign-in provider is disabled in your Firebase Developer Console. Please enable it to use secure cloud synced features.
              </p>
              
              <div className="space-y-3 pl-1 text-[11px] font-medium text-slate-600 border-l-2 border-amber-300">
                <div>
                  <span className="font-bold text-slate-800 block">1. Open Firebase Console</span>
                  Visit the <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline font-bold">Firebase Console</a> and select project <code className="bg-slate-100 px-1 py-0.5 rounded text-rose-500 font-mono font-bold">myhack-token-limit-reached</code>
                </div>
                <div>
                  <span className="font-bold text-slate-800 block">2. Go to Authentication Providers</span>
                  Click **Authentication** in the Build menu, select the **Sign-in method** tab, and click **Add new provider**.
                </div>
                <div>
                  <span className="font-bold text-slate-800 block">3. Enable Email/Password</span>
                  Choose **Email/Password**, turn the status toggle to **Enable**, and click **Save**.
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleOfflineFallback}
                disabled={isLoading}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent font-bold rounded-xl text-white bg-slate-800 hover:bg-slate-900 transition text-sm shadow-sm disabled:opacity-50"
              >
                {isLoading ? 'Booting Sandbox...' : 'Continue in Local Sandbox Mode (Offline)'}
              </button>
              
              <button
                type="button"
                onClick={() => setShowAuthDisabledGuide(false)}
                className="w-full flex justify-center items-center py-3 px-4 border border-slate-200 font-bold rounded-xl text-slate-600 bg-white hover:bg-slate-50 transition text-sm"
              >
                Go Back to Login Sign-In
              </button>
            </div>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg bg-red-50 p-4 border border-red-105 border-red-100 flex items-start space-x-3 text-red-700 text-xs font-semibold"
                id="login-error-message"
              >
                <ShieldAlert className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="email-address" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition text-sm"
                  placeholder="you@corporate.com"
                />
              </div>

              <div>
                <label htmlFor="password-field" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password-field"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition pr-10 text-sm"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                id="login-submit-btn"
                className="group relative flex w-full justify-center items-center py-3 px-4 border border-transparent font-bold rounded-xl text-white bg-slate-800 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition disabled:opacity-75 disabled:cursor-not-allowed text-sm shadow-sm"
              >
                {isLoading ? (
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <LogIn className="mr-2 h-4 w-4 shrink-0" />
                )}
                {isLoading ? 'Logging In...' : 'Sign In to Workspace'}
              </button>
            </div>
          </form>
        )}

        <div className="border-t border-slate-200 pt-6">
          <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
            Sandbox Testing Accounts
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => fillQuickCredential(UserRole.SUPERADMIN)}
              id="fast-track-superadmin"
              className="flex flex-col items-center py-2.5 px-2 rounded-xl bg-slate-50 border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20 text-slate-700 transition"
            >
              <UserSquare2 className="h-4 w-4 text-rose-500 mb-1" />
              <span className="text-[10px] font-bold">Super Admin</span>
            </button>
            <button
              type="button"
              onClick={() => fillQuickCredential(UserRole.ADMIN)}
              id="fast-track-admin"
              className="flex flex-col items-center py-2.5 px-2 rounded-xl bg-slate-50 border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20 text-slate-700 transition"
            >
              <UserSquare2 className="h-4 w-4 text-amber-500 mb-1" />
              <span className="text-[10px] font-bold">Admin</span>
            </button>
            <button
              type="button"
              onClick={() => fillQuickCredential(UserRole.EMPLOYEE)}
              id="fast-track-employee"
              className="flex flex-col items-center py-2.5 px-2 rounded-xl bg-slate-50 border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20 text-slate-700 transition"
            >
              <UserSquare2 className="h-4 w-4 text-indigo-500 mb-1" />
              <span className="text-[10px] font-bold">Employee</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
