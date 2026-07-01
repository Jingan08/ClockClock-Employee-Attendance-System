import React, { useState } from 'react';
import { User, UserRole } from './types';
import LoginScreen from './components/LoginScreen';
import Navbar from './components/Navbar';
import EmployeeDashboard from './components/EmployeeDashboard';
import AdminDashboard from './components/AdminDashboard';
import { database } from './database';
import { enableFirebaseMode } from './firebase';
import { KeyRound, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Password modification state
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  const handleRefreshAllData = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!oldPassword || !newPassword) {
      setPasswordError('Please fulfill all password fields.');
      return;
    }

    if (currentUser?.passwordHash !== oldPassword) {
      setPasswordError('The active current password you entered is incorrect.');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Security mandates a minimum password length of 6 characters.');
      return;
    }

    try {
      await database.changePassword(currentUser.id, currentUser.role, newPassword);
      setPasswordSuccess('Security passcode updated successfully.');
      setOldPassword('');
      setNewPassword('');
      
      // Sync State
      setCurrentUser(prev => prev ? { ...prev, passwordHash: newPassword } : null);
      
      setTimeout(() => {
        setPasswordModalOpen(false);
        setPasswordSuccess(null);
      }, 1500);
    } catch (err) {
      setPasswordError('An authorization exception blocked the change.');
    }
  };

  const renderActiveDashboard = () => {
    if (!currentUser) return null;
    switch (currentUser.role) {
      case UserRole.EMPLOYEE:
        return (
          <EmployeeDashboard 
            user={currentUser} 
            refreshTrigger={refreshTrigger} 
          />
        );
      case UserRole.ADMIN:
      case UserRole.SUPERADMIN:
        return (
          <AdminDashboard 
            user={currentUser} 
            onRefreshAllData={handleRefreshAllData} 
            refreshTrigger={refreshTrigger} 
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50/50 text-neutral-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {currentUser ? (
        <div id="portal-dashboard-wrapper">
          {localStorage.getItem('eas_offline_mode') === 'true' && (
            <div className="bg-amber-500 text-white text-xs font-semibold py-2.5 px-4 shadow-sm flex flex-col sm:flex-row items-center justify-between text-center gap-3">
              <div className="flex items-center space-x-2 text-left">
                <ShieldAlert className="h-4 w-4 shrink-0 animate-pulse text-amber-100" />
                <span>
                  <strong>Offline Sandbox Mode Active:</strong> All attendance saves/edits/deletes are running locally on your device. To sync with Firebase, enable the <strong>Email/Password</strong> provider in your Firebase Authentication settings.
                </span>
              </div>
              <button
                onClick={() => enableFirebaseMode()}
                className="bg-white/20 hover:bg-white/30 text-white font-bold px-3 py-1.5 rounded-lg transition duration-200 uppercase tracking-wider text-[10px] shrink-0 border border-white/20"
              >
                Connect Live Firebase
              </button>
            </div>
          )}
          <Navbar 
            user={currentUser} 
            onLogout={handleLogout} 
            onChangePasswordClick={() => setPasswordModalOpen(true)} 
          />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {renderActiveDashboard()}
          </main>
        </div>
      ) : (
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      )}

      {/* GLOBAL PASSWORD MODAL TRANSITION */}
      <AnimatePresence>
        {passwordModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs px-4" id="password-amend-modal">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-6 rounded-2xl border max-w-sm w-full"
            >
              <h3 className="text-sm font-black text-neutral-800 uppercase tracking-widest border-b border-neutral-100 pb-3 flex items-center">
                <KeyRound className="h-4 w-4 mr-2 text-indigo-600 font-bold" />
                Change Portal Passcode
              </h3>

              {passwordError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-105 text-red-700 text-xs font-semibold rounded-lg">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="mt-3 p-3 bg-green-50 border border-green-105 text-green-700 text-xs font-semibold rounded-lg flex items-center">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              <form onSubmit={handleChangePasswordSubmit} className="space-y-4 mt-4 text-xs font-sans">
                <div>
                  <label className="block text-neutral-600 font-semibold mb-1">Old Secure Passcode</label>
                  <input
                    type="password"
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="block text-neutral-600 font-semibold mb-1">New Secure Passcode</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg font-bold"
                    placeholder="Minimum 6 characters"
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-3 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={() => setPasswordModalOpen(false)}
                    className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 rounded-md font-bold text-neutral-700"
                  >
                    Discard
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-md font-bold text-white shadow-sm"
                  >
                    Commit Change
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
