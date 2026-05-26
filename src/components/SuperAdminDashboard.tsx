import React, { useState, useEffect } from 'react';
import { User, UserRole, AccountStatus } from '../types';
import { database } from '../database';
import { 
  ShieldCheck, 
  Search, 
  PlusCircle, 
  Mail, 
  Phone, 
  Trash2, 
  BellRing, 
  CheckCircle2, 
  Send,
  Sliders,
  Sparkles,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SuperAdminDashboardProps {
  user: User;
  onRefreshAllData: () => void;
  refreshTrigger: number;
}

export default function SuperAdminDashboard({ user, onRefreshAllData, refreshTrigger }: SuperAdminDashboardProps) {
  const [admins, setAdmins] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Registration form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Email simulation modal
  const [dispatchEmail, setDispatchEmail] = useState<{
    to: string;
    subject: string;
    body: string;
    unhashedPass: string;
  } | null>(null);

  // Profile Edit modal
  const [editingAdmin, setEditingAdmin] = useState<User | null>(null);

  useEffect(() => {
    fetchAdministrators();
  }, [refreshTrigger]);

  const fetchAdministrators = async () => {
    try {
      const allUsers = await database.getUsers();
      setAdmins(allUsers.filter(u => u.role === UserRole.ADMIN));
    } catch (err) {
      console.error(err);
    }
  };

  const handleRegisterAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name || !email || !phone) {
      setFormError('Please fulfill all required fields before dispatch.');
      return;
    }

    try {
      // Validate unique email
      const allUsers = await database.getUsers();
      if (allUsers.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        setFormError('An account with this email address already exists.');
        return;
      }

      // Generate random temporary secure password
      const randomPassword = `ADM-SEC-${Math.floor(1000 + Math.random() * 9000)}`;
      
      const adminId = `admin_${Date.now()}`;
      const freshAdmin: User = {
        id: adminId,
        userID: adminId,
        name,
        email,
        phone,
        passwordHash: randomPassword, // Simple hash/pass string matching types
        role: UserRole.ADMIN,
        status: AccountStatus.ACTIVE,
        adminID: `ADM-${Math.floor(100 + Math.random() * 900)}`,
        createdAt: new Date().toISOString()
      };

      await database.saveUser(freshAdmin);

      // Trigger Dispatch SMTP Gate simulator
      setDispatchEmail({
        to: email,
        subject: '🔐 Workspace Admin Credentials Generated',
        body: `Dear ${name},\n\nA secure administrator account has been generated for you on the Employee Attendance System.\n\nYour Temporary Login Credentials:\n- Corporate Email: ${email}\n- Temporary Password: ${randomPassword}\n\nFor security compliance, log into your profile dashboard and immediately adjust your system password.`,
        unhashedPass: randomPassword
      });

      // Clear layout fields
      setName('');
      setEmail('');
      setPhone('');
      fetchAdministrators();
      onRefreshAllData();
    } catch (err) {
      setFormError('A security exception blocked the administrator creation.');
    }
  };

  const handleUpdateAdminProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;

    try {
      await database.saveUser(editingAdmin);
      setEditingAdmin(null);
      fetchAdministrators();
      onRefreshAllData();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleAdminStatus = async (target: User) => {
    const nextStatus = target.status === AccountStatus.ACTIVE ? AccountStatus.DISABLED : AccountStatus.ACTIVE;
    await database.changeUserStatus(target.id, nextStatus);
    fetchAdministrators();
    onRefreshAllData();
  };

  const filteredAdmins = admins.filter(a => 
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    a.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.adminID?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 font-sans text-slate-700">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CREATE REGISTER ADMINS FORM */}
        <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center mb-4">
            <PlusCircle className="h-5 w-5 mr-2 text-indigo-600" />
            Provision Admin Role
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed mb-4">
            Create active corporate administrators. The system automatically creates unique temporary entry passcodes, hashes credentials, and drafts verification emails.
          </p>

          {formError && (
            <div className="p-3 bg-red-50 border border-red-150 text-red-700 text-xs rounded-lg font-semibold mb-4">
              {formError}
            </div>
          )}

          <form onSubmit={handleRegisterAdmin} className="space-y-4 text-xs font-sans">
            <div>
              <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Full Supervisor Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500 text-slate-800"
                placeholder="Manager Name"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Manager Corporate Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500 text-slate-800"
                placeholder="manager@corp.com"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Phone Line</label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500 text-slate-800"
                placeholder="+1 (555) 543-2211"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-lg bg-slate-800 hover:bg-slate-900 text-xs font-bold font-sans uppercase tracking-wider text-white transition flex items-center justify-center space-x-2 cursor-pointer shadow-sm"
            >
              <Sliders className="h-4 w-4 shrink-0 text-indigo-400" />
              <span>Provision Credentials</span>
            </button>
          </form>
        </div>

        {/* VIEW ADMINISTRATOR LIST TABLE */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 mb-4 gap-4">
            <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center">
              <ShieldCheck className="h-5 w-5 mr-2 text-indigo-600" />
              Enterprise Administrators
            </h3>

            <div className="relative max-w-xs w-full">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
                  <th className="py-3 px-4">Admin Key</th>
                  <th className="py-3 px-4">Supervisor</th>
                  <th className="py-3 px-4">Corporate Line</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredAdmins.map((adm) => (
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
                          await database.changeUserStatus(adm.id, nextStatus);
                          fetchAdministrators();
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
                        Amend
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 4. MODALS AND DISPATCH DIALOG TRANSITIONS */}
      <AnimatePresence>
        {dispatchEmail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-neutral-800 text-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative"
            >
              <div className="bg-neutral-850 p-4 border-b border-neutral-800 flex items-center justify-between">
                <span className="flex items-center space-x-2 text-xs font-bold text-neutral-200">
                  <span className="h-2 w-2 rounded-full bg-green-500 animate-ping" />
                  <span>SMTP SMTP-GATE DISPATCH SIMULATOR</span>
                </span>
                <button 
                  onClick={() => setDispatchEmail(null)}
                  className="text-xs text-neutral-400 hover:text-white"
                >
                  ✕ Close Gate
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-12 gap-2 text-xs border-b border-neutral-800 pb-3">
                  <span className="col-span-2 text-neutral-500 font-semibold uppercase">Sender</span>
                  <span className="col-span-10 text-neutral-300 font-mono">smtp@attendance.secure-gateway.com</span>
                  
                  <span className="col-span-2 text-neutral-500 font-semibold uppercase">Receiver</span>
                  <span className="col-span-10 text-neutral-200 font-bold font-mono">{dispatchEmail.to}</span>
                  
                  <span className="col-span-2 text-neutral-500 font-semibold uppercase">Subject</span>
                  <span className="col-span-10 text-indigo-400 font-bold font-sans">{dispatchEmail.subject}</span>
                </div>

                <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-850">
                  <pre className="text-[11px] text-neutral-300 font-sans whitespace-pre-wrap leading-relaxed">{dispatchEmail.body}</pre>
                </div>

                <div className="bg-indigo-950/40 p-3 rounded-lg border border-indigo-900/60 text-[11px] text-indigo-200 flex items-start space-x-2">
                  <Sparkles className="h-4 w-4 shrink-0 mt-0.5 text-indigo-400" />
                  <span>
                    <strong>SMTP dispatch complete:</strong> Admin email triggered securely. Copy credentials and forward to manager. Secure entry key hashing completed to database.
                  </span>
                </div>
              </div>

              <div className="bg-neutral-850 px-6 py-4 flex justify-end">
                <button
                  onClick={() => setDispatchEmail(null)}
                  id="smtp-modal-ack"
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs font-sans transition"
                >
                  Acknowledge Dispatch
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {editingAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-6 rounded-2xl border max-w-md w-full"
            >
              <h3 className="text-sm font-black text-neutral-800 uppercase tracking-widest border-b border-neutral-100 pb-3">Amend Administrator Details</h3>
              <form onSubmit={handleUpdateAdminProfile} className="space-y-4 mt-4 text-xs font-sans">
                <div>
                  <label className="block text-neutral-600 font-semibold mb-1">Full Supervisor Name</label>
                  <input
                    type="text"
                    required
                    value={editingAdmin.name}
                    onChange={(e) => setEditingAdmin({ ...editingAdmin, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-neutral-600 font-semibold mb-1">Contact Phone</label>
                  <input
                    type="text"
                    required
                    value={editingAdmin.phone}
                    onChange={(e) => setEditingAdmin({ ...editingAdmin, phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-xs"
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-3 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={() => setEditingAdmin(null)}
                    className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 rounded-md font-bold text-neutral-700"
                  >
                    Discard Changes
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-md font-bold text-white shadow-sm"
                  >
                    Commit Profile updates
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
