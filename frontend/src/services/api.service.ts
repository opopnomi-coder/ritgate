import { API_CONFIG } from '../config/api.config';
import {
  Student,
  Staff,
  HOD,
  SecurityPersonnel,
  UserRole,
  OTPResponse,
  LoginResponse,
  GatePassRequest,
  GroupPassRequest,
  ApiResponse,
} from '../types';

// ─── PRODUCTION-FIRST API SERVICE ────────────────────────────────────────────
// Always uses the Render backend URL directly.
// No URL discovery, no stale-cache checks, no local-IP fallback.
// One request, 120s timeout (handles Render cold start ~60s).
// ─────────────────────────────────────────────────────────────────────────────

class ApiService {
  private baseURL: string;
  isBackendAvailable = true; // assume available; Render is always the target

  constructor() {
    this.baseURL = API_CONFIG.BASE_URL;
    console.log('🚀 ApiService ready →', this.baseURL);

    // Clear any stale local-IP cache from old builds
    this.clearStaleCache();
  }

  private async clearStaleCache() {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const lastURL = await AsyncStorage.getItem('@mygate_last_working_url');
      if (lastURL && !lastURL.includes('onrender.com')) {
        await AsyncStorage.removeItem('@mygate_last_working_url');
        await AsyncStorage.removeItem('@mygate_manual_ip');
        console.log('🧹 Cleared stale local-IP cache');
      }
    } catch (_) {}
  }

  // Fire-and-forget ping so Render wakes up before user taps Continue
  wakeUpBackend(): void {
    const url = `${this.baseURL.replace('/api', '')}/api/health`;
    console.log('🔔 Wake-up ping →', url);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 90000);
    fetch(url, { method: 'GET', signal: ctrl.signal })
      .then(r => { clearTimeout(t); if (r.ok) console.log('✅ Backend awake'); })
      .catch(() => { clearTimeout(t); console.log('⏳ Backend still waking…'); });
  }

  getCurrentBackendUrl(): string { return this.baseURL; }

  async checkBackendStatus(): Promise<boolean> { return true; }

  // ── Core request — single attempt, 120s timeout ───────────────────────────
  private async makeRequest(url: string, options: RequestInit): Promise<any> {
    console.log(`📡 ${options.method || 'GET'} ${url}`);
    const t0 = Date.now();

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), API_CONFIG.TIMEOUT);

    try {
      const res = await fetch(url, {
        ...options,
        signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers,
        },
      });
      clearTimeout(timer);
      console.log(`✅ ${res.status} in ${Date.now() - t0}ms`);

      let data: any;
      try { data = await res.json(); } catch { data = {}; }

      if (!res.ok) {
        // If backend returned a structured error, surface it
        if (data && typeof data === 'object' && 'success' in data) return data;
        throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
      }
      return data;
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new Error('Server is starting up (Render free tier). Please wait ~60s and try again.');
      }
      throw err;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private normalizeBoolean(v: any): boolean {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') return ['true', '1', 'yes'].includes(v.toLowerCase());
    if (typeof v === 'number') return v === 1;
    return false;
  }

  private normalizeUserData(user: any): any {
    if (!user) return user;
    const n = { ...user };
    if ('isActive' in n) n.isActive = this.normalizeBoolean(n.isActive);
    if ('is_active' in n) n.is_active = this.normalizeBoolean(n.is_active);
    if ('enabled' in n) n.enabled = this.normalizeBoolean(n.enabled);
    return n;
  }

  // ── Unified OTP ───────────────────────────────────────────────────────────
  async sendOTP(userId: string, role: UserRole): Promise<{ success: boolean; message: string; maskedEmail?: string; email?: string }> {
    switch (role) {
      case 'STUDENT': { const r = await this.sendStudentOTP(userId); return { success: r.success, message: r.message, maskedEmail: (r as any).email }; }
      case 'STAFF':   { const r = await this.sendStaffOTP(userId);   return { success: r.success, message: r.message, maskedEmail: (r as any).email }; }
      case 'HOD':     { const r = await this.sendHODOTP(userId);     return { success: r.success, message: r.message, maskedEmail: (r as any).email }; }
      case 'HR':      { const r = await this.sendHROTP(userId);      return { success: r.success, message: r.message, maskedEmail: (r as any).email }; }
      case 'SECURITY':{ const r = await this.sendSecurityOTP(userId);return { success: r.success, message: r.message, maskedEmail: (r as any).email }; }
      default: return { success: false, message: 'Unknown role' };
    }
  }

  async verifyOTP(userId: string, otp: string, role: UserRole): Promise<{ success: boolean; message: string; user?: any }> {
    switch (role) {
      case 'STUDENT': { const r = await this.verifyStudentOTP(userId, otp); return { success: r.success, message: r.message, user: r.user }; }
      case 'STAFF':   { const r = await this.verifyStaffOTP(userId, otp);   return { success: r.success, message: r.message, user: r.user }; }
      case 'HOD':     { const r = await this.verifyHODOTP(userId, otp);     return { success: r.success, message: r.message, user: r.user }; }
      case 'HR':      { const r = await this.verifyHROTP(userId, otp);      return { success: r.success, message: r.message, user: r.user }; }
      case 'SECURITY':{ const r = await this.verifySecurityOTP(userId, otp);return { success: r.success, message: r.message, user: r.user }; }
      default: return { success: false, message: 'Unknown role' };
    }
  }

  // ── Auth endpoints ────────────────────────────────────────────────────────

  // Detect actual role from backend (handles HOD/HR/STAFF who all have same ID pattern)
  async detectRole(staffCode: string): Promise<UserRole> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/auth/detect-role/${encodeURIComponent(staffCode)}`, { method: 'GET' });
      if (data.success && data.role) return data.role as UserRole;
    } catch (_) {}
    return 'STAFF'; // safe fallback
  }

  async sendStudentOTP(regNo: string): Promise<OTPResponse> {
    try { return await this.makeRequest(`${this.baseURL}/auth/student/send-otp`, { method: 'POST', body: JSON.stringify({ regNo }) }); }
    catch (e: any) { return { success: false, message: e.message || 'Failed to send OTP' }; }
  }

  async verifyStudentOTP(regNo: string, otp: string): Promise<LoginResponse> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/auth/student/verify-otp`, { method: 'POST', body: JSON.stringify({ regNo, otp }) });
      return { success: data.success, message: data.message, user: this.normalizeUserData(data.student), role: 'STUDENT' };
    } catch (e: any) { return { success: false, message: e.message || 'Failed to verify OTP' }; }
  }

  async sendStaffOTP(staffCode: string): Promise<OTPResponse> {
    try { return await this.makeRequest(`${this.baseURL}/auth/staff/send-otp`, { method: 'POST', body: JSON.stringify({ staffCode }) }); }
    catch (e: any) { return { success: false, message: e.message || 'Failed to send OTP' }; }
  }

  async verifyStaffOTP(staffCode: string, otp: string): Promise<LoginResponse> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/auth/staff/verify-otp`, { method: 'POST', body: JSON.stringify({ staffCode, otp }) });
      return { success: data.success, message: data.message, user: this.normalizeUserData(data.staff), role: 'STAFF' };
    } catch (e: any) { return { success: false, message: e.message || 'Failed to verify OTP' }; }
  }

  async sendHODOTP(hodCode: string): Promise<OTPResponse> {
    try { return await this.makeRequest(`${this.baseURL}/auth/hod/send-otp`, { method: 'POST', body: JSON.stringify({ hodCode }) }); }
    catch (e: any) { return { success: false, message: e.message || 'Failed to send OTP' }; }
  }

  async verifyHODOTP(hodCode: string, otp: string): Promise<LoginResponse> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/auth/hod/verify-otp`, { method: 'POST', body: JSON.stringify({ hodCode, otp }) });
      return { success: data.success, message: data.message, user: this.normalizeUserData(data.hod), role: 'HOD' };
    } catch (e: any) { return { success: false, message: e.message || 'Failed to verify OTP' }; }
  }

  async sendHROTP(hrCode: string): Promise<OTPResponse> {
    try { return await this.makeRequest(`${this.baseURL}/auth/hr/send-otp`, { method: 'POST', body: JSON.stringify({ hrCode }) }); }
    catch (e: any) { return { success: false, message: e.message || 'Failed to send OTP' }; }
  }

  async verifyHROTP(hrCode: string, otp: string): Promise<LoginResponse> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/auth/hr/verify-otp`, { method: 'POST', body: JSON.stringify({ hrCode, otp }) });
      return { success: data.success, message: data.message, user: this.normalizeUserData(data.hr), role: 'HR' };
    } catch (e: any) { return { success: false, message: e.message || 'Failed to verify OTP' }; }
  }

  async sendSecurityOTP(securityId: string): Promise<OTPResponse> {
    try { return await this.makeRequest(`${this.baseURL}/auth/login/security-id`, { method: 'POST', body: JSON.stringify({ securityId }) }); }
    catch (e: any) { return { success: false, message: e.message || 'Failed to send OTP' }; }
  }

  async verifySecurityOTP(securityId: string, otp: string): Promise<LoginResponse> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/auth/verify-otp`, { method: 'POST', body: JSON.stringify({ securityId, otp }) });
      return { success: data.success, message: data.message, user: this.normalizeUserData(data.security), role: 'SECURITY' };
    } catch (e: any) { return { success: false, message: e.message || 'Failed to verify OTP' }; }
  }

  // ── QR Code ───────────────────────────────────────────────────────────────
  async getGatePassQRCode(requestId: number, identifier: string, download = false): Promise<{ success: boolean; qrCode?: string; manualCode?: string; message?: string }> {
    try {
      const data = await this.makeRequest(
        `${this.baseURL}/gate-pass/qr-code/${requestId}?identifier=${encodeURIComponent(identifier)}&download=${download}`,
        { method: 'GET' }
      );
      return { success: data.success, qrCode: data.qrCode, manualCode: data.manualCode, message: data.message };
    } catch (e: any) { return { success: false, message: e.message || 'Failed to fetch QR code' }; }
  }

  // ── Gate Pass ─────────────────────────────────────────────────────────────
  async submitGatePassRequest(d: { regNo: string; purpose: string; reason: string; requestDate: string; attachmentUri?: string }): Promise<ApiResponse> {
    try { return await this.makeRequest(`${this.baseURL}/gate-pass/student/submit`, { method: 'POST', body: JSON.stringify(d) }); }
    catch (e: any) { return { success: false, message: e.message || 'Failed to submit gate pass request' }; }
  }

  async submitStaffGatePassRequest(d: { staffCode: string; purpose: string; reason: string; requestDate: string; attachmentUri?: string }): Promise<ApiResponse> {
    try { return await this.makeRequest(`${this.baseURL}/gate-pass/staff/submit`, { method: 'POST', body: JSON.stringify(d) }); }
    catch (e: any) { return { success: false, message: e.message || 'Failed to submit gate pass request' }; }
  }

  async getStudentGatePassRequests(regNo: string): Promise<{ success: boolean; requests?: any[]; message?: string; data?: any[] }> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/gate-pass/student/${regNo}`, { method: 'GET' });
      return { success: data.success || true, message: data.message || 'OK', requests: data.requests || [], data: data.requests || [] };
    } catch (e: any) { return { success: false, message: e.message || 'Failed to fetch', requests: [], data: [] }; }
  }

  async getUserEntryHistory(userId: string): Promise<any[]> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/entry-exit/history/${userId}`, { method: 'GET' });
      return data.data || data.history || [];
    } catch { return []; }
  }

  async getStaffPendingRequests(staffCode: string): Promise<ApiResponse<GatePassRequest[]>> {
    try { return await this.makeRequest(`${this.baseURL}/gate-pass/staff/${staffCode}/pending`, { method: 'GET' }); }
    catch (e: any) { return { success: false, message: e.message || 'Failed', data: [] }; }
  }

  async approveGatePassByStaff(staffCode: string, requestId: number, remark?: string): Promise<ApiResponse> {
    try { return await this.makeRequest(`${this.baseURL}/gate-pass/staff/${staffCode}/approve/${requestId}`, { method: 'POST', body: JSON.stringify({ remark }) }); }
    catch (e: any) { return { success: false, message: e.message || 'Failed to approve' }; }
  }

  async rejectGatePassByStaff(staffCode: string, requestId: number, reason: string): Promise<ApiResponse> {
    try { return await this.makeRequest(`${this.baseURL}/gate-pass/staff/${staffCode}/reject/${requestId}`, { method: 'POST', body: JSON.stringify({ reason }) }); }
    catch (e: any) { return { success: false, message: e.message || 'Failed to reject' }; }
  }

  async getStaffOwnGatePassRequests(staffCode: string): Promise<ApiResponse<GatePassRequest[]>> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/gate-pass/staff/${staffCode}/own`, { method: 'GET' });
      return { success: data.success || true, message: data.message || 'OK', data: data.requests || [], requests: data.requests || [] } as any;
    } catch (e: any) { return { success: false, message: e.message || 'Failed', data: [], requests: [] } as any; }
  }

  async getAllStaffRequests(staffCode: string): Promise<ApiResponse<GatePassRequest[]>> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/gate-pass/staff/${staffCode}/all`, { method: 'GET' });
      return { success: data.success || true, message: data.message || 'OK', data: data.requests || [], requests: data.requests || [] } as any;
    } catch (e: any) { return { success: false, message: e.message || 'Failed', data: [], requests: [] } as any; }
  }

  async getAllHODRequests(hodCode: string): Promise<ApiResponse<GatePassRequest[]>> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/gate-pass/hod/${hodCode}/all`, { method: 'GET' });
      return { success: data.success || true, message: data.message || 'OK', data: data.requests || [], requests: data.requests || [] } as any;
    } catch (e: any) { return { success: false, message: e.message || 'Failed', data: [], requests: [] } as any; }
  }

  async getHODPendingRequests(hodCode: string): Promise<ApiResponse<GatePassRequest[]>> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/gate-pass/hod/${hodCode}/pending`, { method: 'GET' });
      return { success: data.success || true, message: data.message || 'OK', data: data.requests || [], requests: data.requests || [] } as any;
    } catch (e: any) { return { success: false, message: e.message || 'Failed', data: [], requests: [] } as any; }
  }

  async approveGatePassByHOD(hodCode: string, requestId: number, remark?: string): Promise<ApiResponse> {
    try { return await this.makeRequest(`${this.baseURL}/gate-pass/hod/${hodCode}/approve/${requestId}`, { method: 'POST', body: JSON.stringify({ remark }) }); }
    catch (e: any) { return { success: false, message: e.message || 'Failed to approve' }; }
  }

  async rejectGatePassByHOD(hodCode: string, requestId: number, reason: string): Promise<ApiResponse> {
    try { return await this.makeRequest(`${this.baseURL}/gate-pass/hod/${hodCode}/reject/${requestId}`, { method: 'POST', body: JSON.stringify({ reason }) }); }
    catch (e: any) { return { success: false, message: e.message || 'Failed to reject' }; }
  }

  async getHRPendingRequests(hrCode: string): Promise<ApiResponse<GatePassRequest[]>> {
    // endpoint: GET /api/hr/gate-pass/pending?hrCode=...
    try {
      const data = await this.makeRequest(`${this.baseURL}/hr/gate-pass/pending?hrCode=${encodeURIComponent(hrCode)}`, { method: 'GET' });
      return { success: data.success || true, message: data.message || 'OK', data: data.requests || [] };
    } catch (e: any) { return { success: false, message: e.message || 'Failed', data: [] }; }
  }

  async approveGatePassByHR(hrCode: string, requestId: number): Promise<ApiResponse> {
    try { return await this.makeRequest(`${this.baseURL}/gate-pass/hr/${hrCode}/approve/${requestId}`, { method: 'POST' }); }
    catch (e: any) { return { success: false, message: e.message || 'Failed to approve' }; }
  }

  async rejectGatePassByHR(hrCode: string, requestId: number, reason: string): Promise<ApiResponse> {
    try { return await this.makeRequest(`${this.baseURL}/gate-pass/hr/${hrCode}/reject/${requestId}`, { method: 'POST', body: JSON.stringify({ reason }) }); }
    catch (e: any) { return { success: false, message: e.message || 'Failed to reject' }; }
  }

  // HR — HOD bulk pass approval
  async getHRPendingBulkPasses(): Promise<any> {
    try { return await this.makeRequest(`${this.baseURL}/hr/bulk-pass/pending`, { method: 'GET' }); }
    catch (e: any) { return { success: false, message: e.message || 'Failed to fetch bulk passes', requests: [] }; }
  }

  async approveHODBulkPass(requestId: number, hrCode: string): Promise<ApiResponse> {
    try { return await this.makeRequest(`${this.baseURL}/hr/bulk-pass/${requestId}/approve`, { method: 'POST', body: JSON.stringify({ hrCode }) }); }
    catch (e: any) { return { success: false, message: e.message || 'Failed to approve' }; }
  }

  async rejectHODBulkPass(requestId: number, hrCode: string, reason: string): Promise<ApiResponse> {
    try { return await this.makeRequest(`${this.baseURL}/hr/bulk-pass/${requestId}/reject`, { method: 'POST', body: JSON.stringify({ hrCode, reason }) }); }
    catch (e: any) { return { success: false, message: e.message || 'Failed to reject' }; }
  }

  // HR — single gate pass approval (HOD requests)
  async approveRequestAsHR(requestId: number, hrCode: string): Promise<ApiResponse> {
    try { return await this.makeRequest(`${this.baseURL}/hr/gate-pass/${requestId}/approve`, { method: 'POST', body: JSON.stringify({ hrCode }) }); }
    catch (e: any) { return { success: false, message: e.message || 'Failed to approve' }; }
  }

  async rejectRequestAsHR(requestId: number, hrCode: string, reason: string): Promise<ApiResponse> {
    try { return await this.makeRequest(`${this.baseURL}/hr/gate-pass/${requestId}/reject`, { method: 'POST', body: JSON.stringify({ hrCode, reason }) }); }
    catch (e: any) { return { success: false, message: e.message || 'Failed to reject' }; }
  }

  // ── Security / Entry-Exit ─────────────────────────────────────────────────
  async scanQRCode(qrData: string, securityId: string): Promise<ApiResponse> {
    try { return await this.makeRequest(`${this.baseURL}/security/scan`, { method: 'POST', body: JSON.stringify({ qrData, securityId }) }); }
    catch (e: any) { return { success: false, message: e.message || 'Failed to scan QR' }; }
  }

  async getSecurityDashboard(securityId: string): Promise<any> {
    try { return await this.makeRequest(`${this.baseURL}/security/dashboard/${securityId}`, { method: 'GET' }); }
    catch (e: any) { return { success: false, message: e.message }; }
  }

  async getRecentEntries(limit = 20): Promise<any[]> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/security/recent-entries?limit=${limit}`, { method: 'GET' });
      return data.entries || data || [];
    } catch { return []; }
  }

  async getUserStatus(userId: string): Promise<any> {
    try { return await this.makeRequest(`${this.baseURL}/entry-exit/user/${userId}/status`, { method: 'GET' }); }
    catch (e: any) { return { success: false, message: e.message }; }
  }

  // ── Notifications ─────────────────────────────────────────────────────────
  async getNotifications(userId: string, role: string): Promise<any[]> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/notifications/${role.toLowerCase()}/${userId}`, { method: 'GET' });
      return data.notifications || data || [];
    } catch { return []; }
  }

  async markNotificationRead(notificationId: number): Promise<ApiResponse> {
    try { return await this.makeRequest(`${this.baseURL}/notifications/${notificationId}/read`, { method: 'PUT' }); }
    catch (e: any) { return { success: false, message: e.message || 'Failed' }; }
  }

  // ── Visitor ───────────────────────────────────────────────────────────────
  async getVisitorRequestsForStaff(staffCode: string): Promise<{ success: boolean; requests?: any[]; message?: string }> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/visitors/staff/${staffCode}/requests`, { method: 'GET' });
      return { success: true, requests: Array.isArray(data) ? data : (data.requests || data) };
    } catch (e: any) { return { success: false, message: e.message }; }
  }

  // ── Bulk Gate Pass ────────────────────────────────────────────────────────
  async submitBulkGatePass(data: any): Promise<ApiResponse> {
    try { return await this.makeRequest(`${this.baseURL}/hod/bulk-pass/create`, { method: 'POST', body: JSON.stringify(data) }); }
    catch (e: any) { return { success: false, message: e.message || 'Failed' }; }
  }

  async getBulkGatePassRequests(hodCode: string): Promise<any[]> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/bulk-gate-pass/hod/${hodCode}`, { method: 'GET' });
      return data.requests || data || [];
    } catch { return []; }
  }

  async getHODDepartmentStudents(hodCode: string): Promise<{ success: boolean; students?: any[]; message?: string }> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/hod/${hodCode}/department/students`, { method: 'GET' });
      return { success: data.success !== false, students: data.students || [] };
    } catch (e: any) { return { success: false, students: [], message: e.message || 'Failed to load students' }; }
  }

  async getHODDepartmentStaff(hodCode: string): Promise<{ success: boolean; staff?: any[]; message?: string }> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/hod/${hodCode}/department/staff`, { method: 'GET' });
      return { success: data.success !== false, staff: data.staff || [] };
    } catch (e: any) { return { success: false, staff: [], message: e.message || 'Failed to load staff' }; }
  }

  async getStudentsByStaffDepartment(staffCode: string): Promise<{ success: boolean; students?: any[]; message?: string }> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/bulk-pass/students/${staffCode}`, { method: 'GET' });
      const raw = data.students || data.data || data || [];
      // Backend returns `studentName`, frontend expects `fullName` — normalize here
      const students = raw.map((s: any) => ({ ...s, fullName: s.fullName || s.studentName || s.name || '' }));
      return { success: data.success !== false, students };
    } catch (e: any) { return { success: false, students: [], message: e.message || 'Failed to fetch students' }; }
  }

  async createBulkGatePass(data: any): Promise<ApiResponse> {
    try { return await this.makeRequest(`${this.baseURL}/bulk-pass/create`, { method: 'POST', body: JSON.stringify(data) }); }
    catch (e: any) { return { success: false, message: e.message || 'Failed to create bulk gate pass' }; }
  }

  async getStaffBulkPassRequests(staffCode: string): Promise<{ success: boolean; requests?: any[]; message?: string }> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/bulk-pass/staff/${staffCode}`, { method: 'GET' });
      return { success: data.success !== false, requests: data.requests || data.data || [] };
    } catch (e: any) { return { success: false, requests: [], message: e.message || 'Failed' }; }
  }

  async getStaffVisitorRequests(staffCode: string): Promise<{ success: boolean; data?: any[]; message?: string }> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/gate-pass/staff/${staffCode}/pending-all`, { method: 'GET' });
      return { success: data.success !== false, data: data.requests || data.data || [] };
    } catch (e: any) { return { success: false, data: [], message: e.message || 'Failed' }; }
  }

  // ── Staff directory ───────────────────────────────────────────────────────
  async getStaffDirectory(): Promise<any[]> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/staff/directory`, { method: 'GET' });
      return data.staff || data || [];
    } catch { return []; }
  }

  // ── Departments ───────────────────────────────────────────────────────────
  async getDepartments(): Promise<any[]> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/departments`, { method: 'GET' });
      return data.departments || data || [];
    } catch { return []; }
  }

  // ── Push tokens ───────────────────────────────────────────────────────────
  async registerPushToken(userId: string, role: string, token: string): Promise<ApiResponse> {
    try { return await this.makeRequest(`${this.baseURL}/notifications/register-token`, { method: 'POST', body: JSON.stringify({ userId, role, token }) }); }
    catch (e: any) { return { success: false, message: e.message || 'Failed' }; }
  }

  async getActivePersons(): Promise<{ success: boolean; data?: any[]; message?: string }> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/security/active-persons`, { method: 'GET' });
      return { success: true, data: data.persons || data.data || data || [] };
    } catch (e: any) { return { success: false, data: [], message: e.message }; }
  }

  // ── Legacy compat stubs (used by older screens) ───────────────────────────
  async findWorkingBackend(): Promise<string | null> { return this.baseURL; }
  async rediscoverBackend(): Promise<boolean> { return true; }
  async setManualIP(_ip: string): Promise<boolean> { return false; }
  async clearManualIP(): Promise<boolean> { return true; }

  // ── Visitor approval ──────────────────────────────────────────────────────
  async approveVisitorRequest(visitorId: string | number): Promise<ApiResponse> {
    try { return await this.makeRequest(`${this.baseURL}/visitors/${visitorId}/approve`, { method: 'POST' }); }
    catch (e: any) { return { success: false, message: e.message || 'Failed to approve visitor request' }; }
  }

  async rejectVisitorRequest(visitorId: string | number, reason: string): Promise<ApiResponse> {
    try { return await this.makeRequest(`${this.baseURL}/visitors/${visitorId}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }); }
    catch (e: any) { return { success: false, message: e.message || 'Failed to reject visitor request' }; }
  }

  async getBulkGatePassDetails(requestId: number): Promise<any> {
    try { return await this.makeRequest(`${this.baseURL}/bulk-pass/details/${requestId}`, { method: 'GET' }); }
    catch (e: any) { return { success: false, message: e.message || 'Failed to fetch bulk gate pass details' }; }
  }

  async getHODBulkGatePassDetails(requestId: number): Promise<any> {
    try { return await this.makeRequest(`${this.baseURL}/hod/bulk-pass/details/${requestId}`, { method: 'GET' }); }
    catch (e: any) { return { success: false, message: e.message || 'Failed to fetch HOD bulk gate pass details' }; }
  }

  async submitHODGatePassRequest(hodCode: string, purpose: string, reason: string, attachmentUri?: string): Promise<{ success: boolean; message?: string; requestId?: number }> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/hod/gate-pass/submit`, { method: 'POST', body: JSON.stringify({ hodCode, purpose, reason, attachmentUri }) });
      return { success: data.status === 'SUCCESS' || data.success !== false, message: data.message, requestId: data.requestId };
    } catch (e: any) { return { success: false, message: e.message || 'Failed to submit gate pass request' }; }
  }

  async getHODMyGatePassRequests(hodCode: string): Promise<{ success: boolean; requests: any[]; message?: string }> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/hod/gate-pass/my-requests?hodCode=${encodeURIComponent(hodCode)}`, { method: 'GET' });
      // Backend returns { status: 'SUCCESS', requests: [...] }
      const ok = data.status === 'SUCCESS' || data.success !== false;
      return { success: ok, requests: data.requests || [] };
    } catch (e: any) { return { success: false, requests: [], message: e.message }; }
  }

  async getHODGatePassQRCode(requestId: number, hodCode: string): Promise<{ success: boolean; qrCode?: string; manualCode?: string; message?: string }> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/hod/gate-pass/${requestId}/qr-code?hodCode=${encodeURIComponent(hodCode)}`, { method: 'GET' });
      const ok = data.status === 'SUCCESS' || data.success !== false;
      return { success: ok, qrCode: data.qrCode, manualCode: data.manualCode, message: data.message };
    } catch (e: any) { return { success: false, message: e.message }; }
  }
}

export const apiService = new ApiService();
export default apiService;
