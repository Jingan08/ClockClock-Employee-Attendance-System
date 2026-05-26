import { User, UserRole, AccountStatus, Attendance, AttendanceStatus, QRToken } from './types';
import { auth, db, isFirebaseConfigured, handleFirestoreError, OperationType } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy, 
  limit 
} from 'firebase/firestore';

// Seed initial data to populate localStorage if not present
const SEED_ADMINS: User[] = [
  {
    id: 'superadmin_uid',
    userID: 'superadmin_uid',
    name: 'Sarah Jenkins',
    email: 'superadmin@attendance.com',
    phone: '+1 (555) 720-3344',
    passwordHash: 'superpassword', // Simplification for sandbox demo
    role: UserRole.SUPERADMIN,
    status: AccountStatus.ACTIVE,
    createdAt: '2026-01-10T08:00:00Z',
  },
  {
    id: 'admin_uid_101',
    userID: 'admin_uid_101',
    name: 'Robert Carter',
    email: 'admin@attendance.com',
    phone: '+1 (555) 831-4455',
    passwordHash: 'adminpassword',
    role: UserRole.ADMIN,
    status: AccountStatus.ACTIVE,
    adminID: 'ADM-101',
    createdAt: '2026-02-15T09:30:00Z',
  }
];

const SEED_EMPLOYEES: User[] = [
  {
    id: 'employee_uid_204',
    userID: 'employee_uid_204',
    name: 'Jane Doe',
    email: 'employee@attendance.com',
    phone: '+1 (555) 432-1100',
    passwordHash: 'employeepassword',
    role: UserRole.EMPLOYEE,
    status: AccountStatus.ACTIVE,
    employeeID: 'EMP-204',
    createdAt: '2026-03-01T08:15:00Z',
  },
  {
    id: 'employee_uid_305',
    userID: 'employee_uid_305',
    name: 'John Smith',
    email: 'john@attendance.com',
    phone: '+1 (555) 123-4567',
    passwordHash: 'password123',
    role: UserRole.EMPLOYEE,
    status: AccountStatus.ACTIVE,
    employeeID: 'EMP-305',
    createdAt: '2026-03-05T10:00:00Z',
  },
  {
    id: 'employee_uid_102',
    userID: 'employee_uid_102',
    name: 'David Miller',
    email: 'david@attendance.com',
    phone: '+1 (555) 999-8888',
    passwordHash: 'password123',
    role: UserRole.EMPLOYEE,
    status: AccountStatus.DISABLED,
    employeeID: 'EMP-102',
    createdAt: '2026-03-12T11:20:00Z',
  }
];

const SEED_ATTENDANCE: Attendance[] = [
  {
    id: 'att_24_01',
    attendanceID: 'att_24_01',
    employeeID: 'employee_uid_204',
    employeeName: 'Jane Doe',
    date: '2026-05-24',
    checkInTime: '2026-05-24T08:45:12Z',
    checkOutTime: '2026-05-24T17:15:00Z',
    status: AttendanceStatus.CHECKED_OUT,
  },
  {
    id: 'att_24_02',
    attendanceID: 'att_24_02',
    employeeID: 'employee_uid_305',
    employeeName: 'John Smith',
    date: '2026-05-24',
    checkInTime: '2026-05-24T09:12:30Z',
    checkOutTime: '2026-05-24T18:00:00Z',
    status: AttendanceStatus.CHECKED_OUT,
  },
  {
    id: 'att_25_01',
    attendanceID: 'att_25_01',
    employeeID: 'employee_uid_204',
    employeeName: 'Jane Doe',
    date: '2026-05-25',
    checkInTime: '2026-05-25T08:55:00Z',
    checkOutTime: '2026-05-25T17:05:44Z',
    status: AttendanceStatus.CHECKED_OUT,
  },
  {
    id: 'att_25_02',
    attendanceID: 'att_25_02',
    employeeID: 'employee_uid_305',
    employeeName: 'John Smith',
    date: '2026-05-25',
    checkInTime: '2026-05-25T08:50:20Z',
    checkOutTime: '2026-05-25T17:30:15Z',
    status: AttendanceStatus.CHECKED_OUT,
  }
];

