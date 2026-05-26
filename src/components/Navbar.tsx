import { User, UserRole } from '../types';
import { LogOut, User as UserIcon, ShieldAlert, Key } from 'lucide-react';
import { useState } from 'react';
import { database } from '../database';

interface NavbarProps {
  user: User;
  onLogout: () => void;
  onChangePasswordClick?: () => void;
}

export default function Navbar({ user, onLogout, onChangePasswordClick }: NavbarProps) {
  const [profileOpen, setProfileOpen] = useState(false);

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case UserRole.SUPERADMIN:
        return 'bg-red-50 text-red-700 border-red-200';
      case UserRole.ADMIN:
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case UserRole.EMPLOYEE:
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    }
  };

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 font-sans" id="app-navbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-800">
              ClockClock <span className="text-indigo-600 font-extrabold">v1.0</span>
            </span>
          </div>

          <div className="flex items-center space-x-6">
            <div className="hidden md:flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">System Status: Database Connected</span>
            </div>
            
            <div className="hidden md:block h-8 w-px bg-slate-200"></div>

            <div className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${getRoleBadgeColor(user.role)} uppercase tracking-wider`}>
              {user.role}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen(!profileOpen)}
                id="navbar-profile-trigger"
                className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-slate-50 transition border border-slate-200"
              >
                <div className="h-8 w-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs border border-slate-200 shadow-xs">
                  {user.name.charAt(0)}
                </div>
                <span className="hidden md:inline-block text-xs font-bold text-slate-700 max-w-[125px] truncate">
                  {user.name}
                </span>
              </button>

              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white border border-slate-200 shadow-lg py-2 z-20 origin-top-right">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Signed In As</p>
                      <p className="text-sm font-bold text-slate-800 mt-1 truncate">{user.name}</p>
                      <p className="text-xs text-slate-500 truncate">{user.email}</p>
                      {user.employeeID && (
                        <p className="text-xs font-mono text-slate-400 mt-1">ID: {user.employeeID}</p>
                      )}
                      {user.adminID && (
                        <p className="text-xs font-mono text-slate-400 mt-1">Admin ID: {user.adminID}</p>
                      )}
                    </div>
                    
                    <div className="py-1">
                      {onChangePasswordClick && (
                        <button
                          type="button"
                          onClick={() => {
                            setProfileOpen(false);
                            onChangePasswordClick();
                          }}
                          className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-indigo-600 flex items-center transition"
                        >
                          <Key className="h-3.5 w-3.5 mr-2" />
                          Change Password
                        </button>
                      )}
                      
                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false);
                          onLogout();
                        }}
                        id="logout-dropdown-btn"
                        className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 flex items-center font-bold transition border-t border-slate-50"
                      >
                        <LogOut className="h-3.5 w-3.5 mr-2" />
                        Log Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
