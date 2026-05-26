import React, { useState, useEffect } from 'react';
import { User, UserRole, AccountStatus, Attendance, AttendanceStatus, QRToken } from '../types';
import { database } from '../database';
import { 
  Plus, 
  Search, 
  UserX, 
  UserCheck, 
  Settings, 
  RefreshCw, 
  QrCode, 
  Clock, 
  Users, 
  FileSpreadsheet, 
  Edit3, 
  TrendingUp, 
  SlidersHorizontal,
  Mail,
  Phone,
  HelpCircle,
  PlusCircle,
  Hash,
  ShieldCheck,
  Sliders,
  Sparkles,
  Lock
} from 'lucide-react';
import QRCode from 'qrcode';
import { motion, AnimatePresence } from 'motion/react';

interface AdminDashboardProps {
  user: User;
  onRefreshAllData: () => void;
  refreshTrigger: number;
}

export default function AdminDashboard({ user, onRefreshAllData, refreshTrigger }: AdminDashboardProps) {
  // Navigation tab for SuperAdmins: 'console' or 'admins'
  const [activeTab, setActiveTab] = useState<'console' | 'admins'>('console');

  // Database lists
  const [employees, setEmployees] = useState<User[]>([]);
  const [admins, setAdmins] = useState<User[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [activeToken, setActiveToken] = useState<QRToken | null>(null);

  // Filters & searches
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  
  // Timer countdown
  const [timeLeft, setTimeLeft] = useState(60);

  // Modals, Popups & Panels
  const [editingEmployee, setEditingEmployee] = useState<User | null>(null);
  const [editingRecord, setEditingRecord] = useState<Attendance | null>(null);
  const [editingAdmin, setEditingAdmin] = useState<User | null>(null);
  const [selectedEmployeeForLogs, setSelectedEmployeeForLogs] = useState<User | null>(null);
  const [qrBase64, setQrBase64] = useState<string>('');

  // SMTP Dispatch Modal
  const [dispatchEmail, setDispatchEmail] = useState<{
    to: string;
    subject: string;
    body: string;
    unhashedPass: string;
    smtpSuccess: boolean;
    errorText?: string;
  } | null>(null);

  // Form states - Registration of Employee
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpEmail, setNewEmpEmail] = useState('');
  const [newEmpPhone, setNewEmpPhone] = useState('');
  const [newEmpID, setNewEmpID] = useState('');
  const [newEmpPass, setNewEmpPass] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Form states - Provision of Admin (SuperAdmin only)
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPhone, setNewAdminPhone] = useState('');
  const [adminFormError, setAdminFormError] = useState<string | null>(null);
  const [adminFormSuccess, setAdminFormSuccess] = useState<string | null>(null);

  // Edit record states
  const [editCheckIn, setEditCheckIn] = useState('');
  const [editCheckOut, setEditCheckOut] = useState('');
  const [editStatus, setEditStatus] = useState<AttendanceStatus>(AttendanceStatus.CHECKED_IN);

  // Trigger SMTP Network Hook
  const triggerSmtpDispatch = async (email: string, subject: string, body: string) => {
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: email, subject, body }),
      });
      if (!res.ok) {
        throw new Error(`HTTP network fault code: ${res.status}`);
      }
      return await res.json();
    } catch (err: any) {
      console.error("Fetch SMTP endpoint failed securely:", err);
      return { success: false, error: err.message || "Network request failed to reach SMTP server" };
    }
  };

  useEffect(() => {
    fetchSystemEntities();
  }, [refreshTrigger, activeTab]);

  // Handle active Token generation countdown
  useEffect(() => {
    const countdown = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setTimeout(() => {
            triggerNewToken();
          }, 0);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdown);
  }, []);

  const fetchSystemEntities = async () => {
    // 1. Fetch Users (Isolated)
    try {
      const allUsers = await database.getUsers();
      setEmployees(allUsers.filter(u => u.role === UserRole.EMPLOYEE));
      setAdmins(allUsers.filter(u => u.role === UserRole.ADMIN));
    } catch (err) {
      console.error('Failed to load users sequence safely:', err);
    }

    // 2. Fetch Attendances (Isolated)
    try {
      const records = await database.getAttendances();
      setAttendances(records);
    } catch (err) {
      console.error('Failed to load attendance records safely:', err);
    }

    // 3. Fetch/Generate Token (Isolated)
    try {
      let token = await database.getLatestToken();
      if (!token || new Date(token.expiryTime).getTime() < Date.now()) {
        token = await triggerNewToken();
      } else {
        const secLeft = Math.max(0, Math.floor((new Date(token.expiryTime).getTime() - Date.now()) / 1000));
        setTimeLeft(secLeft);
      }
      setActiveToken(token);
      if (token) {
        generateQrImage(token.qrCodeValue);
      }
    } catch (err) {
      console.error('Failed to load/generate security QR token safely:', err);
    }
  };

  const generateQrImage = async (value: string) => {
    try {
      const b64 = await QRCode.toDataURL(value, { margin: 1, scale: 6 });
      setQrBase64(b64);
    } catch (err) {
      console.error('Failed to translate QR cryptographic stream', err);
    }
  };

  const triggerNewToken = async (): Promise<QRToken> => {
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const qrValue = `EAS-AUTHENTIC-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Date.now()}`;
    const id = `tok_${Date.now()}`;
    const token = await database.createNewToken(id, pin, qrValue);
    setActiveToken(token);
    generateQrImage(qrValue);
    setTimeLeft(60);
    onRefreshAllData();
    return token;
  };

  // --- EMPLOYEE MANAGEMENT ---
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!newEmpName || !newEmpEmail || !newEmpPhone || !newEmpID || !newEmpPass) {
      setFormError('Please complete all fields prior to registration.');
      return;
    }

    try {
      const allUsers = await database.getUsers();
      if (allUsers.some(u => u.email.toLowerCase() === newEmpEmail.toLowerCase())) {
        setFormError('Email address already exists in database.');
        return;
      }
      
      if (allUsers.some(u => u.employeeID === newEmpID)) {
        setFormError('Employee ID collision detected. Badge code must be unique.');
        return;
      }

      const fresh: User = {
        id: `emp_${Date.now()}`,
        userID: `emp_${Date.now()}`,
        name: newEmpName,
        email: newEmpEmail,
        phone: newEmpPhone,
        passwordHash: newEmpPass,
        role: UserRole.EMPLOYEE,
        status: AccountStatus.ACTIVE,
        employeeID: newEmpID,
        createdAt: new Date().toISOString()
      };

      await database.saveUser(fresh);

      // Draft credentials body
      const emailSubject = "🔐 Welcome Onboard - Employee Credentials";
      const emailBody = `Dear ${newEmpName},

Your employee profile has been registered on the ClockClock Attendance System.

Here are your secure check-in credentials:
- Employee ID: ${newEmpID}
- Email Address: ${newEmpEmail}
- Temporary Password: ${newEmpPass}

For security protocols, please login and immediately change your password.

Sincerely,
The Management`;

      // Dispatch via Express/Gmail SMTP proxy
      setFormSuccess(`Profile created for ${newEmpName}. Creating profile and sending credential email...`);
      const res = await triggerSmtpDispatch(newEmpEmail, emailSubject, emailBody);

      if (res && res.success) {
        setFormSuccess(`Registered profile for ${newEmpName} and credential email sent successfully!`);
      } else {
        // Fallback or unconfigured trigger alert
        setFormSuccess(`Registered profile for ${newEmpName} securely.`);
        setDispatchEmail({
          to: newEmpEmail,
          subject: emailSubject,
          body: emailBody,
          unhashedPass: newEmpPass,
          smtpSuccess: false,
          errorText: res?.message || "Missing Gmail SMTP environment variables."
        });
      }

      // Clear forms
      setNewEmpName('');
      setNewEmpEmail('');
      setNewEmpPhone('');
      setNewEmpID('');
      setNewEmpPass('');
      fetchSystemEntities();
    } catch (err) {
      setFormError('Administrative access restriction blocked the profile.');
    }
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    try {
      await database.saveUser(editingEmployee);
      setEditingEmployee(null);
      fetchSystemEntities();
    } catch (err) {
      console.error(err);
    }
  };

  // --- ADMINISTRATOR MANAGEMENT (SUPERADMIN ONLY) ---
  const handleRegisterAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminFormError(null);
    setAdminFormSuccess(null);

    if (!newAdminName || !newAdminEmail || !newAdminPhone) {
      setAdminFormError('Please fulfill all required fields before dispatch.');
      return;
    }

    try {
      const allUsers = await database.getUsers();
      if (allUsers.some(u => u.email.toLowerCase() === newAdminEmail.toLowerCase())) {
        setAdminFormError('An account with this email address already exists.');
        return;
      }

      const randomPassword = `ADM-SEC-${Math.floor(1000 + Math.random() * 9000)}`;
      const adminId = `admin_${Date.now()}`;
      const freshAdmin: User = {
        id: adminId,
        userID: adminId,
        name: newAdminName,
        email: newAdminEmail,
        phone: newAdminPhone,
        passwordHash: randomPassword,
        role: UserRole.ADMIN,
        status: AccountStatus.ACTIVE,
        adminID: `ADM-${Math.floor(100 + Math.random() * 900)}`,
        createdAt: new Date().toISOString()
      };

      await database.saveUser(freshAdmin);

      const emailSubject = '🔐 Workspace Admin Credentials Generated';
      const emailBody = `Dear ${newAdminName},

An administrator account has been generated for you on the Employee Attendance System.

Your Temporary Login Credentials:
- Admin Email: ${newAdminEmail}
- Temporary Password: ${randomPassword}

For security compliance, log into your profile dashboard and immediately change your password.

Sincerely,
The Management`;

      // Trigger actual SMTP send via server endpoint
      const res = await triggerSmtpDispatch(newAdminEmail, emailSubject, emailBody);

      setAdminFormSuccess(
        `Registered supervisor "${newAdminName}" successfully. Password: ${randomPassword} ${
          res && res.success ? "(Email sent successfully)" : "(Email sent failed: Missing SMTP environment variables)"
        }`
      );

      setNewAdminName('');
      setNewAdminEmail('');
      setNewAdminPhone('');
      fetchSystemEntities();
      onRefreshAllData();
    } catch (err) {
      setAdminFormError('A security exception blocked the administrator creation.');
    }
  };

  const handleUpdateAdminProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;

    try {
      await database.saveUser(editingAdmin);
      setEditingAdmin(null);
      fetchSystemEntities();
      onRefreshAllData();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleAdminStatus = async (target: User) => {
    const nextStatus = target.status === AccountStatus.ACTIVE ? AccountStatus.DISABLED : AccountStatus.ACTIVE;
    await database.changeUserStatus(target.id, target.role, nextStatus);
    fetchSystemEntities();
    onRefreshAllData();
  };

  // --- ATTENDANCE RECORDS ---
  const openRecordAmendment = (rec: Attendance) => {
    setEditingRecord(rec);
    setEditCheckIn(rec.checkInTime.slice(0, 19));
    setEditCheckOut(rec.checkOutTime ? rec.checkOutTime.slice(0, 19) : '');
    setEditStatus(rec.status);
  };

  const handleSaveRecordEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    try {
      const updates: Partial<Attendance> = {
        checkInTime: new Date(editCheckIn).toISOString(),
        checkOutTime: editCheckOut ? new Date(editCheckOut).toISOString() : null,
        status: editStatus
      };

      await database.updateAttendanceRecord(editingRecord.id, updates);
      setEditingRecord(null);
      fetchSystemEntities();
    } catch (err) {
      console.error(err);
    }
  };

  // Filter datasets
  const filteredEmployees = employees.filter((emp) =>
    emp.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
    emp.email.toLowerCase().includes(employeeSearch.toLowerCase()) ||
    emp.employeeID?.toLowerCase().includes(employeeSearch.toLowerCase())
  );

  const filteredAttendance = attendances.filter((rec) =>
    rec.employeeName.toLowerCase().includes(attendanceSearch.toLowerCase()) ||
    rec.employeeID.toLowerCase().includes(attendanceSearch.toLowerCase()) ||
    rec.date.includes(attendanceSearch)
  );

  const filteredAdmins = admins.filter(a => 
    a.name.toLowerCase().includes(adminSearchQuery.toLowerCase()) || 
    a.email.toLowerCase().includes(adminSearchQuery.toLowerCase()) ||
    a.adminID?.toLowerCase().includes(adminSearchQuery.toLowerCase())
  );

  // Statistics
  const totalActives = filteredEmployees.length;
  const currentCheckedInNow = attendances.filter(a => a.status === AttendanceStatus.CHECKED_IN).length;
  const punctualCount = attendances.filter(a => {
    const checkHour = new Date(a.checkInTime).getHours();
    return checkHour < 9;
  }).length;
  const punctualRate = attendances.length > 0 ? ((punctualCount / attendances.length) * 100).toFixed(0) : '100';

  return (
    <div className="space-y-6 font-sans text-slate-700">
      
      {/* SHARED MODULE HEADLINE INFO FOR EMPLOYEE LOGIN CODES */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-3 gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center">
            <ShieldCheck className="w-5 h-5 text-indigo-600 mr-2" />
            Attendance Management Console
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Logged in as <span className="font-bold text-slate-800">{user.name}</span> ({user.role === UserRole.SUPERADMIN ? 'Super Administrator' : 'Administrator'})
          </p>
        </div>

        {/* TAB GENERATION (Only if logged user is SuperAdmin) */}
        {user.role === UserRole.SUPERADMIN && (
          <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              onClick={() => setActiveTab('console')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${activeTab === 'console' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Manage Employees</span>
            </button>
            <button
              onClick={() => setActiveTab('admins')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${activeTab === 'admins' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Manage Admins</span>
            </button>
          </div>
        )}
      </div>

      {/* RENDER CORE TAB VIEW */}
      {activeTab === 'console' ? (
        <div className="space-y-6">
          {/* 1. STATE HEADLINE STATS CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">Total Employees</p>
                <h3 className="text-lg font-extrabold text-slate-800 mt-1.5 font-sans">{totalActives}</h3>
              </div>
              <span className="inline-flex p-3 rounded-xl bg-indigo-50 text-indigo-600">
                <Users className="w-5 h-5 shrink-0" />
              </span>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">Checked-In Employees</p>
                <h3 className="text-lg font-extrabold text-emerald-700 mt-1.5 font-sans">{currentCheckedInNow}</h3>
              </div>
              <span className="inline-flex p-3 rounded-xl bg-emerald-50 text-emerald-600">
                <Clock className="w-5 h-5 shrink-0" />
              </span>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">Punctuality</p>
                <h3 className="text-lg font-extrabold text-slate-800 mt-1.5 font-sans">{punctualRate}%</h3>
              </div>
              <span className="inline-flex p-3 rounded-xl bg-indigo-50 text-indigo-600">
                <TrendingUp className="w-5 h-5 shrink-0" />
              </span>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">Portal Operations</p>
                <h3 className="text-lg font-extrabold text-slate-850 mt-1.5 font-sans">Online</h3>
              </div>
              <span className="inline-flex p-3 rounded-xl bg-slate-50 text-slate-600">
                <SlidersHorizontal className="w-5 h-5 shrink-0" />
              </span>
            </div>
          </div>

          {/* 2. DYNAMIC QR GENERATOR + REGISTER WORKSPACE STAFF */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* TOKEN AND QR DISPLAY SHARED FOR BOTH ADMIN ROLES */}
            <div className="lg:col-span-1 bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <h3 className="text-xs font-bold tracking-tight uppercase text-slate-400 flex items-center">
                  <QrCode className="h-4 w-4 mr-2 text-indigo-400" />
                  Attendance Workstation Display
                </h3>
                <button
                  onClick={() => triggerNewToken()}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-755 text-slate-300 transition cursor-pointer"
                  title="Force token rotation"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex flex-col items-center py-4 bg-white rounded-xl border border-slate-200 shadow-inner">
                {qrBase64 ? (
                  <img src={qrBase64} alt="Active QR Token" className="w-48 h-48 block" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-48 h-48 bg-slate-50 animate-pulse rounded-md flex items-center justify-center font-mono text-xs text-slate-400 font-semibold uppercase">
                    Generating...
                  </div>
                )}
                
                <div className="text-center mt-3 px-4">
                  <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-widest">Employee Verification Token</span>
                  <span className="block text-3xl font-mono font-black text-slate-900 tracking-widest mt-1">
                    {activeToken ? activeToken.tokenValue : '------'}
                  </span>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Security expiration countdown:</span>
                  <span className="font-mono font-bold text-indigo-400 animate-pulse">{timeLeft} s</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
                  <div className="bg-indigo-500 h-full transition-all duration-1000" style={{ width: `${(timeLeft / 60) * 100}%` }} />
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed font-sans text-center">
                  QR code and token refreshed automatically every 60 seconds.
                </p>
              </div>
            </div>

            {/* REGISTER STAFF - INTEGRATED WITH EMAIL ENGINE */}
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
                  <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center">
                    <PlusCircle className="h-4.5 w-4.5 mr-2 text-indigo-600" />
                    Register New Employee
                  </h3>
                </div>

                {formError && (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-xs font-semibold mb-4 animate-pulse">
                    {formError}
                  </div>
                )}
                {formSuccess && (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold mb-4">
                    {formSuccess}
                  </div>
                )}

                <form onSubmit={handleCreateEmployee} className="grid grid-cols-2 gap-4 text-xs font-sans">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Employee ID</label>
                    <input
                      type="text"
                      required
                      value={newEmpID}
                      onChange={(e) => setNewEmpID(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500 text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Employee Full Name</label>
                    <input
                      type="text"
                      required
                      value={newEmpName}
                      onChange={(e) => setNewEmpName(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500 text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Employee Email</label>
                    <input
                      type="email"
                      required
                      value={newEmpEmail}
                      onChange={(e) => setNewEmpEmail(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500 text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Employee Phone</label>
                    <input
                      type="text"
                      required
                      value={newEmpPhone}
                      onChange={(e) => setNewEmpPhone(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500 text-slate-800"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Temporary Initial Password</label>
                    <input
                      type="text"
                      required
                      value={newEmpPass}
                      onChange={(e) => setNewEmpPass(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500 text-slate-800 font-mono"
                    />
                  </div>

                  <div className="col-span-2 pt-2">
                    <button
                      type="submit"
                      id="admin-submit-employee-btn"
                      className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold tracking-wider uppercase transition cursor-pointer shadow-xs"
                    >
                      Register New Employee
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* 3. DEVICE VERIFICATION (STAFF ACCOUNTS OVERVIEW) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 mb-4 gap-4">
              <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center">
                <Users className="h-4.5 w-4.5 mr-2 text-indigo-600" />
                Staff List
              </h3>

              <div className="relative max-w-xs w-full">
                <input
                  type="text"
                  placeholder="Search by name, ID, or email..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="w-full text-xs py-2 pl-9 pr-4 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 text-slate-800"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs" id="admin-employee-table">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 animate-none">Employee ID</th>
                    <th className="py-3 px-4 h-auto">Employee Details</th>
                    <th className="py-3 px-4 h-auto">Contact Details</th>
                    <th className="py-3 px-4 text-center">Employee Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400 font-semibold bg-slate-50/50">No staff matching criteria located.</td>
                    </tr>
                  ) : (
                    filteredEmployees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-850">{emp.employeeID || 'N/A'}</td>
                        <td className="py-3 px-4">
                          <span className="block font-bold text-slate-800">{emp.name}</span>
                          <span className="block text-slate-400 text-[10px] mt-0.5">{emp.email}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="block font-mono text-slate-600">{emp.phone}</span>
                        </td>
                        
                        {/* DROPDOWN IN PLACE OF STATUS SPAN FOR IMMEDIATELY UPDATED STATUS */}
                        <td className="py-3 px-4 text-center">
                          <select
                            value={emp.status}
                            onChange={async (e) => {
                              const nextStatus = e.target.value as AccountStatus;
                              await database.changeUserStatus(emp.id, emp.role, nextStatus);
                              fetchSystemEntities();
                              onRefreshAllData();
                            }}
                            className={`px-2 py-1 rounded text-[10px] font-bold border cursor-pointer focus:outline-none ${emp.status === AccountStatus.ACTIVE ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}
                          >
                            <option value={AccountStatus.ACTIVE}>Active</option>
                            <option value={AccountStatus.DISABLED}>Disabled</option>
                          </select>
                        </td>

                        {/* ACTIONS COLUMN - ADDED DETAILS AND REMOVED ACTIVE TOGGLE */}
                        <td className="py-3 px-4 text-right space-x-1">
                          <button
                            type="button"
                            onClick={() => setEditingEmployee(emp)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-bold text-slate-755 transition cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedEmployeeForLogs(emp)}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold transition cursor-pointer"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. ATTENDANCE HISTORICAL DIRECTORY LOGS */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 mb-4 gap-4">
              <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center">
                <FileSpreadsheet className="h-4.5 w-4.5 mr-2 text-indigo-600" />
                Attendance List
              </h3>

              <div className="relative max-w-xs w-full">
                <input
                  type="text"
                  placeholder="Search by Employee/Date..."
                  value={attendanceSearch}
                  onChange={(e) => setAttendanceSearch(e.target.value)}
                  className="w-full text-xs py-2 pl-9 pr-4 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 text-slate-800"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs" id="admin-attendance-records-table">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 animate-none">Employee</th>
                    <th className="py-3 px-4 h-auto">Shift Date</th>
                    <th className="py-3 px-4 h-auto">Check-In Time</th>
                    <th className="py-3 px-4 h-auto">Check-Out Time</th>
                    <th className="py-3 px-4 h-auto">Shift Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-720 text-slate-700">
                  {filteredAttendance.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400 font-semibold bg-slate-50/50">No shift records returned.</td>
                    </tr>
                  ) : (
                    filteredAttendance.map((rec) => {
                      const calculateHours = (att: Attendance) => {
                        if (!att.checkOutTime) return '-';
                        const hrs = (new Date(att.checkOutTime).getTime() - new Date(att.checkInTime).getTime()) / (1000 * 60 * 60);
                        return `${hrs.toFixed(1)} hrs`;
                      };
                      return (
                        <tr key={rec.id} className="hover:bg-slate-50 transition">
                          <td className="py-3.5 px-4 font-bold text-slate-850">
                            {rec.employeeName}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-700">{rec.date}</td>
                          <td className="py-3.5 px-4 font-mono text-slate-505 text-slate-650">
                            {new Date(rec.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-650">
                            {rec.checkOutTime ? (
                              new Date(rec.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                            ) : (
                              <span className="bg-indigo-50 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded text-[10px] animate-pulse">In Session</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-semibold">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${rec.status === AttendanceStatus.CHECKED_OUT ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700 animate-pulse'}`}>
                              {rec.status === AttendanceStatus.CHECKED_OUT ? 'Complete' : 'In Session'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => openRecordAmendment(rec)}
                              className="px-2 py-1 bg-stone-100 hover:bg-stone-200 rounded text-[10px] font-bold text-stone-700 transition cursor-pointer inline-block"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (window.confirm(`Are you sure you want to delete the attendance log for ${rec.employeeName}?`)) {
                                  try {
                                    await database.deleteAttendanceRecord(rec.id);
                                    fetchSystemEntities();
                                    onRefreshAllData();
                                  } catch (err) {
                                    console.error("Delete failed", err);
                                  }
                                }
                              }}
                              className="ml-1.5 px-2 py-1 bg-red-100 hover:bg-red-200 rounded text-[10px] font-bold text-red-700 transition cursor-pointer inline-block"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* TAB 2: MANAGE ADMINISTRATORS (ONLY RENDERED FOR SUPERADMIN) */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          
          {/* CREATE REGISTER ADMINS FORM */}
          <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center mb-4">
              <PlusCircle className="h-5 w-5 mr-2 text-indigo-600" />
              Register New Administrators
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Create new administrator accounts. The system automatically creates temporary passwords and sends registration details to the administrator's email.
            </p>

            {adminFormError && (
              <div className="p-3 bg-red-50 border border-red-150 text-red-700 text-xs rounded-lg font-semibold mb-4 animate-pulse">
                {adminFormError}
              </div>
            )}

            {adminFormSuccess && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold mb-4 leading-relaxed">
                {adminFormSuccess}
              </div>
            )}

            <form onSubmit={handleRegisterAdmin} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Administrator Name</label>
                <input
                  type="text"
                  required
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500 text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Administrator Email</label>
                <input
                  type="email"
                  required
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500 text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Administrator Phone Number</label>
                <input
                  type="text"
                  required
                  value={newAdminPhone}
                  onChange={(e) => setNewAdminPhone(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500 text-slate-800 animate-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-lg bg-slate-800 hover:bg-slate-900 text-xs font-bold font-sans uppercase tracking-wider text-white transition flex items-center justify-center space-x-2 cursor-pointer shadow-sm"
              >
                <Sliders className="h-4 w-4 shrink-0 text-indigo-400" />
                <span>Register New Administrator</span>
              </button>
            </form>
          </div>

          {/* VIEW ADMINISTRATOR LIST TABLE */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 mb-4 gap-4">
              <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center">
                <ShieldCheck className="h-5 w-5 mr-2 text-indigo-600 animate-none" />
                Administrators List
              </h3>

              <div className="relative max-w-xs w-full">
                <input
                  type="text"
                  value={adminSearchQuery}
                  onChange={(e) => setAdminSearchQuery(e.target.value)}
                  placeholder="Search administrators..."
                  className="w-full text-xs py-2 pl-9 pr-4 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 text-slate-800"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs" id="superadmin-admin-table">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Administrator ID</th>
                    <th className="py-3 px-4">Administrator Details</th>
                    <th className="py-3 px-4">Administrator Phone</th>
                    <th className="py-3 px-4 text-center">Account Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredAdmins.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400 font-semibold bg-slate-50/50">No administrators registered.</td>
                    </tr>
                  ) : (
                    filteredAdmins.map((adm) => (
                      <tr key={adm.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">{adm.adminID || 'N/A'}</td>
                        <td className="py-3 px-4">
                          <span className="block font-bold text-slate-800">{adm.name}</span>
                          <span className="block text-slate-400 text-[10px] mt-0.5">{adm.email}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-slate-500">{adm.phone}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <select
                            value={adm.status}
                            onChange={async (e) => {
                              const nextStatus = e.target.value as AccountStatus;
                              await database.changeUserStatus(adm.id, adm.role, nextStatus);
                              fetchSystemEntities();
                              onRefreshAllData();
                            }}
                            className={`px-2 py-1 rounded-md text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 border border-slate-200 cursor-pointer ${adm.status === AccountStatus.ACTIVE ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}
                          >
                            <option value={AccountStatus.ACTIVE} className="bg-white text-slate-800">ACTIVE</option>
                            <option value={AccountStatus.DISABLED} className="bg-white text-slate-800">DISABLED</option>
                          </select>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1">
                          <button
                            type="button"
                            onClick={() => setEditingAdmin(adm)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-bold text-slate-700 transition cursor-pointer"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- ALL POPUPS AND DIALOG BOXES --- */}
      <AnimatePresence>
        
        {/* POPUP: SMTP EMAIL DISPATCH AND SANDBOX SIMULATOR VERIFICATION OVERVIEW */}
        {dispatchEmail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 text-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative"
            >
              <div className="bg-slate-850 p-4 border-b border-slate-800 flex items-center justify-between">
                <span className="flex items-center space-x-2 text-xs font-bold text-slate-200">
                  <span className={`h-2 w-2 rounded-full ${dispatchEmail.smtpSuccess ? 'bg-emerald-500' : 'bg-amber-500 animate-ping'}`} />
                  <span>{dispatchEmail.smtpSuccess ? 'SMTP TRANSMISSION SUCCESSFUL' : 'SMTP GATE CREDENTIAL FALLBACK SIMULATOR'}</span>
                </span>
                <button 
                  onClick={() => setDispatchEmail(null)}
                  className="text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  ✕ Close Gate
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-12 gap-2 text-xs border-b border-slate-800 pb-3">
                  <span className="col-span-2 text-slate-500 font-bold uppercase">SENDER</span>
                  <span className="col-span-10 text-slate-300 font-mono">smtp@attendance-secure.corp.com</span>
                  
                  <span className="col-span-2 text-slate-500 font-bold uppercase">RECEIVER</span>
                  <span className="col-span-10 text-slate-200 font-bold font-mono">{dispatchEmail.to}</span>
                  
                  <span className="col-span-2 text-slate-500 font-bold uppercase">SUBJECT</span>
                  <span className="col-span-10 text-indigo-400 font-bold font-sans">{dispatchEmail.subject}</span>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
                  <pre className="text-[11px] text-slate-300 font-sans whitespace-pre-wrap leading-relaxed">{dispatchEmail.body}</pre>
                </div>

                {dispatchEmail.smtpSuccess ? (
                  <div className="bg-emerald-950/40 p-3 rounded-lg border border-emerald-900/60 text-[11px] text-emerald-200 flex items-start space-x-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
                    <span>
                      The registration alert email containing the security keys was delivered successfully.
                    </span>
                  </div>
                ) : (
                  <div className="bg-indigo-950/40 p-3 rounded-lg border border-indigo-900/60 text-[11px] text-indigo-200 flex items-start space-x-2">
                    <Sparkles className="h-4 w-4 shrink-0 mt-0.5 text-indigo-400" />
                    <span>
                      <strong>Credential Fallback Active:</strong> Gmail SMTP was unconfigured or returned an allocation warning ({dispatchEmail.errorText || 'credentials unset'}). Print credentials modal is generated above for user copy reference safely. Declare `SMTP_USER` and `SMTP_PASS` in Settings/Env vars to enable live deliverability.
                    </span>
                  </div>
                )}
              </div>

              <div className="bg-slate-850 px-6 py-4 flex justify-end">
                <button
                  onClick={() => setDispatchEmail(null)}
                  id="smtp-modal-ack"
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs font-sans transition cursor-pointer"
                >
                  Acknowledge Dispatch
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* POPUP: EMPLOYEE DETAILED ATTENDANCE LOGS HISTORY */}
        {selectedEmployeeForLogs && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-6 rounded-2xl border max-w-2xl w-full"
            >
              <div className="flex items-center justify-between border-b pb-3 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Attendance Logs History</h3>
                  <p className="text-xs text-slate-500 mt-1">Showing logged clock records for <span className="font-bold text-indigo-600">{selectedEmployeeForLogs.name}</span> ({selectedEmployeeForLogs.employeeID})</p>
                </div>
                <button
                  onClick={() => setSelectedEmployeeForLogs(null)}
                  className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer font-bold p-1"
                >
                  ✕
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 sticky top-0 md:bg-slate-50">
                    <tr>
                      <th className="py-2.5 px-4">Shift Date</th>
                      <th className="py-2.5 px-4 h-auto">Check-In</th>
                      <th className="py-2.5 px-4 h-auto">Check-Out</th>
                      <th className="py-2.5 px-4 h-auto">Duration</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {attendances.filter(a => a.employeeID === selectedEmployeeForLogs.id).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 font-semibold bg-slate-50/50">
                          No registered check-in or check-out cycles logged to port.
                        </td>
                      </tr>
                    ) : (
                      attendances.filter(a => a.employeeID === selectedEmployeeForLogs.id).map((rec) => {
                        const calculateHours = (att: Attendance) => {
                          if (!att.checkOutTime) return '-';
                          const hrs = (new Date(att.checkOutTime).getTime() - new Date(att.checkInTime).getTime()) / (1000 * 60 * 60);
                          return `${hrs.toFixed(1)} hrs`;
                        };
                        return (
                          <tr key={rec.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-3 px-4 font-bold text-slate-800">{rec.date}</td>
                            <td className="py-3 px-4 font-mono text-slate-600">
                              {new Date(rec.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-600">
                              {rec.checkOutTime ? (
                                new Date(rec.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                              ) : (
                                <span className="bg-indigo-50 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded text-[10px] animate-pulse">In Session</span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-500 font-mono">
                              {calculateHours(rec)}
                            </td>
                            <td className="py-3 px-4 text-center font-semibold">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] ${rec.status === AttendanceStatus.CHECKED_OUT ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700 animate-pulse'}`}>
                                {rec.status === AttendanceStatus.CHECKED_OUT ? 'Complete' : 'In Session'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* <div className="flex justify-end pt-4 mt-4 border-t border-slate-100">
                <button
                  onClick={() => setSelectedEmployeeForLogs(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-700 transition cursor-pointer"
                >
                  Dismiss Details
                </button>
              </div> */}
            </motion.div>
          </div>
        )}

        {/* MODAL: AMEND EMPLOYEE PROFILE */}
        {editingEmployee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-6 rounded-2xl border max-w-md w-full"
            >
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-3">Edit Employee Profile</h3>
              <form onSubmit={handleUpdateEmployee} className="space-y-4 mt-4 text-xs font-sans">
                <div>
                  <label className="block text-slate-500 font-bold uppercase mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editingEmployee.name}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-xs font-bold text-slate-805 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-bold uppercase mb-1">Contact Phone</label>
                  <input
                    type="text"
                    required
                    value={editingEmployee.phone}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-xs text-slate-800"
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingEmployee(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-md font-bold text-slate-700 cursor-pointer"
                  >
                    Discard Changes
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-md font-bold text-white shadow-sm cursor-pointer"
                  >
                    Update Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* MODAL: AMEND ADMINISTRATOR PROFILE (SUPERADMIN ONLY) */}
        {editingAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-6 rounded-2xl border max-w-md w-full"
            >
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-3">Edit Administrator Details</h3>
              <form onSubmit={handleUpdateAdminProfile} className="space-y-4 mt-4 text-xs font-sans">
                <div>
                  <label className="block text-slate-500 font-bold uppercase mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editingAdmin.name}
                    onChange={(e) => setEditingAdmin({ ...editingAdmin, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-xs font-bold text-slate-805 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-bold uppercase mb-1">Contact Phone</label>
                  <input
                    type="text"
                    required
                    value={editingAdmin.phone}
                    onChange={(e) => setEditingAdmin({ ...editingAdmin, phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-xs text-slate-800"
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingAdmin(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-md font-bold text-slate-700 cursor-pointer"
                  >
                    Discard Changes
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-md font-bold text-white shadow-sm cursor-pointer"
                  >
                    Update Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* MODAL: AMEND ATTENDANCE TIMESTAMPS */}
        {editingRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-6 rounded-2xl border max-w-md w-full"
            >
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-3">Edit Attendance Timestamps</h3>
              <form onSubmit={handleSaveRecordEdits} className="space-y-4 mt-4 text-xs font-sans">
                <div>
                  <label className="block text-slate-500 font-bold uppercase mb-1">Check-In Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={editCheckIn}
                    onChange={(e) => setEditCheckIn(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg font-mono text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-bold uppercase mb-1">Check-Out Time</label>
                  <input
                    type="datetime-local"
                    value={editCheckOut}
                    onChange={(e) => setEditCheckOut(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg font-mono text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-slate-505 text-slate-500 font-bold uppercase mb-1">Current Session Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as AttendanceStatus)}
                    className="w-full px-3 py-2 border rounded-lg font-bold text-slate-805 text-slate-800"
                  >
                    <option value={AttendanceStatus.CHECKED_IN}>In Session (Checked-In)</option>
                    <option value={AttendanceStatus.CHECKED_OUT}>Complete (Checked-Out)</option>
                  </select>
                </div>
                <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingRecord(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-md font-bold text-slate-700 cursor-pointer"
                  >
                    Discard Changes
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-md font-bold text-white shadow-sm cursor-pointer"
                  >
                    Update Changes
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

// Additional helpers
interface CheckCircle2Props extends React.SVGProps<SVGSVGElement> {
  className?: string;
}
function CheckCircle2(props: CheckCircle2Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      {...props}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