// Initialize local variables to act as cached store or core database if Firebase is unconfigured
function initializeLocalStore() {
  if (!localStorage.getItem('eas_admins')) {
    localStorage.setItem('eas_admins', JSON.stringify(SEED_ADMINS));
  }
  if (!localStorage.getItem('eas_employees')) {
    localStorage.setItem('eas_employees', JSON.stringify(SEED_EMPLOYEES));
  }
  // remove old users cache if it exists to keep sandbox clean
  if (localStorage.getItem('eas_users')) {
    localStorage.removeItem('eas_users');
  }
  if (!localStorage.getItem('eas_attendance')) {
    localStorage.setItem('eas_attendance', JSON.stringify(SEED_ATTENDANCE));
  }
  if (!localStorage.getItem('eas_qr_tokens')) {
    // Generate an initial QR code token active right now
    const now = new Date();
    const expiry = new Date(now.getTime() + 60000);
    const initialToken: QRToken = {
      id: 'token_init_id',
      tokenID: 'token_init_id',
      tokenValue: '382941',
      qrCodeValue: 'EAS-ATTENDANCE-ACTIVE-QR-TOKEN-INIT',
      createdTime: now.toISOString(),
      expiryTime: expiry.toISOString(),
    };
    localStorage.setItem('eas_qr_tokens', JSON.stringify([initialToken]));
  }
}

// Call to pre-seed localStorage
initializeLocalStore();

async function getCurrentUserRole(): Promise<string | null> {
  if (auth?.currentUser) {
    const cachedAdmins = JSON.parse(localStorage.getItem('eas_admins') || '[]');
    const cachedEmployees = JSON.parse(localStorage.getItem('eas_employees') || '[]');
    const cachedUsers = [...cachedAdmins, ...cachedEmployees];
    const cached = cachedUsers.find((u: any) => u.id === auth.currentUser!.uid || u.userID === auth.currentUser!.uid);
    if (cached) {
      return cached.role;
    }
    try {
      let userDoc = await getDoc(doc(db, 'employees', auth.currentUser.uid));
      if (!userDoc.exists()) {
        userDoc = await getDoc(doc(db, 'admins', auth.currentUser.uid));
      }
      if (userDoc.exists()) {
        return userDoc.data()?.role || null;
      }
    } catch (err) {
      console.warn("Failed to reach Firestore for role check, falling back to offline user records:", err);
    }
  }
  return null;
}

