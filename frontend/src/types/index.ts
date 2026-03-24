// User Types
export type UserRole = 'STUDENT' | 'STAFF' | 'HOD' | 'HR' | 'SECURITY';
export type UserType = UserRole; // Alias for UserRole

export interface Student {
  id?: number;
  regNo: string;
  firstName: string;
  lastName: string;
  fullName?: string; // Helper field
  email: string;
  phone: string; // Changed from phoneNumber
  phoneNumber?: string; // Keep for backward compatibility
  department: string;
  year?: string;
  section?: string;
  currentStatus?: 'INSIDE' | 'OUTSIDE';
  isActive?: boolean;
}

export interface Staff {
  id?: number;
  staffCode: string;
  staffName: string;
  name?: string; // Alias for staffName
  email: string;
  phone: string; // Changed from phoneNumber
  phoneNumber?: string; // Keep for backward compatibility
  department: string;
  designation?: string;
  password?: string;
  isActive?: boolean;
}

export interface HOD {
  id?: number;
  hodCode: string;
  hodName: string;
  name?: string; // Alias for hodName
  email: string;
  phone: string; // Changed from phoneNumber
  phoneNumber?: string; // Keep for backward compatibility
  department: string;
  isActive?: boolean;
}

export interface HR {
  id?: number;
  hrCode: string;
  hrName: string;
  name?: string; // Alias for hrName
  email: string;
  phone: string;
  phoneNumber?: string; // Keep for backward compatibility
  department: string;
  isActive?: boolean;
}

export interface SecurityPersonnel {
  id?: number;
  securityId: string;
  name: string; // Changed from securityName to name for consistency
  securityName?: string; // Keep for backward compatibility
  email: string;
  phone: string; // Changed from phoneNumber to phone
  phoneNumber?: string; // Keep for backward compatibility
  shift?: string;
  gateAssignment?: string; // Changed from gateAssigned
  gateAssigned?: string; // Keep for backward compatibility
  isActive?: boolean;
  qrCode?: string;
}

export type User = Student | Staff | HOD | HR | SecurityPersonnel;

// Gate Pass Types
export interface GatePassRequest {
  id?: number;
  regNo?: string;
  staffCode?: string;
  purpose: string;
  reason: string;
  requestDate: string;
  exitDateTime?: string;
  returnDateTime?: string;
  status: 'PENDING' | 'APPROVED_BY_STAFF' | 'APPROVED_BY_HOD' | 'APPROVED' | 'REJECTED' | 'USED';
  approvedByStaff?: string;
  approvedByHOD?: string;
  staffRemark?: string;
  hodRemark?: string;
  rejectionReason?: string;
  qrCode?: string;
  passType?: 'SINGLE' | 'BULK';
  includeStaff?: boolean;
  studentCount?: number;
  qrOwnerId?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Group/Bulk Pass Types
export interface GroupPassRequest {
  id?: number;
  staffCode: string;
  purpose: string;
  reason: string;
  exitDateTime: string;
  returnDateTime: string;
  students: string[]; // Array of regNos
  includeStaff?: boolean;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ACTIVE' | 'COMPLETED';
  qrCode?: string;
  createdAt?: string;
}

// QR Table Entry
export interface QRTableEntry {
  id?: number;
  st?: string; // Student IDs (comma-separated)
  sf?: string; // Staff IDs (comma-separated)
  incharge?: string;
  subtype?: string;
  entry?: string;
  exit?: string;
  token?: string;
  createdAt?: string;
}

// Entry Log (for offline storage)
export interface EntryLog {
  id?: string;
  type: 'ENTRY' | 'EXIT';
  timestamp: string;
  gate?: string;
  purpose?: string;
  [key: string]: any;
}

// Scan Log
export interface ScanLog {
  id?: number;
  userId: string;
  userType: 'STUDENT' | 'STAFF';
  scanType: 'ENTRY' | 'EXIT';
  timestamp: string;
  location?: string;
  scannedBy?: string;
  purpose?: string;
  destination?: string;
}

// Vehicle Registration
export interface VehicleRegistration {
  id?: number;
  userId: string;
  userType: 'STUDENT' | 'STAFF' | 'VISITOR';
  vehicleNumber: string;
  vehicleType: string;
  vehicleModel?: string;
  registeredAt?: string;
}

// Notification
export interface Notification {
  id?: number;
  userId: string;
  userType: UserRole;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  isRead: boolean;
  createdAt: string;
}

// Active Person (for Security Dashboard)
export interface ActivePerson {
  id: number;
  name: string;
  type: string;
  purpose: string;
  status: 'PENDING' | 'EXITED';
  inTime: string;
  outTime: string | null;
  qrCode: string;
  userId?: string;
  department?: string;
}

// Vehicle History
export interface VehicleHistory {
  id: number;
  licensePlate: string;
  ownerName: string;
  ownerPhone: string;
  ownerType: string;
  vehicleType: string;
  vehicleModel: string;
  vehicleColor: string;
  status: string;
  createdAt: string;
  registeredBy?: string;
}

// Visitor Data
export interface VisitorData {
  name: string;
  phone: string;
  email: string;
  role?: 'VISITOR' | 'VENDOR';
  department: string;
  personToMeet: string;
  purpose: string;
  numberOfPeople: number;
  vehicleNumber: string | null;
}

// Department
export interface Department {
  id: string;
  name: string;
  code?: string;
}

// Staff Member (for visitor registration)
export interface StaffMember {
  id: string | number;
  name: string;
  role: string;
  email?: string;
  phone?: string;
  department?: string;
  type?: string;
}

// HOD Contact
export interface HODContact {
  id: number;
  name: string;
  department: string;
  email: string;
  phone: string;
  hodCode?: string;
}

// Scan History Entry
export interface ScanHistoryEntry {
  id: number;
  qrCode: string;
  personName: string;
  personType: string;
  purpose: string;
  status: string;
  scanLocation: string;
  scannedBy: string;
  securityId: string;
  timestamp: string;
  accessGranted: boolean;
  studentId?: string;
  facultyId?: string;
}

// Professional Notification (Toast)
export interface ToastNotification {
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
}

export interface OTPResponse {
  success: boolean;
  message: string;
  email?: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  user?: User;
  role?: UserRole;
  token?: string;
}

// Navigation Types
export type ScreenName =
  | 'HOME'
  | 'UNIFIED_LOGIN'
  | 'OTP_VERIFICATION'
  | 'DASHBOARD'
  | 'STUDENT_DASHBOARD'
  | 'STAFF_DASHBOARD'
  | 'HOD_DASHBOARD'
  | 'HR_DASHBOARD'
  | 'SECURITY_DASHBOARD'
  | 'NEW_PASS_REQUEST'
  | 'PASS_HISTORY'
  | 'APPROVE_REQUESTS'
  | 'BULK_GATE_PASS'
  | 'QR_SCANNER'
  | 'SCAN_HISTORY'
  | 'VEHICLE_REGISTRATION'
  | 'VISITOR_REGISTRATION'
  | 'VISITOR_QR'
  | 'HOD_CONTACTS'
  | 'PROFILE'
  | 'HISTORY'
  | 'REQUESTS'
  | 'MY_REQUESTS'
  | 'STAFF_BULK_GATE_PASS'
  | 'NOTIFICATIONS'
  | 'ANALYTICS'
  | 'HOD_GATE_PASS_REQUEST'
  | 'HOD_MY_REQUESTS'
  | 'HOD_PASS_TYPE_SELECTION'
  | 'HOD_BULK_GATE_PASS'
  | 'HR_APPROVAL';
