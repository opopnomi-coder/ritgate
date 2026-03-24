import React, { useState, useEffect } from 'react';
import { VisitorRegistration, VisitorResponse, Staff } from '../types';
import { api } from '../services/api';

interface ProfessionalVisitorFormProps {
  onBack?: () => void;
}

interface Department {
  id: string;
  code: string;
  name: string;
}

const ProfessionalVisitorForm: React.FC<ProfessionalVisitorFormProps> = ({ onBack }) => {
  const [numberOfVisitors, setNumberOfVisitors] = useState<number>(1);
  const [visitorNames, setVisitorNames] = useState<string[]>(['']);
  const [mainPersonEmail, setMainPersonEmail] = useState<string>('');
  const [mainPersonPhone, setMainPersonPhone] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedDepartmentCode, setSelectedDepartmentCode] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('');
  const [role, setRole] = useState<'VISITOR' | 'VENDOR'>('VISITOR');
  const [vehicleNumber, setVehicleNumber] = useState<string>('');
  const [staffMembers, setStaffMembers] = useState<Staff[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [loadingStaff, setLoadingStaff] = useState<boolean>(false);
  
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState<boolean>(true);
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState<boolean>(false);
  const [showStaffDropdown, setShowStaffDropdown] = useState<boolean>(false);
  const [showNumberDropdown, setShowNumberDropdown] = useState<boolean>(false);
  const [filteredDepartments, setFilteredDepartments] = useState<Department[]>([]);
  const [filteredStaff, setFilteredStaff] = useState<Staff[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [registeredVisitor, setRegisteredVisitor] = useState<VisitorResponse | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [approvedQrCode, setApprovedQrCode] = useState<string>('');
  const [approvedManualCode, setApprovedManualCode] = useState<string>('');
  const [error, setError] = useState<string>('');
  
  const [focusedField, setFocusedField] = useState<string>('');
  const [hoveredCard, setHoveredCard] = useState<string>('');
  const [hoveredBack, setHoveredBack] = useState<boolean>(false);
  const [machineId] = useState<string>(() => {
    const key = 'ritgate_machine_id';
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const created = `WEB-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(key, created);
    return created;
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      document.body.style.overflow = 'auto';
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        setLoadingDepartments(true);
        const apiBase = process.env.REACT_APP_API_URL || 'https://ritgate-backend.onrender.com/api';
        const response = await fetch(`${apiBase}/departments`);
        if (!response.ok) throw new Error('Failed to fetch departments');
        const data = await response.json();
        // Backend returns array or { departments: [...] }
        const list: Department[] = Array.isArray(data) ? data : (data.departments || data.data || []);
        setDepartments(list);
        setFilteredDepartments(list);
      } catch (err) {
        console.error('Error fetching departments:', err);
        setError('Failed to load departments. Please refresh the page.');
      } finally {
        setLoadingDepartments(false);
      }
    };

    fetchDepartments();
  }, []);

  const handleNumberOfVisitorsChange = (value: number) => {
    setNumberOfVisitors(value);
    const newNames = Array(value).fill('').map((_, index) => visitorNames[index] || '');
    setVisitorNames(newNames);
    setShowNumberDropdown(false);
  };

  const handleVisitorNameChange = (index: number, value: string) => {
    const newNames = [...visitorNames];
    newNames[index] = value;
    setVisitorNames(newNames);
    setError('');
  };

  const handleDepartmentChange = async (dept: Department) => {
    setSelectedDepartment(dept.name);
    setSelectedDepartmentCode(dept.code);
    setSelectedStaff('');
    setSelectedStaffId('');
    setStaffMembers([]);
    setError('');
    setShowDepartmentDropdown(false);
    
    if (dept.code) {
      setLoadingStaff(true);
      try {
        const apiBase = process.env.REACT_APP_API_URL || 'https://ritgate-backend.onrender.com/api';
        const response = await fetch(`${apiBase}/departments/${encodeURIComponent(dept.code)}/staff-list`);
        if (!response.ok) throw new Error('Failed to fetch staff');
        const staff: Staff[] = await response.json();
        setStaffMembers(staff);
        setFilteredStaff(staff);
      } catch (err) {
        console.error('Error fetching staff:', err);
        setError('Failed to load staff members');
      } finally {
        setLoadingStaff(false);
      }
    }
  };
  
  const handleDepartmentInputChange = (value: string) => {
    setSelectedDepartment(value);
    const filtered = departments.filter(dept => 
      dept.name.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredDepartments(filtered);
    setShowDepartmentDropdown(true);
  };
  
  const handleStaffInputChange = (value: string) => {
    setSelectedStaff(value);
    const filtered = staffMembers.filter(staff => 
      staff.name.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredStaff(filtered);
    setShowStaffDropdown(true);
  };
  
  const selectDepartment = (dept: Department) => {
    handleDepartmentChange(dept);
  };
  
  const selectStaff = (staff: Staff) => {
    setSelectedStaff(staff.name);
    setSelectedStaffId(staff.staffCode || staff.id);
    setShowStaffDropdown(false);
  };

  const validateForm = (): boolean => {
    if (visitorNames.some(name => !name.trim())) {
      setError('Please enter names for all visitors');
      return false;
    }
    
    if (!mainPersonEmail.trim() || !mainPersonEmail.includes('@')) {
      setError('Please enter a valid email address');
      return false;
    }
    
    if (!mainPersonPhone.trim() || mainPersonPhone.length < 10) {
      setError('Please enter a valid phone number (minimum 10 digits)');
      return false;
    }
    
    if (!selectedDepartment) {
      setError('Please select a department to visit');
      return false;
    }
    
    if (!selectedStaff) {
      setError('Please select a person to meet');
      return false;
    }
    
    if (!purpose.trim()) {
      setError('Please enter the purpose of your visit');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Use unified visitor endpoint that generates manual codes
      const apiBase = process.env.REACT_APP_API_URL || 'https://ritgate-backend.onrender.com/api';
      const response = await fetch(`${apiBase}/unified-visitors/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: visitorNames[0],
          email: mainPersonEmail,
          phone: mainPersonPhone,
          role,
          machineId,
          department: selectedDepartment,
          staffCode: selectedStaffId,
          purpose: purpose,
          reason: '', // Optional additional reason
          numberOfPeople: numberOfVisitors,
          vehicleNumber: vehicleNumber || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to register visitor');
      }

      const visitor = await response.json();
      setRegisteredVisitor(visitor);
      setApprovalStatus('PENDING');
      setShowSuccess(true);
      
      setNumberOfVisitors(1);
      setVisitorNames(['']);
      setMainPersonEmail('');
      setMainPersonPhone('');
      setSelectedDepartment('');
      setPurpose('');
      setRole('VISITOR');
      setVehicleNumber('');
      setStaffMembers([]);
      setSelectedStaff('');
    } catch (err) {
      setError('Failed to register. Please try again or contact security.');
      console.error('Registration error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewRegistration = () => {
    setShowSuccess(false);
    setRegisteredVisitor(null);
    setApprovalStatus('PENDING');
    setApprovedQrCode('');
    setApprovedManualCode('');
  };

  useEffect(() => {
    if (!showSuccess || !registeredVisitor?.id) return;
    if (approvalStatus === 'APPROVED' || approvalStatus === 'REJECTED') return;

    const apiBase = process.env.REACT_APP_API_URL || 'https://ritgate-backend.onrender.com/api';
    const interval = setInterval(async () => {
      try {
        const resp = await fetch(
          `${apiBase}/unified-visitors/status/${registeredVisitor.id}?machineId=${encodeURIComponent(machineId)}`
        );
        if (!resp.ok) return;
        const data = await resp.json();
        if (data?.success && data?.status) {
          const status = String(data.status).toUpperCase();
          if (status === 'APPROVED') {
            setApprovalStatus('APPROVED');
            setApprovedQrCode(data.qrCode || '');
            setApprovedManualCode(data.manualCode || '');
          } else if (status === 'REJECTED') {
            setApprovalStatus('REJECTED');
          } else {
            setApprovalStatus('PENDING');
          }
        }
      } catch (_) {}
    }, 5000);

    return () => clearInterval(interval);
  }, [showSuccess, registeredVisitor?.id, machineId, approvalStatus]);

  // Styles
  const styles = {
    container: {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #00BCD4 0%, #0097A7 100%)',
      padding: '40px 20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
    backButton: (isHovered: boolean) => ({
      position: 'fixed' as const,
      top: '20px',
      left: '20px',
      padding: '12px 24px',
      fontSize: '15px',
      fontWeight: '600',
      color: '#ffffff',
      background: isHovered ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)',
      border: '2px solid rgba(255,255,255,0.3)',
      borderRadius: '12px',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      backdropFilter: 'blur(10px)',
      boxShadow: isHovered ? '0 4px 15px rgba(0,0,0,0.2)' : '0 2px 10px rgba(0,0,0,0.1)',
      transform: isHovered ? 'translateX(-4px)' : 'translateX(0)',
      zIndex: 1000,
    }),
    formWrapper: {
      maxWidth: '800px',
      margin: '0 auto',
      animation: 'slideUp 0.6s ease-out',
    },
    header: {
      textAlign: 'center' as const,
      marginBottom: '40px',
      animation: 'fadeIn 0.8s ease-out',
    },
    title: {
      fontSize: '42px',
      fontWeight: '800',
      color: '#ffffff',
      marginBottom: '12px',
      textShadow: '0 2px 20px rgba(0,0,0,0.2)',
      letterSpacing: '-0.5px',
    },
    subtitle: {
      fontSize: '18px',
      color: 'rgba(255,255,255,0.9)',
      fontWeight: '400',
    },
    formCard: {
      background: '#ffffff',
      borderRadius: '24px',
      padding: '40px',
      boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      animation: 'scaleIn 0.5s ease-out',
    },
    sectionTitle: {
      fontSize: '14px',
      fontWeight: '700',
      color: '#00BCD4',
      textTransform: 'uppercase' as const,
      letterSpacing: '1px',
      marginBottom: '16px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    inputGroup: {
      marginBottom: '24px',
      position: 'relative' as const,
    },
    label: {
      display: 'block',
      fontSize: '14px',
      fontWeight: '600',
      color: '#374151',
      marginBottom: '8px',
    },
    input: (isFocused: boolean, hasError: boolean) => ({
      width: '100%',
      padding: '14px 16px',
      fontSize: '15px',
      border: `2px solid ${hasError ? '#ef4444' : isFocused ? '#00BCD4' : '#e5e7eb'}`,
      borderRadius: '12px',
      transition: 'all 0.3s ease',
      background: isFocused ? '#ffffff' : '#f9fafb',
      color: '#1f2937',
      outline: 'none',
      boxShadow: isFocused ? '0 0 0 4px rgba(0, 188, 212, 0.1)' : 'none',
      transform: isFocused ? 'translateY(-1px)' : 'none',
    }),
    textarea: (isFocused: boolean) => ({
      width: '100%',
      padding: '14px 16px',
      fontSize: '15px',
      border: `2px solid ${isFocused ? '#00BCD4' : '#e5e7eb'}`,
      borderRadius: '12px',
      transition: 'all 0.3s ease',
      background: isFocused ? '#ffffff' : '#f9fafb',
      color: '#1f2937',
      outline: 'none',
      boxShadow: isFocused ? '0 0 0 4px rgba(0, 188, 212, 0.1)' : 'none',
      minHeight: '120px',
      resize: 'vertical' as const,
      fontFamily: 'inherit',
    }),
    dropdown: {
      position: 'relative' as const,
    },
    dropdownMenu: {
      position: 'absolute' as const,
      top: '100%',
      left: 0,
      right: 0,
      background: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      marginTop: '8px',
      maxHeight: '320px',
      overflowY: 'auto' as const,
      boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
      zIndex: 1000,
      animation: 'dropdownSlide 0.2s ease-out',
    },
    dropdownItem: (isHovered: boolean, isSelected: boolean) => ({
      padding: '16px 20px',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      background: isHovered || isSelected ? '#00BCD4' : 'transparent',
      color: isHovered || isSelected ? '#ffffff' : '#374151',
      fontSize: '15px',
      fontWeight: isSelected ? '600' : '500',
      borderBottom: '1px solid #f3f4f6',
    }),
    submitButton: (isHovered: boolean) => ({
      width: '100%',
      padding: '16px 32px',
      fontSize: '16px',
      fontWeight: '700',
      color: '#ffffff',
      background: isHovered ? 'linear-gradient(135deg, #0097A7 0%, #00BCD4 100%)' : 'linear-gradient(135deg, #00BCD4 0%, #0097A7 100%)',
      border: 'none',
      borderRadius: '12px',
      cursor: isSubmitting ? 'not-allowed' : 'pointer',
      transition: 'all 0.3s ease',
      boxShadow: isHovered ? '0 12px 35px rgba(0, 188, 212, 0.4)' : '0 8px 25px rgba(0, 188, 212, 0.3)',
      transform: isHovered && !isSubmitting ? 'translateY(-2px)' : 'none',
      opacity: isSubmitting ? 0.7 : 1,
    }),
    errorMessage: {
      background: '#fee2e2',
      color: '#991b1b',
      padding: '14px 18px',
      borderRadius: '12px',
      fontSize: '14px',
      fontWeight: '600',
      marginBottom: '20px',
      border: '2px solid #fecaca',
      animation: 'shake 0.5s ease',
    },
    successContainer: {
      textAlign: 'center' as const,
      animation: 'fadeIn 0.6s ease-out',
    },
    successIcon: {
      width: '80px',
      height: '80px',
      margin: '0 auto 24px',
      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '48px',
      color: '#ffffff',
      animation: 'scaleIn 0.5s ease-out',
      boxShadow: '0 10px 30px rgba(16, 185, 129, 0.3)',
    },
    successTitle: {
      fontSize: '32px',
      fontWeight: '800',
      color: '#10b981',
      marginBottom: '16px',
    },
    successMessage: {
      fontSize: '16px',
      color: '#6b7280',
      marginBottom: '32px',
      lineHeight: '1.6',
    },
    pendingCard: {
      background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
      border: '2px solid #f59e0b',
      borderRadius: '16px',
      padding: '32px',
      marginBottom: '32px',
      textAlign: 'center' as const,
    },
    pendingIcon: {
      fontSize: '48px',
      marginBottom: '16px',
      animation: 'pulse 2s ease-in-out infinite',
    },
    detailsCard: {
      background: '#f9fafb',
      borderRadius: '16px',
      padding: '24px',
      marginBottom: '32px',
    },
    detailRow: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '12px 0',
      borderBottom: '1px solid #e5e7eb',
    },
    staffItem: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '4px',
    },
    staffName: {
      fontWeight: '600',
    },
    staffRole: {
      fontSize: '13px',
      color: '#6b7280',
    },
  };

  const keyframes = `
    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes scaleIn {
      from {
        opacity: 0;
        transform: scale(0.95);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
    
    @keyframes dropdownSlide {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-10px); }
      75% { transform: translateX(10px); }
    }
    
    @keyframes pulse {
      0%, 100% {
        opacity: 1;
        transform: scale(1);
      }
      50% {
        opacity: 0.7;
        transform: scale(1.1);
      }
    }
  `;

  if (showSuccess && registeredVisitor) {
    return (
      <div style={styles.container}>
        <style>{keyframes}</style>
        {onBack && (
          <button
            onClick={onBack}
            style={styles.backButton(hoveredBack)}
            onMouseEnter={() => setHoveredBack(true)}
            onMouseLeave={() => setHoveredBack(false)}
          >
            ← Back to Home
          </button>
        )}
        <div style={styles.formWrapper}>
          <div style={styles.formCard}>
            <div style={styles.successContainer}>
              <div style={styles.successIcon}>✓</div>
              <h2 style={styles.successTitle}>Request Submitted!</h2>
              <p style={styles.successMessage}>
                Your visit request has been sent to {registeredVisitor.personToMeet} for approval.
              </p>
              
              {approvalStatus === 'PENDING' && (
                <div style={styles.pendingCard}>
                  <div style={styles.pendingIcon}>⏳</div>
                  <h3 style={{ fontSize: '22px', fontWeight: '700', color: '#92400e', marginBottom: '12px' }}>
                    Awaiting Approval
                  </h3>
                  <p style={{ fontSize: '15px', color: '#78350f', marginBottom: '8px' }}>
                    This page auto-refreshes and will show your QR + manual code here once approved.
                  </p>
                </div>
              )}
              {approvalStatus === 'APPROVED' && (
                <div style={{ ...styles.pendingCard, background: 'linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 100%)', borderColor: '#16A34A' }}>
                  <div style={styles.pendingIcon}>✅</div>
                  <h3 style={{ fontSize: '22px', fontWeight: '700', color: '#166534', marginBottom: '12px' }}>
                    Approved - Your Pass Is Ready
                  </h3>
                  <p style={{ fontSize: '14px', color: '#166534', marginBottom: '8px', wordBreak: 'break-all' }}>
                    <strong>QR:</strong> {approvedQrCode || 'N/A'}
                  </p>
                  <p style={{ fontSize: '18px', color: '#14532d', fontWeight: 800, letterSpacing: '2px' }}>
                    Manual Code: {approvedManualCode || 'N/A'}
                  </p>
                </div>
              )}
              {approvalStatus === 'REJECTED' && (
                <div style={{ ...styles.pendingCard, background: 'linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)', borderColor: '#EF4444' }}>
                  <div style={styles.pendingIcon}>✗</div>
                  <h3 style={{ fontSize: '22px', fontWeight: '700', color: '#991B1B', marginBottom: '12px' }}>
                    Request Rejected
                  </h3>
                  <p style={{ fontSize: '15px', color: '#991B1B' }}>
                    Your request was rejected by the faculty. Please contact reception for help.
                  </p>
                </div>
              )}
              
              <div style={styles.detailsCard}>
                <div style={styles.detailRow}>
                  <span style={{ fontWeight: '600', color: '#6b7280' }}>Name:</span>
                  <span style={{ fontWeight: '600', color: '#1f2937' }}>{registeredVisitor.name}</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={{ fontWeight: '600', color: '#6b7280' }}>Email:</span>
                  <span style={{ fontWeight: '600', color: '#1f2937' }}>{registeredVisitor.email}</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={{ fontWeight: '600', color: '#6b7280' }}>Department:</span>
                  <span style={{ fontWeight: '600', color: '#1f2937' }}>{registeredVisitor.department}</span>
                </div>
                <div style={{ ...styles.detailRow, borderBottom: 'none' }}>
                  <span style={{ fontWeight: '600', color: '#6b7280' }}>Person to Meet:</span>
                  <span style={{ fontWeight: '600', color: '#1f2937' }}>{registeredVisitor.personToMeet}</span>
                </div>
              </div>
              
              <button
                onClick={handleNewRegistration}
                style={styles.submitButton(false)}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
              >
                Register Another Visitor
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <style>{keyframes}</style>
      {onBack && (
        <button
          onClick={onBack}
          style={styles.backButton(hoveredBack)}
          onMouseEnter={() => setHoveredBack(true)}
          onMouseLeave={() => setHoveredBack(false)}
        >
          ← Back to Home
        </button>
      )}
      <div style={styles.formWrapper}>
        <div style={styles.header}>
          <h1 style={styles.title}>Visitor Registration</h1>
          <p style={styles.subtitle}>Welcome to our campus. Please fill in your details below.</p>
        </div>
        
        <div style={styles.formCard}>
          {error && (
            <div style={styles.errorMessage}>
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            {/* Number of Visitors */}
            <div style={styles.inputGroup}>
              <div style={styles.sectionTitle}>
                <span>👥</span> VISITOR INFORMATION
              </div>
              <label style={styles.label}>Number of Visitors</label>
              <div style={styles.dropdown}>
                <input
                  type="text"
                  value={`${numberOfVisitors} ${numberOfVisitors === 1 ? 'Person' : 'People'}`}
                  readOnly
                  onClick={() => setShowNumberDropdown(!showNumberDropdown)}
                  onFocus={() => setFocusedField('number')}
                  onBlur={() => setFocusedField('')}
                  style={{
                    ...styles.input(focusedField === 'number', false),
                    cursor: 'pointer',
                  }}
                />
                {showNumberDropdown && (
                  <div style={styles.dropdownMenu}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                      <div
                        key={num}
                        style={styles.dropdownItem(hoveredCard === `num-${num}`, numberOfVisitors === num)}
                        onMouseEnter={() => setHoveredCard(`num-${num}`)}
                        onMouseLeave={() => setHoveredCard('')}
                        onClick={() => handleNumberOfVisitorsChange(num)}
                      >
                        {numberOfVisitors === num && '✓ '}
                        {num} {num === 1 ? 'Person' : 'People'}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Visitor Names */}
            <div style={styles.inputGroup}>
              <label style={styles.label}>Visitor Name(s)</label>
              {visitorNames.map((name, index) => (
                <input
                  key={index}
                  type="text"
                  placeholder={`Visitor ${index + 1} Full Name`}
                  value={name}
                  onChange={(e) => handleVisitorNameChange(index, e.target.value)}
                  onFocus={() => setFocusedField(`name-${index}`)}
                  onBlur={() => setFocusedField('')}
                  style={{
                    ...styles.input(focusedField === `name-${index}`, false),
                    marginBottom: index < visitorNames.length - 1 ? '12px' : '0',
                  }}
                  required
                />
              ))}
            </div>

            {/* Contact Details */}
            <div style={styles.inputGroup}>
              <div style={styles.sectionTitle}>
                <span>📧</span> CONTACT DETAILS
              </div>
              <label style={styles.label}>Email Address</label>
              <input
                type="email"
                placeholder="your.email@example.com"
                value={mainPersonEmail}
                onChange={(e) => setMainPersonEmail(e.target.value)}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField('')}
                style={styles.input(focusedField === 'email', false)}
                required
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Phone Number</label>
              <input
                type="tel"
                placeholder="+91 XXXXX XXXXX"
                value={mainPersonPhone}
                onChange={(e) => setMainPersonPhone(e.target.value)}
                onFocus={() => setFocusedField('phone')}
                onBlur={() => setFocusedField('')}
                style={styles.input(focusedField === 'phone', false)}
                required
              />
            </div>

            {/* Department */}
            <div style={styles.inputGroup}>
              <label style={styles.label}>Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'VISITOR' | 'VENDOR')}
                style={styles.input(focusedField === 'role', false)}
                onFocus={() => setFocusedField('role')}
                onBlur={() => setFocusedField('')}
              >
                <option value="VISITOR">Visitor</option>
                <option value="VENDOR">Vendor</option>
              </select>
            </div>

            {/* Department */}
            <div style={styles.inputGroup}>
              <div style={styles.sectionTitle}>
                <span>🏢</span> VISIT DETAILS
              </div>
              <label style={styles.label}>Department to Visit</label>
              {loadingDepartments ? (
                <div style={{ padding: '14px 16px', textAlign: 'center', color: '#6b7280', background: '#f9fafb', borderRadius: '12px' }}>
                  Loading departments...
                </div>
              ) : (
                <div style={styles.dropdown}>
                  <input
                    type="text"
                    placeholder="Select or type department name"
                    value={selectedDepartment}
                    onChange={(e) => handleDepartmentInputChange(e.target.value)}
                    onFocus={() => {
                      setFocusedField('department');
                      setShowDepartmentDropdown(true);
                      setFilteredDepartments(departments);
                    }}
                    onBlur={() => {
                      setFocusedField('');
                      setTimeout(() => setShowDepartmentDropdown(false), 200);
                    }}
                    style={styles.input(focusedField === 'department', false)}
                    required
                  />
                  {showDepartmentDropdown && filteredDepartments.length > 0 && (
                    <div style={styles.dropdownMenu}>
                      {filteredDepartments.map((dept) => (
                        <div
                          key={dept.code}
                          style={styles.dropdownItem(hoveredCard === `dept-${dept.code}`, selectedDepartment === dept.name)}
                          onMouseEnter={() => setHoveredCard(`dept-${dept.code}`)}
                          onMouseLeave={() => setHoveredCard('')}
                          onClick={() => selectDepartment(dept)}
                        >
                          {selectedDepartment === dept.name && '✓ '}
                          {dept.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Person to Meet */}
            {selectedDepartment && (
              <div style={styles.inputGroup}>
                <label style={styles.label}>Person to Meet</label>
                {loadingStaff ? (
                  <div style={{ padding: '14px 16px', textAlign: 'center', color: '#6b7280', background: '#f9fafb', borderRadius: '12px' }}>
                    Loading staff members...
                  </div>
                ) : (
                  <div style={styles.dropdown}>
                    <input
                      type="text"
                      placeholder="Select or type staff member name"
                      value={selectedStaff}
                      onChange={(e) => handleStaffInputChange(e.target.value)}
                      onFocus={() => {
                        setFocusedField('staff');
                        setShowStaffDropdown(true);
                        setFilteredStaff(staffMembers);
                      }}
                      onBlur={() => {
                        setFocusedField('');
                        setTimeout(() => setShowStaffDropdown(false), 200);
                      }}
                      style={styles.input(focusedField === 'staff', false)}
                      required
                    />
                    {showStaffDropdown && filteredStaff.length > 0 && (
                      <div style={styles.dropdownMenu}>
                        {filteredStaff.map((staff) => (
                          <div
                            key={staff.id}
                            style={styles.dropdownItem(hoveredCard === `staff-${staff.id}`, selectedStaff === staff.name)}
                            onMouseEnter={() => setHoveredCard(`staff-${staff.id}`)}
                            onMouseLeave={() => setHoveredCard('')}
                            onClick={() => selectStaff(staff)}
                          >
                            <div style={styles.staffItem}>
                              <div style={styles.staffName}>
                                {selectedStaff === staff.name && '✓ '}
                                {staff.name}
                                <span style={{
                                  marginLeft: '8px',
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  color: hoveredCard === `staff-${staff.id}` || selectedStaff === staff.name ? 'rgba(255,255,255,0.9)' : '#00BCD4',
                                  backgroundColor: hoveredCard === `staff-${staff.id}` || selectedStaff === staff.name ? 'rgba(255,255,255,0.15)' : 'rgba(0,188,212,0.1)',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                }}>
                                  {staff.role || 'Faculty'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Purpose */}
            <div style={styles.inputGroup}>
              <label style={styles.label}>Purpose of Visit</label>
              <textarea
                placeholder="Please describe the purpose of your visit..."
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                onFocus={() => setFocusedField('purpose')}
                onBlur={() => setFocusedField('')}
                style={styles.textarea(focusedField === 'purpose')}
                required
              />
            </div>

            {/* Vehicle Number */}
            <div style={styles.inputGroup}>
              <label style={styles.label}>Vehicle Number (Optional)</label>
              <input
                type="text"
                placeholder="e.g., KA01AB1234"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                onFocus={() => setFocusedField('vehicle')}
                onBlur={() => setFocusedField('')}
                style={styles.input(focusedField === 'vehicle', false)}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              style={styles.submitButton(hoveredCard === 'submit')}
              onMouseEnter={() => setHoveredCard('submit')}
              onMouseLeave={() => setHoveredCard('')}
            >
              {isSubmitting ? 'Submitting Request...' : 'Submit Visitor Request'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfessionalVisitorForm;
