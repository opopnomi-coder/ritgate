import { Student, Staff, HOD } from '../types';
import { cacheService } from './cacheService';
import { API_CONFIG } from '../config/api.config';

// Backend URL - Dynamically detected from network
const BACKEND_URL = API_CONFIG.BASE_URL;  // Auto-detected from Expo Constants

let API_BASE_URL = BACKEND_URL;

class ApiService {
  private baseURL = API_BASE_URL;
  private isBackendAvailable = false;
  private pendingRequests: Map<string, Promise<any>> = new Map();

  constructor() {
    console.log('🚀 ApiService (api.ts) initialized');
    console.log('📍 Using backend URL:', this.baseURL);
  }

  // Test connection to backend — 70s timeout to handle Render free tier cold start
  async findWorkingBackend(): Promise<string | null> {
    console.log('🔍 Testing backend connection...');
    console.log('📍 Backend URL:', BACKEND_URL);

    try {
      const controller = new AbortController();
      // 70s: Render free tier can take up to 60s to wake up
      const timeoutId = setTimeout(() => controller.abort(), 70000);

      const response = await fetch(`${BACKEND_URL.replace('/api', '')}/api/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Backend is reachable:', data.message);
        this.baseURL = BACKEND_URL;
        this.isBackendAvailable = true;
        return BACKEND_URL;
      }
    } catch (error: any) {
      console.log('❌ Backend connection failed:', error.message);
    }

    this.isBackendAvailable = false;
    return null;
  }

  // Fire-and-forget ping to wake up Render free tier before user taps Continue
  wakeUpBackend(): void {
    const healthUrl = `${BACKEND_URL.replace('/api', '')}/api/health`;
    console.log('🔔 Pinging backend to wake up:', healthUrl);
    fetch(healthUrl, { method: 'GET' })
      .then(() => {
        console.log('✅ Backend wake-up ping sent');
        this.isBackendAvailable = true;
        this.baseURL = BACKEND_URL;
      })
      .catch(() => console.log('⏳ Backend still waking up...'));
  }

  // Check if backend is available
  async checkBackendStatus(): Promise<boolean> {
    if (this.isBackendAvailable) {
      return true;
    }

    const workingUrl = await this.findWorkingBackend();
    return workingUrl !== null;
  }

  // Force backend detection (useful for debugging)
  async forceBackendDetection(): Promise<string | null> {
    this.isBackendAvailable = false;
    return await this.findWorkingBackend();
  }

  // Get current backend URL
  getCurrentBackendUrl(): string {
    return this.baseURL;
  }

  // Convert technical errors to user-friendly messages
  private getFriendlyErrorMessage(error: any, context: string = ''): string {
    const errorMsg = error.message || '';

    // Network errors
    if (errorMsg.includes('Network') || errorMsg.includes('fetch') || errorMsg.includes('Failed to fetch')) {
      return 'Unable to connect to the server. Please check your internet connection and try again.';
    }

    // Timeout errors
    if (error.name === 'AbortError' || errorMsg.includes('timeout')) {
      return 'The request took too long. Please check your connection and try again.';
    }

    // HTTP errors
    if (errorMsg.includes('HTTP 400')) {
      return 'Invalid request. Please check your information and try again.';
    }
    if (errorMsg.includes('HTTP 401')) {
      if (context === 'otp') return 'Incorrect OTP. Please check and try again.';
      return 'Authentication failed. Please try logging in again.';
    }
    if (errorMsg.includes('HTTP 404')) {
      if (context === 'user') return 'User not found. Please check your ID and try again.';
      return 'The requested information was not found.';
    }
    if (errorMsg.includes('HTTP 500') || errorMsg.includes('HTTP 503')) {
      return 'Server error. Please try again in a few moments.';
    }

    // Backend not available
    if (errorMsg.includes('Backend server is not available')) {
      return 'Cannot connect to the server. Please ensure you are on the same network and the server is running.';
    }

    // Default friendly message
    if (errorMsg.length > 100) {
      return 'An error occurred. Please try again or contact support if the problem persists.';
    }

    return errorMsg || 'An unexpected error occurred. Please try again.';
  }

  // Centralized API error handler for global UI feedback
  public handleApiError(error: any): { success: false; message: string } {
    console.error('🛠️ Global API Error:', error);
    return {
      success: false,
      message: this.getFriendlyErrorMessage(error)
    };
  }

  // Enhanced network request with detailed logging
  private async makeRequest(url: string, options: RequestInit): Promise<any> {
    const startTime = Date.now();
    console.log(`🚀 API Request: ${options.method} ${url}`);

    // Check if backend is available first
    if (!this.isBackendAvailable) {
      console.log('🔍 Backend not available, checking status...');
      const isAvailable = await this.checkBackendStatus();
      if (!isAvailable) {
        throw new Error('Backend server is not available. Please check if the server is running.');
      }
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 70000); // 70s for Render cold start

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      // Try to parse JSON response for both success and error cases
      let data;
      try {
        const text = await response.text();
        data = text ? JSON.parse(text) : {};
      } catch (parseError) {
        data = {};
      }

      // For non-OK responses, return the parsed data (which should contain success: false and message)
      // This allows the caller to handle the error gracefully
      if (!response.ok) {
        // If the response has a proper error structure, return it
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }
        // Otherwise, throw an error with the status
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${JSON.stringify(data)}`);
      }

      return data;
    } catch (error: any) {
      throw error;
    }
  }

  // Gate Pass API methods
  async submitGatePassRequest(requestData: {
    regNo: string;
    purpose: string;
    reason: string;
    requestDate: string;
    attachmentUri?: string;
  }): Promise<{ success: boolean; message: string; requestId?: number; status?: string }> {
    try {
      console.log(`🎫 Submitting gate pass request for regNo: ${requestData.regNo}`);

      const data = await this.makeRequest(`${this.baseURL}/gate-pass/student/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (data.success) {
        console.log(`✅ Gate pass request submitted successfully, ID: ${data.requestId}`);
      }

      return data;
    } catch (error: any) {
      console.error(`❌ Error submitting gate pass request:`, error);

      const errorMsg = error.message || '';

      // Check for specific validation errors
      if (errorMsg.includes('required') || errorMsg.includes('400')) {
        return {
          success: false,
          message: 'Please fill in all required fields and try again.'
        };
      }

      // Check for student not found
      if (errorMsg.includes('404') || errorMsg.includes('not found')) {
        return {
          success: false,
          message: 'Student not found. Please check your registration number.'
        };
      }

      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  // Staff Gate Pass Request methods
  async submitStaffGatePassRequest(requestData: {
    staffCode: string;
    purpose: string;
    reason: string;
    requestDate: string;
    attachmentUri?: string;
  }): Promise<{ success: boolean; message: string; requestId?: number; status?: string }> {
    try {
      console.log(`🎫 Submitting staff gate pass request for staffCode: ${requestData.staffCode}`);

      const data = await this.makeRequest(`${this.baseURL}/gate-pass/staff/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (data.success) {
        console.log(`✅ Staff gate pass request submitted successfully, ID: ${data.requestId}`);
      }

      return data;
    } catch (error: any) {
      console.error(`❌ Error submitting staff gate pass request:`, error);

      const errorMsg = error.message || '';

      if (errorMsg.includes('required') || errorMsg.includes('400')) {
        return {
          success: false,
          message: 'Please fill in all required fields and try again.'
        };
      }

      if (errorMsg.includes('404') || errorMsg.includes('not found')) {
        return {
          success: false,
          message: 'Staff member not found. Please check your staff code.'
        };
      }

      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  async getStaffOwnGatePassRequests(staffCode: string): Promise<{ success: boolean; requests?: any[]; message?: string }> {
    try {
      console.log(`📋 Fetching own gate pass requests for staff: ${staffCode}`);

      // Use the new staff-specific endpoint
      const data = await this.makeRequest(`${this.baseURL}/gate-pass/staff/${staffCode}/own`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`✅ Fetched ${data.requests?.length || 0} gate pass requests for staff ${staffCode}`);
      return data;
    } catch (error: any) {
      console.error(`❌ Error fetching staff own gate pass requests for ${staffCode}:`, error);
      return {
        success: false,
        message: error.message || 'Network error occurred. Please check your connection and try again.'
      };
    }
  }

  async getAllStaffRequests(staffCode: string): Promise<{ success: boolean; requests?: any[]; message?: string }> {
    try {
      console.log(`📋 Fetching all requests assigned to staff: ${staffCode}`);

      const data = await this.makeRequest(`${this.baseURL}/gate-pass/staff/${staffCode}/all`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`✅ Fetched ${data.requests?.length || 0} requests assigned to staff ${staffCode}`);
      return data;
    } catch (error: any) {
      console.error(`❌ Error fetching staff requests for ${staffCode}:`, error);
      return {
        success: false,
        message: error.message || 'Network error occurred. Please check your connection and try again.'
      };
    }
  }

  async getVisitorRequestsForStaff(staffCode: string): Promise<{ success: boolean; requests?: any[]; message?: string }> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/visitors/staff/${staffCode}/requests`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (Array.isArray(data)) {
        return {
          success: true,
          requests: data
        };
      }

      return {
        success: true,
        requests: data.requests || data
      };
    } catch (error: any) {
      console.error(`❌ Error fetching visitor requests for ${staffCode}:`, error);
      return {
        success: false,
        message: error.message || 'Network error occurred. Please check your connection and try again.'
      };
    }
  }

  async getAllHODRequests(hodCode: string): Promise<{ success: boolean; requests?: any[]; message?: string }> {
    try {
      console.log(`📋 Fetching all requests assigned to HOD: ${hodCode}`);

      const data = await this.makeRequest(`${this.baseURL}/gate-pass/hod/${hodCode}/all`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`✅ Fetched ${data.requests?.length || 0} requests assigned to HOD ${hodCode}`);
      return data;
    } catch (error: any) {
      console.error(`❌ Error fetching HOD requests for ${hodCode}:`, error);
      return {
        success: false,
        message: error.message || 'Network error occurred. Please check your connection and try again.'
      };
    }
  }

  // Student OTP methods
  async sendStudentOTP(regNo: string): Promise<{ success: boolean; message: string; email?: string }> {
    try {
      console.log(`🔐 Sending OTP for regNo: ${regNo}`);

      const data = await this.makeRequest(`${this.baseURL}/auth/student/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ regNo }),
      });

      if (data.success) {
        console.log(`✅ OTP sent successfully to: ${data.email}`);
      }

      return data;
    } catch (error: any) {
      console.error(`❌ Error sending student OTP for ${regNo}:`, error);

      // Check for user not found
      const errorMsg = error.message || '';
      if (errorMsg.includes('404') || errorMsg.includes('not found')) {
        return {
          success: false,
          message: 'Student not found. Please check your registration number.'
        };
      }

      return {
        success: false,
        message: this.getFriendlyErrorMessage(error, 'user')
      };
    }
  }

  async verifyStudentOTP(regNo: string, otp: string): Promise<{ success: boolean; message: string; student?: Student }> {
    try {
      console.log(`🔍 Verifying OTP for regNo: ${regNo}, OTP: ${otp}`);

      const data = await this.makeRequest(`${this.baseURL}/auth/student/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ regNo, otp }),
      });

      if (data.success) {
        console.log(`✅ OTP verified successfully for regNo: ${regNo}`);
        
        // Map DTO fields to Student interface
        if (data.student) {
          const studentDTO = data.student;
          
          // Create properly mapped student object
          data.student = {
            id: studentDTO.id,
            regNo: studentDTO.userId || regNo, // DTO uses 'userId' for regNo
            firstName: studentDTO.name ? studentDTO.name.split(' ')[0] : '',
            lastName: studentDTO.name ? studentDTO.name.split(' ').slice(1).join(' ') : '',
            fullName: studentDTO.name || '', // DTO uses 'name' for full name
            email: studentDTO.email || '',
            phone: studentDTO.phone || '',
            phoneNumber: studentDTO.phone || '', // Backward compatibility
            department: studentDTO.department || '',
            isActive: studentDTO.isActive !== undefined ? studentDTO.isActive : true,
          };
          
          console.log(`📝 Mapped student DTO to interface:`, {
            regNo: data.student.regNo,
            fullName: data.student.fullName,
            email: data.student.email,
            department: data.student.department
          });
        }
      }

      return data;
    } catch (error: any) {
      console.error(`❌ Error verifying student OTP for ${regNo}:`, error);

      // Check for specific OTP error
      const errorMsg = error.message || '';
      if (errorMsg.includes('401') || errorMsg.includes('Invalid') || errorMsg.includes('OTP')) {
        return {
          success: false,
          message: 'Incorrect OTP. Please check the code and try again.'
        };
      }

      return {
        success: false,
        message: this.getFriendlyErrorMessage(error, 'otp')
      };
    }
  }

  // Staff OTP methods
  async sendStaffOTP(staffCode: string): Promise<{ success: boolean; message: string; email?: string }> {
    try {
      console.log(`🔐 Sending OTP for staffCode: ${staffCode}`);

      const data = await this.makeRequest(`${this.baseURL}/auth/staff/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ staffCode }),
      });

      if (data.success) {
        console.log(`✅ OTP sent successfully to: ${data.email}`);
      }

      return data;
    } catch (error: any) {
      console.error(`❌ Error sending staff OTP for ${staffCode}:`, error);

      // Check for user not found
      const errorMsg = error.message || '';
      if (errorMsg.includes('404') || errorMsg.includes('not found')) {
        return {
          success: false,
          message: 'Staff member not found. Please check your staff code.'
        };
      }

      return {
        success: false,
        message: this.getFriendlyErrorMessage(error, 'user')
      };
    }
  }

  async verifyStaffOTP(staffCode: string, otp: string): Promise<{ success: boolean; message: string; staff?: Staff }> {
    try {
      console.log(`🔍 Verifying OTP for staffCode: ${staffCode}, OTP: ${otp}`);

      const data = await this.makeRequest(`${this.baseURL}/auth/staff/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ staffCode, otp }),
      });

      if (data.success) {
        console.log(`✅ OTP verified successfully for staffCode: ${staffCode}`);
        
        // Map DTO fields to Staff interface
        if (data.staff) {
          const staffDTO = data.staff;
          
          // Create properly mapped staff object
          data.staff = {
            id: staffDTO.id,
            staffCode: staffDTO.userId || staffCode, // DTO uses 'userId' for staffCode
            staffName: staffDTO.name || '', // DTO uses 'name' for staffName
            name: staffDTO.name || '', // Also set 'name' for components that use it
            email: staffDTO.email || '',
            phone: staffDTO.phone || '',
            phoneNumber: staffDTO.phone || '', // Backward compatibility
            department: staffDTO.department || '',
            isActive: staffDTO.isActive !== undefined ? staffDTO.isActive : true,
          };
          
          console.log(`📝 Mapped staff DTO to interface:`, {
            staffCode: data.staff.staffCode,
            staffName: data.staff.staffName,
            name: data.staff.name,
            email: data.staff.email,
            department: data.staff.department
          });
        }
      }

      return data;
    } catch (error: any) {
      console.error(`❌ Error verifying staff OTP for ${staffCode}:`, error);

      // Check for specific OTP error
      const errorMsg = error.message || '';
      if (errorMsg.includes('401') || errorMsg.includes('Invalid') || errorMsg.includes('OTP')) {
        return {
          success: false,
          message: 'Incorrect OTP. Please check the code and try again.'
        };
      }

      return {
        success: false,
        message: this.getFriendlyErrorMessage(error, 'otp')
      };
    }
  }

  // HOD OTP methods
  async sendHODOTP(hodCode: string): Promise<{ success: boolean; message: string; email?: string }> {
    try {
      console.log(`🔐 Sending OTP for hodCode: ${hodCode}`);

      // Force backend detection if not available
      if (!this.isBackendAvailable) {
        console.log('🔄 Forcing backend detection...');
        await this.findWorkingBackend();
      }

      const data = await this.makeRequest(`${this.baseURL}/auth/hod/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hodCode }),
      });

      if (data.success) {
        console.log(`✅ OTP sent successfully to: ${data.email}`);
      }

      return data;
    } catch (error: any) {
      console.error(`❌ Error sending HOD OTP for ${hodCode}:`, error);

      // If network error, try to find working backend again
      if (error.message.includes('Network') || error.message.includes('timeout')) {
        console.log('🔄 Network error detected, retrying with backend detection...');
        try {
          await this.findWorkingBackend();
          if (this.isBackendAvailable) {
            console.log('🔄 Retrying HOD OTP request...');
            const retryData = await this.makeRequest(`${this.baseURL}/auth/hod/send-otp`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ hodCode }),
            });
            return retryData;
          }
        } catch (retryError: any) {
          console.error('❌ Retry failed:', retryError);
        }
      }

      // Check for user not found
      const errorMsg = error.message || '';
      if (errorMsg.includes('404') || errorMsg.includes('not found')) {
        return {
          success: false,
          message: 'HOD not found. Please check your HOD code.'
        };
      }

      return {
        success: false,
        message: this.getFriendlyErrorMessage(error, 'user')
      };
    }
  }

  async verifyHODOTP(hodCode: string, otp: string): Promise<{ success: boolean; message: string; hod?: HOD }> {
    try {
      console.log(`🔍 Verifying OTP for hodCode: ${hodCode}, OTP: ${otp}`);

      // Force backend detection if not available
      if (!this.isBackendAvailable) {
        console.log('🔄 Forcing backend detection...');
        await this.findWorkingBackend();
      }

      const data = await this.makeRequest(`${this.baseURL}/auth/hod/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hodCode, otp }),
      });

      if (data.success) {
        console.log(`✅ OTP verified successfully for hodCode: ${hodCode}`);
        
        // Map DTO fields to HOD interface
        if (data.hod) {
          const hodDTO = data.hod;
          
          // Create properly mapped HOD object
          data.hod = {
            id: hodDTO.id,
            hodCode: hodDTO.userId || hodCode, // DTO uses 'userId' for hodCode
            hodName: hodDTO.name || '', // DTO uses 'name' for hodName
            name: hodDTO.name || '', // Also set 'name' for components that use it
            email: hodDTO.email || '',
            phone: hodDTO.phone || '',
            phoneNumber: hodDTO.phone || '', // Backward compatibility
            department: hodDTO.department || '',
            isActive: hodDTO.isActive !== undefined ? hodDTO.isActive : true,
          };
          
          console.log(`📝 Mapped HOD DTO to interface:`, {
            hodCode: data.hod.hodCode,
            hodName: data.hod.hodName,
            name: data.hod.name,
            email: data.hod.email,
            department: data.hod.department
          });
        }
      }

      return data;
    } catch (error: any) {
      console.error(`❌ Error verifying HOD OTP for ${hodCode}:`, error);

      // If network error, try to find working backend again
      if (error.message.includes('Network') || error.message.includes('timeout')) {
        console.log('🔄 Network error detected, retrying with backend detection...');
        try {
          await this.findWorkingBackend();
          if (this.isBackendAvailable) {
            console.log('🔄 Retrying HOD OTP verification...');
            const retryData = await this.makeRequest(`${this.baseURL}/auth/hod/verify-otp`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ hodCode, otp }),
            });
            return retryData;
          }
        } catch (retryError: any) {
          console.error('❌ Retry failed:', retryError);
        }
      }

      // Check for specific OTP error
      const errorMsg = error.message || '';
      if (errorMsg.includes('401') || errorMsg.includes('Invalid') || errorMsg.includes('OTP')) {
        return {
          success: false,
          message: 'Incorrect OTP. Please check the code and try again.'
        };
      }

      return {
        success: false,
        message: this.getFriendlyErrorMessage(error, 'otp')
      };
    }
  }

  // Additional API methods for dashboard functionality
  async getUserStatus(userId: string): Promise<any> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/entry-exit/user/${userId}/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return data;
    } catch (error: any) {
      console.error(`❌ Error getting user status for ${userId}:`, error);
      return { success: false, message: error.message };
    }
  }

  async getUserEntryHistory(userId: string): Promise<any[]> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/security/entry-exit/user/${userId}/history`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return data || [];
    } catch (error: any) {
      console.error(`❌ Error getting user entry history for ${userId}:`, error);
      return [];
    }
  }

  async getStudentGatePassRequests(regNo: string): Promise<{ success: boolean; requests?: any[]; message?: string }> {
    try {
      console.log(`📋 Fetching gate pass requests for regNo: ${regNo}`);

      const data = await this.makeRequest(`${this.baseURL}/gate-pass/student/${regNo}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`✅ Fetched ${data.requests?.length || 0} gate pass requests for ${regNo}`);
      return data;
    } catch (error: any) {
      console.error(`❌ Error fetching student gate pass requests for ${regNo}:`, error);
      return {
        success: false,
        message: error.message || 'Network error occurred. Please check your connection and try again.'
      };
    }
  }

  async getStaffPendingGatePassRequests(staffCode: string): Promise<{ success: boolean; requests?: any[]; message?: string }> {
    try {
      console.log(`📋 Fetching pending gate pass requests for staff: ${staffCode}`);

      const data = await this.makeRequest(`${this.baseURL}/gate-pass/staff/${staffCode}/pending`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`✅ Fetched ${data.requests?.length || 0} pending requests for staff ${staffCode}`);
      return data;
    } catch (error: any) {
      console.error(`❌ Error fetching staff pending requests for ${staffCode}:`, error);
      return {
        success: false,
        message: error.message || 'Network error occurred. Please check your connection and try again.'
      };
    }
  }

  async getHODPendingGatePassRequests(hodCode: string): Promise<{ success: boolean; requests?: any[]; message?: string }> {
    try {
      console.log(`📋 Fetching pending gate pass requests for HOD: ${hodCode}`);

      const data = await this.makeRequest(`${this.baseURL}/gate-pass/hod/${hodCode}/pending`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`✅ Fetched ${data.requests?.length || 0} pending requests for HOD ${hodCode}`);
      return data;
    } catch (error: any) {
      console.error(`❌ Error fetching HOD pending requests for ${hodCode}:`, error);
      return {
        success: false,
        message: error.message || 'Network error occurred. Please check your connection and try again.'
      };
    }
  }

  async getStaffDashboardStats(): Promise<any> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/entry-exit/stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return data;
    } catch (error: any) {
      console.error(`❌ Error fetching staff dashboard stats:`, error);
      return { success: false, message: error.message };
    }
  }

  async approveGatePassByStaff(staffCode: string, requestId: number, remark?: string): Promise<{ success: boolean; message: string; request?: any }> {
    try {
      console.log(`✅ Staff ${staffCode} approving gate pass request ${requestId}`);

      const data = await this.makeRequest(`${this.baseURL}/gate-pass/staff/${staffCode}/approve/${requestId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ remark }),
      });

      console.log(`✅ Gate pass request ${requestId} approved by staff ${staffCode}`);
      return data;
    } catch (error: any) {
      console.error(`❌ Error approving gate pass request ${requestId} by staff ${staffCode}:`, error);
      return {
        success: false,
        message: error.message || 'Network error occurred. Please check your connection and try again.'
      };
    }
  }

  async approveGatePassByHOD(hodCode: string, requestId: number, remark?: string): Promise<{ success: boolean; message: string; request?: any }> {
    try {
      console.log(`✅ HOD ${hodCode} approving gate pass request ${requestId}`);

      const data = await this.makeRequest(`${this.baseURL}/gate-pass/hod/${hodCode}/approve/${requestId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ remark }),
      });

      console.log(`✅ Gate pass request ${requestId} approved by HOD ${hodCode}`);
      return data;
    } catch (error: any) {
      console.error(`❌ Error approving gate pass request ${requestId} by HOD ${hodCode}:`, error);
      return {
        success: false,
        message: error.message || 'Network error occurred. Please check your connection and try again.'
      };
    }
  }

  async rejectGatePassByStaff(staffCode: string, requestId: number, reason: string): Promise<{ success: boolean; message: string; request?: any }> {
    try {
      console.log(`❌ Staff ${staffCode} rejecting gate pass request ${requestId}`);

      const data = await this.makeRequest(`${this.baseURL}/gate-pass/staff/${staffCode}/reject/${requestId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });

      console.log(`❌ Gate pass request ${requestId} rejected by staff ${staffCode}`);
      return data;
    } catch (error: any) {
      console.error(`❌ Error rejecting gate pass request ${requestId} by staff ${staffCode}:`, error);
      return {
        success: false,
        message: error.message || 'Network error occurred. Please check your connection and try again.'
      };
    }
  }

  async rejectGatePassByHOD(hodCode: string, requestId: number, reason: string): Promise<{ success: boolean; message: string; request?: any }> {
    try {
      console.log(`❌ HOD ${hodCode} rejecting gate pass request ${requestId}`);

      const data = await this.makeRequest(`${this.baseURL}/gate-pass/hod/${hodCode}/reject/${requestId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });

      console.log(`❌ Gate pass request ${requestId} rejected by HOD ${hodCode}`);
      return data;
    } catch (error: any) {
      console.error(`❌ Error rejecting gate pass request ${requestId} by HOD ${hodCode}:`, error);
      return {
        success: false,
        message: error.message || 'Network error occurred. Please check your connection and try again.'
      };
    }
  }

  // Simplified approve/reject methods (used by dashboard)
  async approveGatePassRequest(requestId: number): Promise<{ success: boolean; message: string; request?: any }> {
    try {
      console.log(`✅ Approving gate pass request ${requestId}`);

      const data = await this.makeRequest(`${this.baseURL}/gate-pass/approve/${requestId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`✅ Gate pass request ${requestId} approved`);
      return data;
    } catch (error: any) {
      console.error(`❌ Error approving gate pass request ${requestId}:`, error);
      return {
        success: false,
        message: error.message || 'Network error occurred. Please check your connection and try again.'
      };
    }
  }

  async rejectGatePassRequest(requestId: number, reason?: string): Promise<{ success: boolean; message: string; request?: any }> {
    try {
      console.log(`❌ Rejecting gate pass request ${requestId}`);

      const data = await this.makeRequest(`${this.baseURL}/gate-pass/reject/${requestId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: reason || 'Rejected by staff' }),
      });

      console.log(`❌ Gate pass request ${requestId} rejected`);
      return data;
    } catch (error: any) {
      console.error(`❌ Error rejecting gate pass request ${requestId}:`, error);
      return {
        success: false,
        message: error.message || 'Network error occurred. Please check your connection and try again.'
      };
    }
  }

  async getGatePassQRCode(requestId: number, identifier: string, isStaff: boolean = false): Promise<{ success: boolean; qrCode?: string; manualCode?: string; message: string }> {
    try {
      const param = isStaff ? `staffCode=${identifier}` : `regNo=${identifier}`;
      const data = await this.makeRequest(`${this.baseURL}/gate-pass/qr-code/${requestId}?${param}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return data;
    } catch (error: any) {
      console.error(`❌ Error fetching QR code for request ${requestId}:`, error);
      return { success: false, message: error.message };
    }
  }

  // Entry/Exit methods
  async recordStudentEntry(regNo: string, location: string): Promise<any> {
    return this.makeRequest(`${this.baseURL}/entry-exit/student/entry`, {
      method: 'POST',
      body: JSON.stringify({ regNo, location, deviceId: 'MOBILE_APP' }),
    });
  }

  async recordStaffEntry(staffCode: string, location: string): Promise<any> {
    return this.makeRequest(`${this.baseURL}/entry-exit/staff/entry`, {
      method: 'POST',
      body: JSON.stringify({ staffCode, location, deviceId: 'MOBILE_APP' }),
    });
  }

  async recordStudentExit(regNo: string, location: string, purpose: string, destination: string): Promise<any> {
    return this.makeRequest(`${this.baseURL}/entry-exit/student/exit`, {
      method: 'POST',
      body: JSON.stringify({ regNo, location, purpose, destination, deviceId: 'MOBILE_APP' }),
    });
  }

  async recordStaffExit(staffCode: string, location: string, purpose: string, destination: string): Promise<any> {
    return this.makeRequest(`${this.baseURL}/entry-exit/staff/exit`, {
      method: 'POST',
      body: JSON.stringify({ staffCode, location, purpose, destination, deviceId: 'MOBILE_APP' }),
    });
  }

  async scanQRCode(requestId: number, location: string): Promise<any> {
    return this.makeRequest(`${this.baseURL}/entry-exit/scan-qr`, {
      method: 'POST',
      body: JSON.stringify({ requestId, location, deviceId: 'MOBILE_APP' }),
    });
  }

  // Dashboard Statistics
  async getDashboardStats(): Promise<any> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/dashboard/stats`, {
        method: 'GET',
      });
      return data;
    } catch (error: any) {
      console.error('❌ Error fetching dashboard stats:', error);
      return { success: false, message: error.message };
    }
  }

  async getRecentActivity(): Promise<any> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/dashboard/recent-activity`, {
        method: 'GET',
      });
      return data;
    } catch (error: any) {
      console.error('❌ Error fetching recent activity:', error);
      return { success: false, message: error.message };
    }
  }

  async getChartData(): Promise<any> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/dashboard/chart-data`, {
        method: 'GET',
      });
      return data;
    } catch (error: any) {
      console.error('❌ Error fetching chart data:', error);
      return { success: false, message: error.message };
    }
  }

  // Entry/Exit Analytics
  async getTodaysEntries(): Promise<any> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/entry-exit/today`, {
        method: 'GET',
      });
      return data;
    } catch (error: any) {
      console.error('❌ Error fetching today\'s entries:', error);
      return [];
    }
  }

  async getEntryExitStats(): Promise<any> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/entry-exit/stats`, {
        method: 'GET',
      });
      return data;
    } catch (error: any) {
      console.error('❌ Error fetching entry/exit stats:', error);
      return { todayEntries: 0, todayExits: 0, currentlyInside: 0 };
    }
  }

  // Bulk Gate Pass methods
  async getStudentsByStaffDepartment(staffCode: string): Promise<{ success: boolean; students?: any[]; message?: string }> {
    try {
      console.log(`📋 Fetching students for staff department: ${staffCode}`);

      const data = await this.makeRequest(`${this.baseURL}/staff/${staffCode}/students`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Map backend DTO fields to frontend Student interface
      if (data.success && data.students) {
        data.students = data.students.map((student: any) => ({
          ...student,
          studentName: student.name || student.studentName || '', // Map 'name' to 'studentName'
          fullName: student.name || student.fullName || '',
          firstName: student.firstName || (student.name ? student.name.split(' ')[0] : ''),
          lastName: student.lastName || (student.name ? student.name.split(' ').slice(1).join(' ') : ''),
        }));
        
        console.log(`✅ Fetched and mapped ${data.students.length} students for staff ${staffCode}`);
      }

      return data;
    } catch (error: any) {
      console.error(`❌ Error fetching students for staff ${staffCode}:`, error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  async createBulkGatePass(requestData: {
    staffCode: string;
    purpose: string;
    reason: string;
    exitDateTime: string;
    returnDateTime: string;
    students: string[];
    includeStaff?: boolean;
    receiverId?: string;
  }): Promise<{ success: boolean; message: string; requestId?: number }> {
    try {
      console.log(`🎫 Creating bulk gate pass for staff: ${requestData.staffCode} with ${requestData.students.length} students`);

      const data = await this.makeRequest(`${this.baseURL}/staff/bulk-gatepass/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (data.success) {
        console.log(`✅ Bulk gate pass created successfully, ID: ${data.requestId}`);
      }

      return data;
    } catch (error: any) {
      console.error(`❌ Error creating bulk gate pass:`, error);

      const errorMsg = error.message || '';

      if (errorMsg.includes('required') || errorMsg.includes('400')) {
        return {
          success: false,
          message: 'Please fill in all required fields and select at least one student.'
        };
      }

      if (errorMsg.includes('404') || errorMsg.includes('not found')) {
        return {
          success: false,
          message: 'Staff member not found. Please check your staff code.'
        };
      }

      if (errorMsg.includes('Receiver')) {
        return {
          success: false,
          message: errorMsg
        };
      }

      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  async getBulkGatePassDetails(requestId: number): Promise<{ success: boolean; request?: any; students?: any[]; requester?: any; message?: string }> {
    try {
      console.log(`📋 Fetching bulk gate pass details for request: ${requestId}`);

      const data = await this.makeRequest(`${this.baseURL}/bulk-pass/${requestId}/students`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`✅ Fetched bulk gate pass details for request ${requestId}`);
      return data;
    } catch (error: any) {
      console.error(`❌ Error fetching bulk gate pass details for ${requestId}:`, error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  async getHODBulkGatePassDetails(requestId: number): Promise<{ success: boolean; request?: any; participants?: any[]; requester?: any; message?: string }> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/hod/bulk-pass/details/${requestId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      return data;
    } catch (error: any) {
      return { success: false, message: this.getFriendlyErrorMessage(error) };
    }
  }

  // Mark QR as used
  async markQRAsUsed(requestId: number): Promise<any> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/gate-pass/use-qr/${requestId}`, {
        method: 'POST',
      });
      return data;
    } catch (error: any) {
      console.error('❌ Error marking QR as used:', error);
      return { success: false, message: error.message };
    }
  }

  // Notification methods
  async getNotifications(userId: string): Promise<{ success: boolean; notifications?: any[]; message?: string }> {
    try {
      console.log(`📬 Fetching notifications for user: ${userId}`);

      // Try security endpoint first, then fall back to general endpoint
      let data;
      try {
        data = await this.makeRequest(`${this.baseURL}/security/notifications/${userId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } catch (error) {
        // Fallback to general notifications endpoint
        data = await this.makeRequest(`${this.baseURL}/notifications/user/${userId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      // Handle both array response and object with notifications property
      const notifications = Array.isArray(data) ? data : (data.notifications || []);
      
      console.log(`✅ Fetched ${notifications.length} notifications for ${userId}`);
      return {
        success: true,
        notifications: notifications
      };
    } catch (error: any) {
      console.error(`❌ Error fetching notifications for ${userId}:`, error);
      return {
        success: true, // Return success with empty array for better UX
        notifications: [],
        message: 'No notifications found'
      };
    }
  }

  async markNotificationAsRead(notificationId: number): Promise<{ success: boolean; message?: string }> {
    try {
      console.log(`✅ Marking notification ${notificationId} as read`);

      const data = await this.makeRequest(`${this.baseURL}/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      return data;
    } catch (error: any) {
      console.error(`❌ Error marking notification ${notificationId} as read:`, error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  async markAllNotificationsAsRead(userId: string): Promise<{ success: boolean; message?: string }> {
    try {
      console.log(`✅ Marking all notifications as read for user: ${userId}`);

      const data = await this.makeRequest(`${this.baseURL}/notifications/${userId}/read-all`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      return data;
    } catch (error: any) {
      console.error(`❌ Error marking all notifications as read for ${userId}:`, error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  async clearAllNotifications(userId: string): Promise<{ success: boolean; message?: string }> {
    try {
      console.log(`🗑️ Clearing all notifications for user: ${userId}`);

      const data = await this.makeRequest(`${this.baseURL}/notifications/${userId}/clear`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      return data;
    } catch (error: any) {
      console.error(`❌ Error clearing notifications for ${userId}:`, error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  // Security Dashboard methods
  async getActivePersons(): Promise<{ success: boolean; data?: any[]; message?: string }> {
    try {
      console.log(`👥 Fetching active persons in campus`);

      const response = await this.makeRequest(`${this.baseURL}/security/active-persons`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Backend returns array directly, wrap it in success response
      const data = Array.isArray(response) ? response : (response.data || []);
      
      console.log(`✅ Fetched ${data.length} active persons`);
      return {
        success: true,
        data: data,
        message: 'Active persons retrieved successfully'
      };
    } catch (error: any) {
      console.error(`❌ Error fetching active persons:`, error);
      // Return empty array instead of error for better UX
      return {
        success: true,
        data: [],
        message: 'No active persons found'
      };
    }
  }


  async getScanHistory(securityId?: string, limit: number = 50): Promise<{ success: boolean; data?: any[]; message?: string }> {
    try {
      console.log(`📜 Fetching scan history${securityId ? ` for ${securityId}` : ''}`);

      // Backend endpoint doesn't use securityId in URL, just query params
      const url = `${this.baseURL}/security/scan-history?limit=${limit}`;

      const response = await this.makeRequest(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Backend returns array directly, wrap it in success response
      const data = Array.isArray(response) ? response : (response.data || []);
      
      console.log(`✅ Fetched ${data.length} scan history records`);
      return {
        success: true,
        data: data,
        message: 'Scan history retrieved successfully'
      };
    } catch (error: any) {
      console.error(`❌ Error fetching scan history:`, error);
      // Return empty array instead of error for better UX
      return {
        success: true,
        data: [],
        message: 'No scan history found'
      };
    }
  }

  async manualExit(personId: number): Promise<{ success: boolean; message?: string }> {
    try {
      console.log(`🚪 Processing manual exit for person ID: ${personId}`);
      const data = await this.makeRequest(`${this.baseURL}/security/manual-exit/${personId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return data;
    } catch (error: any) {
      console.error(`❌ Error in manual exit:`, error);
      return { success: false, message: error.message || 'Failed to process manual exit' };
    }
  }

  // Escalated Visitor methods
  async getEscalatedVisitors(): Promise<{ success: boolean; data?: any[]; message?: string }> {
    try {
      console.log(`🚨 Fetching escalated visitor requests`);

      const data = await this.makeRequest(`${this.baseURL}/security/escalated-visitors`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`✅ Fetched ${data.length || 0} escalated visitors`);
      return {
        success: true,
        data: data
      };
    } catch (error: any) {
      console.error(`❌ Error fetching escalated visitors:`, error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  async approveEscalatedVisitor(visitorId: number, securityId: string): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      console.log(`✅ Approving escalated visitor ${visitorId}`);

      const data = await this.makeRequest(`${this.baseURL}/security/escalated-visitors/${visitorId}/approve?securityId=${securityId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`✅ Visitor approved successfully`);
      return {
        success: true,
        data: data
      };
    } catch (error: any) {
      console.error(`❌ Error approving visitor:`, error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  async rejectEscalatedVisitor(visitorId: number, reason: string): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      console.log(`❌ Rejecting escalated visitor ${visitorId}`);

      const data = await this.makeRequest(`${this.baseURL}/security/escalated-visitors/${visitorId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });

      console.log(`✅ Visitor rejected successfully`);
      return {
        success: true,
        data: data
      };
    } catch (error: any) {
      console.error(`❌ Error rejecting visitor:`, error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  // Department methods
  async getDepartments(): Promise<{ success: boolean; data?: any[]; message?: string }> {
    try {
      console.log(`🏢 Fetching departments`);

      const data = await this.makeRequest(`${this.baseURL}/departments`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`✅ Fetched ${data.length || 0} departments`);
      return {
        success: true,
        data: data
      };
    } catch (error: any) {
      console.error(`❌ Error fetching departments:`, error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  async getStaffByDepartment(departmentCode: string): Promise<{ success: boolean; data?: any[]; message?: string }> {
    try {
      console.log(`👥 Fetching staff for department: ${departmentCode}`);

      const data = await this.makeRequest(`${this.baseURL}/departments/${departmentCode}/staff`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`✅ Fetched ${data.length || 0} staff members`);
      return {
        success: true,
        data: data
      };
    } catch (error: any) {
      console.error(`❌ Error fetching staff for department:`, error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  // Visitor registration (security registers on behalf of visitor)
  async registerVisitorForSecurity(visitorData: any): Promise<{ success: boolean; message?: string; data?: any }> {
    try {
      console.log(`📝 Security registering visitor(s) on behalf`);

      const data = await this.makeRequest(`${this.baseURL}/security/register-visitor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(visitorData),
      });

      console.log(`✅ Visitor(s) registered successfully by security`);
      return data;
    } catch (error: any) {
      console.error(`❌ Error registering visitor:`, error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  // Legacy method - kept for backward compatibility
  async registerVisitor(visitorData: any): Promise<{ success: boolean; message?: string; data?: any }> {
    return this.registerVisitorForSecurity(visitorData);
  }

  // Get visitor requests registered by security (with QR codes)
  async getMyVisitorRequests(securityId: string): Promise<{ success: boolean; data?: any[]; message?: string }> {
    try {
      console.log(`📋 Fetching visitor requests registered by security: ${securityId}`);

      const data = await this.makeRequest(`${this.baseURL}/security/my-visitor-requests?securityId=${securityId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`✅ Fetched ${data.data?.length || 0} visitor requests`);
      return data;
    } catch (error: any) {
      console.error(`❌ Error fetching visitor requests:`, error);
      return {
        success: false,
        data: [],
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  // Mark visitor QR code as collected
  async markVisitorQRCollected(visitorId: number, securityId: string): Promise<{ success: boolean; message?: string }> {
    try {
      console.log(`✅ Marking visitor ${visitorId} QR as collected by ${securityId}`);

      const data = await this.makeRequest(`${this.baseURL}/security/visitor-qr-collected/${visitorId}?securityId=${securityId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`✅ Visitor QR marked as collected`);
      return data;
    } catch (error: any) {
      console.error(`❌ Error marking visitor QR as collected:`, error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  // Staff Visitor Approval Methods
  async getStaffVisitorRequests(staffCode: string): Promise<{ success: boolean; data?: any[]; message?: string }> {
    try {
      console.log(`📋 Fetching visitor requests for staff: ${staffCode}`);

      const data = await this.makeRequest(`${this.baseURL}/staff/visitor-requests?staffId=${staffCode}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`✅ Fetched ${data.length || 0} visitor requests`);
      return {
        success: true,
        data: data
      };
    } catch (error: any) {
      console.error(`❌ Error fetching visitor requests:`, error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  async approveVisitorRequest(requestId: number, remark?: string): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      console.log(`✅ Approving visitor request ${requestId}`);

      const data = await this.makeRequest(`${this.baseURL}/staff/visitor-requests/${requestId}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ remark }),
      });

      console.log(`✅ Visitor request approved successfully`);
      return data;
    } catch (error: any) {
      console.error(`❌ Error approving visitor request:`, error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  async rejectVisitorRequest(requestId: number, reason: string): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      console.log(`❌ Rejecting visitor request ${requestId}`);

      const data = await this.makeRequest(`${this.baseURL}/staff/visitor-requests/${requestId}/reject`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rejectionReason: reason }),
      });

      console.log(`✅ Visitor request rejected successfully`);
      return data;
    } catch (error: any) {
      console.error(`❌ Error rejecting visitor request:`, error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  // HOD Contacts
  async getHODContacts(): Promise<{ success: boolean; data?: any[]; message?: string }> {
    try {
      console.log(`👔 Fetching HOD contacts`);

      const data = await this.makeRequest(`${this.baseURL}/security/hods`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`✅ Fetched ${data.length || 0} HOD contacts`);
      return {
        success: true,
        data: data
      };
    } catch (error: any) {
      console.error(`❌ Error fetching HOD contacts:`, error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  // Unified OTP methods (routes to role-specific methods)
  async sendOTP(userId: string, role: string): Promise<{ success: boolean; message: string; email?: string; maskedEmail?: string }> {
    try {
      console.log(`🔐 Sending OTP for userId: ${userId}, role: ${role}`);

      let response: { success: boolean; message: string; email?: string };
      switch (role.toLowerCase()) {
        case 'student':
          response = await this.sendStudentOTP(userId);
          break;
        case 'staff':
          response = await this.sendStaffOTP(userId);
          break;
        case 'hod':
          response = await this.sendHODOTP(userId);
          break;
        case 'security':
          response = await this.sendSecurityOTP(userId);
          break;
        case 'hr':
          response = await this.sendHROTP(userId);
          break;
        default:
          return {
            success: false,
            message: 'Invalid user role'
          };
      }

      // Add maskedEmail if email is present
      const result: { success: boolean; message: string; email?: string; maskedEmail?: string } = {
        ...response
      };
      
      if (response.success && response.email) {
        result.maskedEmail = this.maskEmail(response.email);
      }

      return result;
    } catch (error: any) {
      console.error(`❌ Error in unified sendOTP:`, error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error, 'user')
      };
    }
  }

  async verifyOTP(userId: string, otp: string, role: string): Promise<{ success: boolean; message: string; user?: any }> {
    try {
      console.log(`🔍 Verifying OTP for userId: ${userId}, role: ${role}`);

      let result: { success: boolean; message: string; user?: any };
      
      switch (role.toLowerCase()) {
        case 'student': {
          const response = await this.verifyStudentOTP(userId, otp);
          result = {
            success: response.success,
            message: response.message,
            user: response.student
          };
          break;
        }
        case 'staff': {
          const response = await this.verifyStaffOTP(userId, otp);
          result = {
            success: response.success,
            message: response.message,
            user: response.staff
          };
          break;
        }
        case 'hod': {
          const response = await this.verifyHODOTP(userId, otp);
          result = {
            success: response.success,
            message: response.message,
            user: response.hod
          };
          break;
        }
        case 'security': {
          const response = await this.verifySecurityOTP(userId, otp);
          result = {
            success: response.success,
            message: response.message,
            user: response.security
          };
          break;
        }
        case 'hr': {
          const response = await this.verifyHROTP(userId, otp);
          result = {
            success: response.success,
            message: response.message,
            user: response.hr
          };
          break;
        }
        default:
          return {
            success: false,
            message: 'Invalid user role'
          };
      }

      return result;
    } catch (error: any) {
      console.error(`❌ Error in unified verifyOTP:`, error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error, 'otp')
      };
    }
  }

  // Helper to mask email addresses
  private maskEmail(email: string): string {
    if (!email || !email.includes('@')) return 'm***@institution.edu';
    
    const [localPart, domain] = email.split('@');
    if (localPart.length <= 2) {
      return `${localPart[0]}***@${domain}`;
    }
    
    return `${localPart[0]}***${localPart[localPart.length - 1]}@${domain}`;
  }

  // HR OTP methods
  async sendHROTP(hrCode: string): Promise<{ success: boolean; message: string; email?: string }> {
    try {
      console.log(`🔐 Sending OTP for hrCode: ${hrCode}`);

      const data = await this.makeRequest(`${this.baseURL}/auth/hr/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hrCode }),
      });

      if (data.success) {
        console.log(`✅ OTP sent successfully to HR: ${data.email}`);
      }

      return data;
    } catch (error: any) {
      console.error(`❌ Error sending HR OTP for ${hrCode}:`, error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error, 'user')
      };
    }
  }

  async verifyHROTP(hrCode: string, otp: string): Promise<{ success: boolean; message: string; user?: any; role?: string; hr?: any }> {
    try {
      console.log(`🔍 Verifying OTP for hrCode: ${hrCode}`);

      const data = await this.makeRequest(`${this.baseURL}/auth/hr/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hrCode, otp }),
      });

      if (data.success) {
        console.log(`✅ HR OTP verified successfully for: ${hrCode}`);
        console.log(`📝 HR data from backend:`, JSON.stringify(data.hr, null, 2));
        
        // Transform backend response to match frontend expectations
        // Backend returns: { success, message, hr: { userId, name, email, ... } }
        // Frontend expects: { success, message, user: {...}, role: "HR" }
        if (data.hr) {
          const hrDTO = data.hr;
          
          // Create HR object with proper field mapping
          const hrUser = {
            id: hrDTO.id,
            hrCode: hrDTO.userId || hrCode, // Backend uses 'userId' for hrCode
            name: hrDTO.name || hrDTO.hrName || '', // Backend uses 'name'
            hrName: hrDTO.name || hrDTO.hrName || '', // Also set hrName for compatibility
            email: hrDTO.email || '',
            phone: hrDTO.phone || '',
            phoneNumber: hrDTO.phone || '', // Backward compatibility
            department: hrDTO.department || '',
            isActive: hrDTO.isActive !== undefined ? hrDTO.isActive : true,
          };
          
          console.log(`📝 Mapped HR object:`, JSON.stringify(hrUser, null, 2));
          
          return {
            success: true,
            message: data.message,
            user: hrUser, // Frontend expects 'user' field
            role: 'HR', // Frontend expects 'role' field
            hr: hrUser // Also keep 'hr' for backward compatibility
          };
        }
      }

      return {
        success: data.success,
        message: data.message
      };
    } catch (error: any) {
      console.error(`❌ Error verifying HR OTP for ${hrCode}:`, error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error, 'otp')
      };
    }
  }

  // Security OTP methods
  async sendSecurityOTP(securityId: string): Promise<{ success: boolean; message: string; email?: string }> {
    try {
      console.log(`🔐 Sending OTP for securityId: ${securityId}`);

      const data = await this.makeRequest(`${this.baseURL}/auth/login/security-id`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ securityId }),
      });

      if (data.success) {
        console.log(`✅ OTP sent successfully to: ${data.email}`);
      }

      return data;
    } catch (error: any) {
      console.error(`❌ Error sending security OTP for ${securityId}:`, error);

      // Check for user not found
      const errorMsg = error.message || '';
      if (errorMsg.includes('404') || errorMsg.includes('not found')) {
        return {
          success: false,
          message: 'Security personnel not found. Please check your security ID.'
        };
      }

      return {
        success: false,
        message: this.getFriendlyErrorMessage(error, 'user')
      };
    }
  }

  async verifySecurityOTP(securityId: string, otp: string): Promise<{ success: boolean; message: string; security?: any }> {
    try {
      console.log(`🔍 Verifying OTP for securityId: ${securityId}, OTP: ${otp}`);

      const data = await this.makeRequest(`${this.baseURL}/auth/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ securityId, otp }),
      });

      if (data.success) {
        console.log(`✅ OTP verified successfully for securityId: ${securityId}`);
        
        // Map DTO fields to SecurityPersonnel type
        if (data.security) {
          data.security.securityId = data.security.userId || data.security.securityId;
          data.security.securityName = data.security.name;
          data.security.gateAssignment = data.security.department; // Department field used for gate assignment
        }
      }

      return data;
    } catch (error: any) {
      console.error(`❌ Error verifying security OTP for ${securityId}:`, error);

      // Check for specific OTP error
      const errorMsg = error.message || '';
      if (errorMsg.includes('401') || errorMsg.includes('Invalid') || errorMsg.includes('OTP')) {
        return {
          success: false,
          message: 'Incorrect OTP. Please check the code and try again.'
        };
      }

      return {
        success: false,
        message: this.getFriendlyErrorMessage(error, 'otp')
      };
    }
  }

  // Request deduplication
  private async deduplicatedRequest<T>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    if (this.pendingRequests.has(key)) {
      console.log(`🔄 Reusing pending request: ${key}`);
      return this.pendingRequests.get(key)!;
    }

    const promise = requestFn().finally(() => {
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  // Cached API call
  async cachedRequest<T>(
    cacheKey: string,
    requestFn: () => Promise<T>,
    ttl: number = 5 * 60 * 1000
  ): Promise<T> {
    const cached = await cacheService.getPersistent<T>(cacheKey);
    if (cached) {
      console.log(`✅ Cache hit: ${cacheKey}`);
      return cached;
    }

    console.log(`🔄 Cache miss: ${cacheKey}`);
    const data = await this.deduplicatedRequest(cacheKey, requestFn);

    await cacheService.setPersistent(cacheKey, data, ttl);
    return data;
  }

  getBaseURL(): string {
    return this.baseURL;
  }

  async setManualIP(ip: string): Promise<boolean> {
    this.baseURL = `http://${ip}:8080/api`;
    return true;
  }

  async clearManualIP(): Promise<void> {
    this.baseURL = API_BASE_URL;
  }

  async rediscoverBackend(): Promise<boolean> {
    return true;
  }

  // ==================== HOD GATE PASS METHODS ====================
  
  // Submit HOD gate pass request
  async submitHODGatePassRequest(hodCode: string, purpose: string, reason: string, attachmentUri?: string): Promise<{ success: boolean; requestId?: number; message?: string }> {
    try {
      console.log(`📝 Submitting HOD gate pass request for: ${hodCode}`);
      
      const data = await this.makeRequest(`${this.baseURL}/hod/gate-pass/submit`, {
        method: 'POST',
        body: JSON.stringify({
          hodCode,
          purpose,
          reason,
          attachmentUri
        }),
      });

      if (data.status === 'SUCCESS') {
        console.log('✅ HOD gate pass request submitted successfully');
        return {
          success: true,
          requestId: data.requestId,
          message: data.message
        };
      }

      return {
        success: false,
        message: data.message || 'Failed to submit request'
      };
    } catch (error: any) {
      console.error('❌ Error submitting HOD gate pass request:', error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error, 'submit')
      };
    }
  }

  // Get HOD's own gate pass requests
  async getHODMyGatePassRequests(hodCode: string): Promise<{ success: boolean; requests?: any[]; message?: string }> {
    try {
      console.log(`📋 Fetching HOD's own gate pass requests: ${hodCode}`);
      
      const data = await this.makeRequest(`${this.baseURL}/hod/gate-pass/my-requests?hodCode=${hodCode}`, {
        method: 'GET',
      });

      if (data.status === 'SUCCESS') {
        console.log(`✅ Found ${data.count} requests for HOD`);
        return {
          success: true,
          requests: data.requests
        };
      }

      return {
        success: false,
        message: data.message || 'Failed to fetch requests'
      };
    } catch (error: any) {
      console.error('❌ Error fetching HOD gate pass requests:', error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  // Get QR code for HOD's approved request
  async getHODGatePassQRCode(requestId: number, hodCode: string): Promise<{ success: boolean; qrCode?: string; manualCode?: string; message?: string }> {
    try {
      console.log(`🎫 Fetching QR code for HOD request: ${requestId}`);
      
      const data = await this.makeRequest(`${this.baseURL}/hod/gate-pass/${requestId}/qr-code?hodCode=${hodCode}`, {
        method: 'GET',
      });

      if (data.status === 'SUCCESS') {
        console.log('✅ QR code fetched successfully');
        return {
          success: true,
          qrCode: data.qrCode,
          manualCode: data.manualCode
        };
      }

      return {
        success: false,
        message: data.message || 'Failed to fetch QR code'
      };
    } catch (error: any) {
      console.error('❌ Error fetching QR code:', error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  // ==================== HR APPROVAL METHODS ====================
  
  // Get pending requests for HR approval
  async getHRPendingRequests(hrCode: string): Promise<{ success: boolean; requests?: any[]; message?: string }> {
    try {
      console.log(`📋 Fetching pending requests for HR: ${hrCode}`);
      
      const data = await this.makeRequest(`${this.baseURL}/hr/gate-pass/pending?hrCode=${hrCode}`, {
        method: 'GET',
      });

      if (data.status === 'SUCCESS') {
        console.log(`✅ Found ${data.count} pending requests for HR`);
        return {
          success: true,
          requests: data.requests
        };
      }

      return {
        success: false,
        message: data.message || 'Failed to fetch requests'
      };
    } catch (error: any) {
      console.error('❌ Error fetching HR pending requests:', error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  // Get all requests for HR
  async getHRAllRequests(hrCode: string): Promise<{ success: boolean; requests?: any[]; message?: string }> {
    try {
      console.log(`📋 Fetching all requests for HR: ${hrCode}`);
      
      const data = await this.makeRequest(`${this.baseURL}/hr/gate-pass/all?hrCode=${hrCode}`, {
        method: 'GET',
      });

      if (data.status === 'SUCCESS') {
        console.log(`✅ Found ${data.count} total requests for HR`);
        return {
          success: true,
          requests: data.requests
        };
      }

      return {
        success: false,
        message: data.message || 'Failed to fetch requests'
      };
    } catch (error: any) {
      console.error('❌ Error fetching HR requests:', error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  // Approve request as HR
  async approveRequestAsHR(requestId: number, hrCode: string): Promise<{ success: boolean; message?: string }> {
    try {
      console.log(`✅ HR approving request: ${requestId}`);
      
      const data = await this.makeRequest(`${this.baseURL}/hr/gate-pass/${requestId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ hrCode }),
      });

      if (data.status === 'SUCCESS') {
        console.log('✅ Request approved by HR successfully');
        return {
          success: true,
          message: data.message
        };
      }

      return {
        success: false,
        message: data.message || 'Failed to approve request'
      };
    } catch (error: any) {
      console.error('❌ Error approving request as HR:', error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  // Reject request as HR
  async rejectRequestAsHR(requestId: number, hrCode: string, reason: string): Promise<{ success: boolean; message?: string }> {
    try {
      console.log(`❌ HR rejecting request: ${requestId}`);
      
      const data = await this.makeRequest(`${this.baseURL}/hr/gate-pass/${requestId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ hrCode, reason }),
      });

      if (data.status === 'SUCCESS') {
        console.log('✅ Request rejected by HR successfully');
        return {
          success: true,
          message: data.message
        };
      }

      return {
        success: false,
        message: data.message || 'Failed to reject request'
      };
    } catch (error: any) {
      console.error('❌ Error rejecting request as HR:', error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  // Get pending count for HR
  async getHRPendingCount(hrCode: string): Promise<{ success: boolean; count?: number; message?: string }> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/hr/gate-pass/pending-count?hrCode=${hrCode}`, {
        method: 'GET',
      });

      if (data.status === 'SUCCESS') {
        return {
          success: true,
          count: data.count
        };
      }

      return {
        success: false,
        message: data.message || 'Failed to fetch count'
      };
    } catch (error: any) {
      console.error('❌ Error fetching HR pending count:', error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  // ==================== HOD BULK GATE PASS METHODS ====================

  // Get students from HOD's department with optional year filter
  async getHODDepartmentStudents(hodCode: string, year?: number): Promise<{ success: boolean; students?: any[]; message?: string }> {
    try {
      console.log(`📋 Fetching students for HOD ${hodCode}, year: ${year || 'All'}`);
      
      const yearParam = year ? `?year=${year}` : '';
      const data = await this.makeRequest(`${this.baseURL}/hod/${hodCode}/department/students${yearParam}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`✅ Fetched ${data.students?.length || 0} students for HOD ${hodCode}`);
      return data;
    } catch (error: any) {
      console.error(`❌ Error fetching HOD department students:`, error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  // Get staff from HOD's department
  async getHODDepartmentStaff(hodCode: string): Promise<{ success: boolean; staff?: any[]; message?: string }> {
    try {
      console.log(`📋 Fetching staff for HOD ${hodCode}`);
      
      const data = await this.makeRequest(`${this.baseURL}/hod/${hodCode}/department/staff`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`✅ Fetched ${data.staff?.length || 0} staff for HOD ${hodCode}`);
      return data;
    } catch (error: any) {
      console.error(`❌ Error fetching HOD department staff:`, error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  // Submit HOD bulk gate pass request
  async submitHODBulkGatePass(requestData: {
    hodCode: string;
    purpose: string;
    reason: string;
    exitDateTime: string;
    returnDateTime: string;
    participantType: 'students' | 'staff' | 'mixed';
    participants: string[];
    participantDetails?: any[];
    includeHOD: boolean;
    receiverId?: string;
    receiverType?: string;
  }): Promise<{ success: boolean; message?: string; requestId?: number }> {
    try {
      console.log(`📤 Submitting HOD bulk gate pass:`, requestData);
      
      const data = await this.makeRequest(`${this.baseURL}/hod/${requestData.hodCode}/bulk-gate-pass`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      console.log(`✅ HOD bulk gate pass submitted successfully`);
      return data;
    } catch (error: any) {
      console.error(`❌ Error submitting HOD bulk gate pass:`, error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  // Get HOD bulk pass requests
  async getHODBulkPassRequests(hodCode: string): Promise<{ success: boolean; requests?: any[]; message?: string }> {
    try {
      console.log(`📋 Fetching HOD bulk pass requests for: ${hodCode}`);
      
      const data = await this.makeRequest(`${this.baseURL}/hod/${hodCode}/bulk-pass/requests`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`✅ Fetched ${data.requests?.length || 0} bulk pass requests for HOD ${hodCode}`);
      return data;
    } catch (error: any) {
      console.error(`❌ Error fetching HOD bulk pass requests:`, error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  // Get Staff bulk pass requests
  async getStaffBulkPassRequests(staffCode: string): Promise<{ success: boolean; requests?: any[]; message?: string }> {
    try {
      console.log(`📋 Fetching Staff bulk pass requests for: ${staffCode}`);
      
      const data = await this.makeRequest(`${this.baseURL}/staff/${staffCode}/bulk-pass/requests`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`✅ Fetched ${data.requests?.length || 0} bulk pass requests for Staff ${staffCode}`);
      return data;
    } catch (error: any) {
      console.error(`❌ Error fetching Staff bulk pass requests:`, error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  // Get HOD bulk pass details
  async getHODBulkPassDetails(hodCode: string, requestId: number): Promise<{ success: boolean; request?: any; participants?: any[]; message?: string }> {
    try {
      console.log(`📋 Fetching HOD bulk pass details for request: ${requestId}`);
      
      const data = await this.makeRequest(`${this.baseURL}/hod/${hodCode}/bulk-pass/${requestId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`✅ Fetched bulk pass details for request ${requestId}`);
      return data;
    } catch (error: any) {
      console.error(`❌ Error fetching HOD bulk pass details:`, error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  // Get HR pending bulk passes (broadcast to all HRs)
  async getHRPendingBulkPasses(): Promise<{ success: boolean; requests?: any[]; message?: string }> {
    try {
      console.log(`📋 Fetching pending HOD bulk passes for HR`);
      
      const data = await this.makeRequest(`${this.baseURL}/hr/bulk-pass/pending`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`✅ Fetched ${data.requests?.length || 0} pending bulk passes for HR`);
      return data;
    } catch (error: any) {
      console.error(`❌ Error fetching HR pending bulk passes:`, error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  // Get HR bulk pass details
  async getHRBulkPassDetails(requestId: number): Promise<{ success: boolean; request?: any; participants?: any[]; message?: string }> {
    try {
      console.log(`📋 Fetching HR bulk pass details for request: ${requestId}`);
      
      const data = await this.makeRequest(`${this.baseURL}/hr/bulk-pass/${requestId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`✅ Fetched bulk pass details for request ${requestId}`);
      return data;
    } catch (error: any) {
      console.error(`❌ Error fetching HR bulk pass details:`, error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  // Approve HOD bulk pass (HR)
  async approveHODBulkPass(requestId: number, hrCode: string): Promise<{ success: boolean; message?: string; qrCode?: string }> {
    try {
      console.log(`✅ HR ${hrCode} approving HOD bulk pass request ${requestId}`);
      
      const requestBody = { hrCode };
      console.log('📤 Request body:', JSON.stringify(requestBody));
      console.log('📤 Request URL:', `${this.baseURL}/hr/bulk-pass/${requestId}/approve`);
      
      const data = await this.makeRequest(`${this.baseURL}/hr/bulk-pass/${requestId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log(`✅ HOD bulk pass request ${requestId} approved by HR ${hrCode}`);
      return data;
    } catch (error: any) {
      console.error(`❌ Error approving HOD bulk pass request:`, error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  // Reject HOD bulk pass (HR)
  async rejectHODBulkPass(requestId: number, hrCode: string, reason: string): Promise<{ success: boolean; message?: string }> {
    try {
      console.log(`❌ HR ${hrCode} rejecting HOD bulk pass request ${requestId}`);
      
      const data = await this.makeRequest(`${this.baseURL}/hr/bulk-pass/${requestId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hrCode, reason }),
      });

      console.log(`❌ HOD bulk pass request ${requestId} rejected by HR ${hrCode}`);
      return data;
    } catch (error: any) {
      console.error(`❌ Error rejecting HOD bulk pass request:`, error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  // Get HR pending bulk pass count
  async getHRPendingBulkPassCount(): Promise<{ success: boolean; count?: number; message?: string }> {
    try {
      const data = await this.makeRequest(`${this.baseURL}/hr/bulk-pass/pending/count`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      return data;
    } catch (error: any) {
      console.error(`❌ Error fetching HR pending bulk pass count:`, error);
      return {
        success: false,
        count: 0,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  // ============================================
  // VEHICLE MANAGEMENT
  // ============================================

  // Search vehicle by license plate
  async searchVehicle(licensePlate: string): Promise<{ success: boolean; data?: any[]; message?: string }> {
    try {
      console.log(`🔍 Searching for vehicle: ${licensePlate}`);
      
      const data = await this.makeRequest(`${this.baseURL}/security/vehicles/search?licensePlate=${encodeURIComponent(licensePlate)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`✅ Vehicle search completed`);
      return data;
    } catch (error: any) {
      console.error(`❌ Error searching vehicle:`, error);
      return {
        success: false,
        data: [],
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  // Register new vehicle
  async registerVehicle(vehicleData: {
    licensePlate: string;
    vehicleType: string;
    vehicleModel?: string;
    vehicleColor?: string;
    ownerName: string;
    ownerPhone: string;
    ownerType?: string;
    registeredBy: string;
  }): Promise<{ success: boolean; message?: string; data?: any }> {
    try {
      console.log(`🚗 Registering vehicle: ${vehicleData.licensePlate}`);
      
      const data = await this.makeRequest(`${this.baseURL}/security/vehicles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(vehicleData),
      });

      console.log(`✅ Vehicle registered successfully`);
      return data;
    } catch (error: any) {
      console.error(`❌ Error registering vehicle:`, error);
      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  // Get vehicle history
  async getVehicles(): Promise<{ success: boolean; data?: any[]; message?: string }> {
    return this.getVehicleHistory();
  }

  async getVehicleHistory(): Promise<{ success: boolean; data?: any[]; message?: string }> {
    try {
      console.log(`📋 Fetching vehicle history`);
      
      const data = await this.makeRequest(`${this.baseURL}/security/vehicles`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`✅ Fetched vehicle history`);
      return data;
    } catch (error: any) {
      console.error(`❌ Error fetching vehicle history:`, error);
      return {
        success: false,
        data: [],
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  // QR Code Login
  async qrLogin(qrData: string): Promise<{ success: boolean; message: string; user?: any; role?: string }> {
    try {
      console.log(`📱 QR Login attempt with data: ${qrData}`);

      const data = await this.makeRequest(`${this.baseURL}/auth/qr-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ qrData }),
      });

      if (data.success) {
        console.log(`✅ QR Login successful for role: ${data.role}`);
        
        // Extract user data based on role
        let user = null;
        const role = data.role?.toUpperCase();
        
        switch (role) {
          case 'STUDENT':
            user = data.student;
            break;
          case 'STAFF':
            user = data.staff;
            break;
          case 'HOD':
            user = data.hod;
            break;
          case 'HR':
            user = data.hr;
            break;
          case 'SECURITY':
            user = data.security;
            break;
        }

        return {
          success: true,
          message: data.message || 'QR login successful',
          user,
          role
        };
      }

      return {
        success: false,
        message: data.message || 'QR login failed'
      };
    } catch (error: any) {
      console.error(`❌ Error in QR login:`, error);

      const errorMsg = error.message || '';
      
      // Check for specific errors
      if (errorMsg.includes('404') || errorMsg.includes('not found')) {
        return {
          success: false,
          message: 'User not found. Please check your QR code.'
        };
      }

      if (errorMsg.includes('403') || errorMsg.includes('inactive')) {
        return {
          success: false,
          message: 'Account is inactive. Please contact administration.'
        };
      }

      if (errorMsg.includes('Invalid QR')) {
        return {
          success: false,
          message: 'Invalid QR code format. Please use a valid campus QR code.'
        };
      }

      return {
        success: false,
        message: this.getFriendlyErrorMessage(error)
      };
    }
  }

  // Scan QR Code for Entry
  async scanQREntry(qrData: string, scannedBy: string): Promise<{ success: boolean; message?: string; data?: any }> {
    try {
      console.log('🚀 [API] scanQREntry called');
      console.log('📦 [API] QR Data:', qrData);
      console.log('👤 [API] Scanned By:', scannedBy);
      console.log('📍 [API] URL:', `${this.baseURL}/security/scan`);
      
      const data = await this.makeRequest(`${this.baseURL}/security/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ qrCode: qrData }),
      });
      
      console.log('✅ [API] scanQREntry response:', data);
      
      // Backend returns status: "APPROVED" for success, "DENIED" for failure
      // Also check accessGranted field
      const isSuccess = data.status === 'APPROVED' || data.status === 'VALID' || data.accessGranted === true;
      
      return {
        success: isSuccess,
        message: data.message || (isSuccess ? 'Entry recorded successfully' : 'Access denied'),
        data: data,
      };
    } catch (error: any) {
      console.error('❌ [API] scanQREntry error:', error);
      return {
        success: false,
        message: error.message || 'Failed to scan QR code for entry',
      };
    }
  }

  // Scan QR Code for Exit
  async scanQRExit(qrData: string, scannedBy: string): Promise<{ success: boolean; message?: string; data?: any }> {
    try {
      console.log('🚀 [API] scanQRExit called');
      console.log('📦 [API] QR Data:', qrData);
      console.log('👤 [API] Scanned By:', scannedBy);
      console.log('📍 [API] URL:', `${this.baseURL}/security/scan`);
      
      const data = await this.makeRequest(`${this.baseURL}/security/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ qrCode: qrData }),
      });
      
      console.log('✅ [API] scanQRExit response:', data);
      
      // Backend returns status: "APPROVED" for success, "DENIED" for failure
      // Also check accessGranted field
      const isSuccess = data.status === 'APPROVED' || data.status === 'VALID' || data.accessGranted === true;
      
      return {
        success: isSuccess,
        message: data.message || (isSuccess ? 'Exit recorded successfully' : 'Access denied'),
        data: data,
      };
    } catch (error: any) {
      console.error('❌ [API] scanQRExit error:', error);
      return {
        success: false,
        message: error.message || 'Failed to scan QR code for exit',
      };
    }
  }

  // Scan Late Entry (for plain ID codes - students/staff/HODs arriving late)
  async scanLateEntry(idCode: string, securityId: string): Promise<{ success: boolean; message?: string; data?: any }> {
    try {
      console.log('🚀 [API] scanLateEntry called');
      console.log('📦 [API] ID Code:', idCode);
      console.log('👤 [API] Security ID:', securityId);
      console.log('📍 [API] URL:', `${this.baseURL}/security/scan-late-entry`);
      
      const data = await this.makeRequest(`${this.baseURL}/security/scan-late-entry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idCode, securityId }),
      });
      
      console.log('✅ [API] scanLateEntry response:', data);
      
      return {
        success: data.success || false,
        message: data.message || 'Late entry recorded successfully',
        data: data,
      };
    } catch (error: any) {
      console.error('❌ [API] scanLateEntry error:', error);
      return {
        success: false,
        message: error.message || 'Failed to record late entry',
      };
    }
  }
}

export const apiService = new ApiService();
