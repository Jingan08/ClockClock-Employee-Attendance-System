# Security Specification (Zero-Trust ABAC Guard)

This specification defines the strict security assertions and permission invariants for the Employee Attendance System.

## 1. Data Invariants

1. **Self-Access Profiles**: A user can read their own profile. Only admins and super-admins can read other user profiles (for lists and management).
2. **PII Protection**: User data containing emails/phones (privately sensitive) is locked behind ownership bounds or admin roles.
3. **No Unverified Writes**: Any employee-created attendance record must verify that `employeeID` matches their authentic profile ID, and `request.auth.uid` is current and verified.
4. **No Role Escalation**: Users cannot update their own `role` or `status`. Only admins can update employee statuses, and only super admins can manage admin privileges.
5. **No System Overwrite**: Users cannot forge short-lived security tokens (`qrtokens`). Tokens are system generated (from authorized admins).
6. **Time-Based OTP Expiration**: A token is readable but cannot be validated if `request.time > expiryTime`.
7. **Strict State Transitions**: Employee attendance state transitions can only go Check-in -> Check-out. It must conform to the current check-in state.

---

## 2. The "Dirty Dozen" Vulnerability Payloads

Below are the 12 malicious payloads designed to bypass identity, integrity, and state transition rules, which our Security Fortress must reject:

### P1: The Identity Hijacker (User Profile Creation)
*   **Target**: `/users/attacker_uid`
*   **Payload**: `{"userID": "attacker_uid", "email": "cloned_admin@attendance.com", "role": "admin", "status": "active"}`
*   **Vulnerability**: Attacker attempts to bypass registration validation and self-assign the `admin` role during sign-up.

### P2: The Status Lockout Bypass
*   **Target**: `/users/disabled_employee`
*   **Payload**: `{"status": "active"}`
*   **Vulnerability**: A disabled user tries to re-enable their own account.

### P3: Self-Assigned Role Upgrade
*   **Target**: `/users/employee_uid`
*   **Payload**: `{"role": "superadmin"}`
*   **Vulnerability**: Low-privilege user tries to escalate their own role.

### P4: The Orphaned Attendance Slip
*   **Target**: `/attendances/ghost_record_001`
*   **Payload**: `{"employeeID": "target_employee_uid", "status": "checked-in", "date": "2026-05-26", "checkInTime": "2026-05-26T01:48:00Z"}`
*   **Vulnerability**: User tries to submit attendance on behalf of another employee (`employeeID` spoofing).

### P5: Backdated Clock-In (Temporal Integrity Violation)
*   **Target**: `/attendances/manipulated`
*   **Payload**: `{"checkInTime": "2020-01-01T00:00:00Z"}`
*   **Vulnerability**: Submitting a falsified check-in time to bypass punctual requirements.

### P6: The Phantom Token Generation (Token Forgery)
*   **Target**: `/qrtokens/forged_id`
*   **Payload**: `{"tokenID": "forged_id", "tokenValue": "999999", "qrCodeValue": "GHOST", "expiryTime": "2030-01-01T00:00:00Z"}`
*   **Vulnerability**: Non-admin user tries to generate a static token that never expires.

### P7: Inline Token Expiration Forgery (Update QRToken)
*   **Target**: `/qrtokens/active_token_id`
*   **Payload**: `{"expiryTime": "2029-12-31T23:59:59Z"}`
*   **Vulnerability**: Low-privilege user attempts to write/override active token parameters to prolong validity.

### P8: The Double-Check-In Multi-Write Attack
*   **Target**: `/attendances/double_write`
*   **Payload**: `{"status": "checked-in", "checkOutTime": "2026-05-26T02:00:00Z"}` (when state is already active check-in)
*   **Vulnerability**: Inserting dual entries to claim multi-shift hours simultaneously.

### P9: The Admin Lockout (Wiping Admin Records)
*   **Target**: `/users/admin_uid`
*   **Payload**: `{}` (Wipes document)
*   **Vulnerability**: Attacker attempts to delete or nullify an admin's role document to lock them out of operations.

### P10: Administrative PII Scraping (Blanket Read Profile Leak)
*   **Target**: `/users`
*   **Operation**: Read entire collection as unauthenticated or simple employee role.
*   **Vulnerability**: Standard employee attempts to crawl, scrape, or list the private emails/phone numbers of all other employees.

### P11: Double Checkout Backdate (Update Abuse)
*   **Target**: `/attendances/att_001`
*   **Payload**: `{"checkOutTime": "2026-05-26T01:00:00Z", "status": "checked-out"}` (on already checked-out shift)
*   **Vulnerability**: Changing the end-time after an attendance slot has officially closed inside the database.

### P12: ID Poisoning Attack (Oversized Document Key)
*   **Target**: `/users/JUNK_CHARACTERS_OF_10KB_SIZE_THAT_EXHAUSTS_DATABASE_WALLETS`
*   **Payload**: `{"userID": "cloned", "name": "Hack"}`
*   **Vulnerability**: Attacking the Firestore write-cycles via massive injected keys.

---

## 3. The Test Runner Spec

The security rules must enforce rejection of all twelve payloads. Tests are run using the Firebase Rules Unit Testing SDK in local environments:

```typescript
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { setDoc, getDoc, doc } from 'firebase/firestore';

describe('Employee Attendance Security Rule Suite', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'employee-attendance-sys',
      firestore: {
        host: 'localhost',
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  test('P1: Disallows user role escalation during self registration', async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    const attackerRef = doc(unauthedDb, 'users/attacker_uid');
    await expect(setDoc(attackerRef, {
      userID: 'attacker_uid',
      email: 'cloned_admin@attendance.com',
      role: 'admin',
      status: 'active'
    })).rejects.toThrow();
  });

  test('P4: Prevents employeeID spoofing in attendance writes', async () => {
    const context = testEnv.authenticatedContext('employee_auth_id', { email: 'emp@test.com', email_verified: true });
    const db = context.firestore();
    const mockAttendance = doc(db, 'attendances/ghost_record_001');
    await expect(setDoc(mockAttendance, {
      attendanceID: 'ghost_record_001',
      employeeID: 'other_employee_uid',
      status: 'checked-in',
      date: '2026-05-26',
      checkInTime: new Date().toISOString()
    })).rejects.toThrow();
  });
});
```