export const database = {
  // --- USERS SECTION ---
  async loginWithCredentials(email: string, passwordHash: string): Promise<User | null> {
    if (isFirebaseConfigured && auth && db) {
      try {
        let userCredential;
        try {
          // 1. Try to sign in via Firebase Auth
          userCredential = await signInWithEmailAndPassword(auth, email, passwordHash);
        } catch (authErr: any) {
          console.warn("Firebase Auth sign-in failed. Checking seeded/registered database match to bootstrap...", authErr);
          
          if (authErr && (authErr.code === 'auth/operation-not-allowed' || authErr.message?.includes('operation-not-allowed'))) {
            const errObj = new Error("Firebase Authentication Email/Password provider is disabled.");
            (errObj as any).code = 'auth/operation-not-allowed';
            throw errObj;
          }
          
          // Access cached localUsers to authenticate and bootstrap in Firebase
          const localAdmins = JSON.parse(localStorage.getItem('eas_admins') || '[]');
          const localEmployees = JSON.parse(localStorage.getItem('eas_employees') || '[]');
          const localUsers = [...localAdmins, ...localEmployees];
          const seededUser = localUsers.find(
            (u: any) => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === passwordHash
          );

          if (seededUser) {
            try {
              // 2. Register user in Firebase Auth
              userCredential = await createUserWithEmailAndPassword(auth, email, passwordHash);
            } catch (regErr: any) {
              if (regErr && (regErr.code === 'auth/operation-not-allowed' || regErr.message?.includes('operation-not-allowed'))) {
                const errObj = new Error("Firebase Authentication Email/Password provider is disabled.");
                (errObj as any).code = 'auth/operation-not-allowed';
                throw errObj;
              }
              throw regErr;
            }
            const firebaseUser = userCredential.user;

            // 3. Create profile document in Firestore using their permanent Auth uid
            const finalizedProfile: User = {
              ...seededUser,
              id: firebaseUser.uid,
              userID: firebaseUser.uid,
            };
            const col = finalizedProfile.role === UserRole.EMPLOYEE ? 'employees' : 'admins';
            await setDoc(doc(db, col, firebaseUser.uid), finalizedProfile);

            // Update local storage representation so UIDs are aligned
            if (finalizedProfile.role === UserRole.EMPLOYEE) {
              const updatedLocal = localEmployees.map((u: User) => 
                u.email.toLowerCase() === email.toLowerCase() ? finalizedProfile : u
              );
              localStorage.setItem('eas_employees', JSON.stringify(updatedLocal));
            } else {
              const updatedLocal = localAdmins.map((u: User) => 
                u.email.toLowerCase() === email.toLowerCase() ? finalizedProfile : u
              );
              localStorage.setItem('eas_admins', JSON.stringify(updatedLocal));
            }

            return finalizedProfile;
          } else {
            throw new Error("Invalid email or password.");
          }
        }

        // 4. Return user profile from Firestore using real authenticated UID
        const firebaseUser = userCredential.user;
        let userDoc = await getDoc(doc(db, 'employees', firebaseUser.uid));
        if (!userDoc.exists()) {
          userDoc = await getDoc(doc(db, 'admins', firebaseUser.uid));
        }

        if (userDoc.exists()) {
          return userDoc.data() as User;
        } else {
          // Fallback if profile doc is missing in Firestore, sync from local cache
          const localAdmins = JSON.parse(localStorage.getItem('eas_admins') || '[]');
          const localEmployees = JSON.parse(localStorage.getItem('eas_employees') || '[]');
          const localUsers = [...localAdmins, ...localEmployees];
          const localUser = localUsers.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
          if (localUser) {
            const restoredProfile: User = {
              ...localUser,
              id: firebaseUser.uid,
              userID: firebaseUser.uid,
            };
            const col = restoredProfile.role === UserRole.EMPLOYEE ? 'employees' : 'admins';
            await setDoc(doc(db, col, firebaseUser.uid), restoredProfile);
            return restoredProfile;
          }
          throw new Error("System configuration integrity verification failed: Firestore profile doc missing.");
        }
      } catch (err: any) {
        console.error("Login verification gateway exception:", err);
        throw err;
      }
    } else {
      // Direct LocalStorage fallback (offline mode)
      const localAdmins = JSON.parse(localStorage.getItem('eas_admins') || '[]');
      const localEmployees = JSON.parse(localStorage.getItem('eas_employees') || '[]');
      const localUsers = [...localAdmins, ...localEmployees];
      const matched = localUsers.find(
        (u: any) => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === passwordHash
      );
      return matched || null;
    }
  },

  async getUsers(): Promise<User[]> {
    if (isFirebaseConfigured && db) {
      try {
        const empSnapshot = await getDocs(collection(db, 'employees'));
        const adminSnapshot = await getDocs(collection(db, 'admins'));
        
        if (empSnapshot.empty && adminSnapshot.empty) {
          // No user records exist! Seed the Firestore collections
          for (const user of SEED_EMPLOYEES) {
            await setDoc(doc(db, 'employees', user.id), user);
          }
          for (const user of SEED_ADMINS) {
            await setDoc(doc(db, 'admins', user.id), user);
          }
          
          const freshEmp = await getDocs(collection(db, 'employees'));
          const freshAdmin = await getDocs(collection(db, 'admins'));
          const users: User[] = [];
          freshEmp.forEach((docSnap) => users.push(docSnap.data() as User));
          freshAdmin.forEach((docSnap) => users.push(docSnap.data() as User));
          return users;
        }
        
        const users: User[] = [];
        empSnapshot.forEach((docSnap) => users.push(docSnap.data() as User));
        adminSnapshot.forEach((docSnap) => users.push(docSnap.data() as User));
        return users;
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'employees/admins');
        return [];
      }
    } else {
      const localAdmins = JSON.parse(localStorage.getItem('eas_admins') || '[]');
      const localEmployees = JSON.parse(localStorage.getItem('eas_employees') || '[]');
      return [...localAdmins, ...localEmployees];
    }
  },

  async saveUser(user: User): Promise<void> {
    const col = user.role === UserRole.EMPLOYEE ? 'employees' : 'admins';
    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, col, user.id), user);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `${col}/${user.id}`);
      }
    }
    // Mirror in local-storage
    const lsKey = user.role === UserRole.EMPLOYEE ? 'eas_employees' : 'eas_admins';
    const localUsers = JSON.parse(localStorage.getItem(lsKey) || '[]');
    const index = localUsers.findIndex((u: User) => u.id === user.id);
    if (index >= 0) {
      localUsers[index] = user;
    } else {
      localUsers.push(user);
    }
    localStorage.setItem(lsKey, JSON.stringify(localUsers));
  },

  async changeUserStatus(userId: string, role: string, status: AccountStatus): Promise<void> {
    const col = role === UserRole.EMPLOYEE ? 'employees' : 'admins';
    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, col, userId), { status });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `${col}/${userId}`);
      }
    }
    const lsKey = role === UserRole.EMPLOYEE ? 'eas_employees' : 'eas_admins';
    const localUsers = JSON.parse(localStorage.getItem(lsKey) || '[]');
    const index = localUsers.findIndex((u: User) => u.id === userId);
    if (index >= 0) {
      localUsers[index].status = status;
      localStorage.setItem(lsKey, JSON.stringify(localUsers));
    }
  },

  async changePassword(userId: string, role: string, passwordHash: string): Promise<void> {
    const col = role === UserRole.EMPLOYEE ? 'employees' : 'admins';
    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, col, userId), { passwordHash });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `${col}/${userId}`);
      }
    }
    const lsKey = role === UserRole.EMPLOYEE ? 'eas_employees' : 'eas_admins';
    const localUsers = JSON.parse(localStorage.getItem(lsKey) || '[]');
    const index = localUsers.findIndex((u: User) => u.id === userId);
    if (index >= 0) {
      localUsers[index].passwordHash = passwordHash;
      localStorage.setItem(lsKey, JSON.stringify(localUsers));
    }
  },

  // --- ATTENDANCE SECTION ---
  async getAttendances(): Promise<Attendance[]> {
    if (isFirebaseConfigured && db && auth?.currentUser) {
      try {
        const role = await getCurrentUserRole();
        let querySnapshot;
        
        if (role === 'admin' || role === 'superadmin') {
          // Admin/Super Admin can query all records
          querySnapshot = await getDocs(collection(db, 'attendances'));
        } else {
          // Employee must restrict lists to their own records to satisfy security rules
          const q = query(collection(db, 'attendances'), where('employeeID', '==', auth.currentUser.uid));
          querySnapshot = await getDocs(q);
        }

        if (querySnapshot.empty) {
          // If empty and user is administrator, do a quick seeding of SEED_ATTENDANCE
          if (role === 'admin' || role === 'superadmin') {
            for (const att of SEED_ATTENDANCE) {
              await setDoc(doc(db, 'attendances', att.id), att);
            }
            const freshSnapshot = await getDocs(collection(db, 'attendances'));
            const attendances: Attendance[] = [];
            freshSnapshot.forEach((docSnap) => {
              attendances.push(docSnap.data() as Attendance);
            });
            return attendances.sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime());
          }
          return [];
        }
        const attendances: Attendance[] = [];
        querySnapshot.forEach((docSnap) => {
          attendances.push(docSnap.data() as Attendance);
        });
        return attendances.sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime());
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'attendances');
        return [];
      }
    } else {
      const list = JSON.parse(localStorage.getItem('eas_attendance') || '[]');
      return list.sort((a: Attendance, b: Attendance) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime());
    }
  },

  async getEmployeeAttendance(employeeId: string): Promise<Attendance[]> {
    if (isFirebaseConfigured && db && auth?.currentUser) {
      try {
        const q = query(collection(db, 'attendances'), where('employeeID', '==', employeeId));
        const querySnapshot = await getDocs(q);
        const attendances: Attendance[] = [];
        querySnapshot.forEach((docSnap) => {
          attendances.push(docSnap.data() as Attendance);
        });
        return attendances.sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime());
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'attendances');
        return [];
      }
    } else {
      const all = await this.getAttendances();
      return all.filter((a) => a.employeeID === employeeId);
    }
  },

  async registerCheckIn(employee: User): Promise<Attendance> {
    const now = new Date();
    const attendance: Attendance = {
      id: `att_${employee.id}_${now.getTime()}`,
      attendanceID: `att_${employee.id}_${now.getTime()}`,
      employeeID: employee.id,
      employeeName: employee.name,
      date: now.toISOString().split('T')[0],
      checkInTime: now.toISOString(),
      status: AttendanceStatus.CHECKED_IN,
    };

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'attendances', attendance.id), attendance);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `attendances/${attendance.id}`);
      }
    }

    const localAttendance = JSON.parse(localStorage.getItem('eas_attendance') || '[]');
    localAttendance.push(attendance);
    localStorage.setItem('eas_attendance', JSON.stringify(localAttendance));
    return attendance;
  },

  async registerCheckOut(attendanceId: string): Promise<Attendance> {
    const now = new Date();
    const all = await this.getAttendances();
    const record = all.find(a => a.id === attendanceId);
    if (!record) {
      throw new Error('Attendance record not found');
    }

    record.checkOutTime = now.toISOString();
    record.status = AttendanceStatus.CHECKED_OUT;

    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'attendances', attendanceId), {
          checkOutTime: record.checkOutTime,
          status: record.status
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `attendances/${attendanceId}`);
      }
    }

    const localAttendance = JSON.parse(localStorage.getItem('eas_attendance') || '[]');
    const index = localAttendance.findIndex((a: Attendance) => a.id === attendanceId);
    if (index >= 0) {
      localAttendance[index].checkOutTime = record.checkOutTime;
      localAttendance[index].status = record.status;
      localStorage.setItem('eas_attendance', JSON.stringify(localAttendance));
    }

    return record;
  },

  async updateAttendanceRecord(attendanceId: string, updates: Partial<Attendance>): Promise<void> {
    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'attendances', attendanceId), updates);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `attendances/${attendanceId}`);
      }
    }
    const localAttendance = JSON.parse(localStorage.getItem('eas_attendance') || '[]');
    const index = localAttendance.findIndex((a: Attendance) => a.id === attendanceId);
    if (index >= 0) {
      localAttendance[index] = { ...localAttendance[index], ...updates };
      localStorage.setItem('eas_attendance', JSON.stringify(localAttendance));
    }
  },

  async deleteAttendanceRecord(attendanceId: string): Promise<void> {
    if (isFirebaseConfigured && db) {
      try {
        await deleteDoc(doc(db, 'attendances', attendanceId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `attendances/${attendanceId}`);
      }
    }
    const localAttendance = JSON.parse(localStorage.getItem('eas_attendance') || '[]');
    const filtered = localAttendance.filter((a: Attendance) => a.id !== attendanceId);
    localStorage.setItem('eas_attendance', JSON.stringify(filtered));
  },

  // --- QR & DYNAMIC TOKEN SECTION ---
  async getLatestToken(): Promise<QRToken | null> {
    if (isFirebaseConfigured && db) {
      try {
        const q = query(collection(db, 'qrtokens'), orderBy('createdTime', 'desc'), limit(1));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          return querySnapshot.docs[0].data() as QRToken;
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'qrtokens');
      }
    }

    // Default localStorage fetch
    const tokens = JSON.parse(localStorage.getItem('eas_qr_tokens') || '[]');
    if (tokens.length > 0) {
      // Return sorted desc
      tokens.sort((a: QRToken, b: QRToken) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime());
      return tokens[0];
    }
    return null;
  },

  async createNewToken(tokenId: string, tokenValue: string, qrCodeValue: string): Promise<QRToken> {
    const now = new Date();
    const expiry = new Date(now.getTime() + 60000); // 1 minute window
    
    const qrToken: QRToken = {
      id: tokenId,
      tokenID: tokenId,
      tokenValue,
      qrCodeValue,
      createdTime: now.toISOString(),
      expiryTime: expiry.toISOString()
    };

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'qrtokens', tokenId), qrToken);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `qrtokens/${tokenId}`);
      }
    }

    const tokens = JSON.parse(localStorage.getItem('eas_qr_tokens') || '[]');
    tokens.push(qrToken);
    localStorage.setItem('eas_qr_tokens', JSON.stringify(tokens));
    return qrToken;
  }
};
