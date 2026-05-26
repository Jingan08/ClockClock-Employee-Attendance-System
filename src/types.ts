export enum UserRole {
  EMPLOYEE = 'employee',
  ADMIN = 'admin',
  SUPERADMIN = 'superadmin',
}

export enum AccountStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
}

export enum AttendanceStatus {
  CHECKED_IN = 'checked-in',
  CHECKED_OUT = 'checked-out',
}

export interface User {
  id: string; // Firebase Auth UID or local ID
  userID: string; // Legacy ID field matching db blueprint
  name: string;
  email: string;
  phone: string;
  passwordHash?: string; // Stored for portal matching / demo
  role: UserRole;
  status: AccountStatus;
  employeeID?: string; // EMP-XYZ for employees
  adminID?: string; // ADM-XYZ for admins
  createdAt: string;
}

export interface Attendance {
  id: string; // attendanceID
  attendanceID: string;
  employeeID: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  checkInTime: string; // ISO String
  checkOutTime?: string | null; // ISO String or null
  status: AttendanceStatus;
}

export interface QRToken {
  id: string; // tokenID
  tokenID: string;
  tokenValue: string; // 6-digit dynamic passcode
  qrCodeValue: string; // Encrypted or signed token string
  createdTime: string; // ISO String
  expiryTime: string; // ISO String
}

export interface SystemStats {
  totalEmployees: number;
  activeEmployeesCount: number;
  totalPresentToday: number;
  averageCheckInTime: string;
}
