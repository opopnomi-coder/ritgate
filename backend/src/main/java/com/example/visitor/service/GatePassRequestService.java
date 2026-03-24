package com.example.visitor.service;

import com.example.visitor.entity.*;
import com.example.visitor.repository.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@Slf4j
public class GatePassRequestService {
    
    private final GatePassRequestRepository gatePassRequestRepository;
    private final StudentRepository studentRepository;
    private final StaffRepository staffRepository;
    private final QRTableRepository qrTableRepository;
    private final NotificationService notificationService;
    private final EmailService emailService;
    private final DepartmentLookupService departmentLookupService;
    
    // Constructor
    public GatePassRequestService(
            GatePassRequestRepository gatePassRequestRepository,
            StudentRepository studentRepository,
            StaffRepository staffRepository,
            QRTableRepository qrTableRepository,
            NotificationService notificationService,
            EmailService emailService,
            DepartmentLookupService departmentLookupService) {
        this.gatePassRequestRepository = gatePassRequestRepository;
        this.studentRepository = studentRepository;
        this.staffRepository = staffRepository;
        this.qrTableRepository = qrTableRepository;
        this.notificationService = notificationService;
        this.emailService = emailService;
        this.departmentLookupService = departmentLookupService;
    }
    
    // Submit student gate pass request
    @Transactional
    public GatePassRequest submitStudentRequest(String regNo, String purpose, String reason, 
                                                LocalDateTime requestDate, String attachmentUri) {
        log.info("Submitting gate pass request for student: {}", regNo);
        
        // Find student
        Optional<Student> studentOpt = studentRepository.findByRegNo(regNo);
        if (studentOpt.isEmpty()) {
            throw new RuntimeException("Student not found with regNo: " + regNo);
        }
        
        Student student = studentOpt.get();
        String department = student.getDepartment();
        
        // Find assigned staff (first active staff in department)
        String assignedStaffCode = departmentLookupService.findStaffForDepartment(department);
        if (assignedStaffCode == null) {
            throw new RuntimeException("No staff found for department: " + department);
        }
        
        // Find assigned HOD (optional — if not found, request goes directly to PENDING_HOD with null hodCode)
        String assignedHodCode = departmentLookupService.findHODForDepartment(department);
        if (assignedHodCode == null) {
            log.warn("No HOD found for department: {}. Request will be submitted without HOD assignment.", department);
        }
        
        // Create request
        GatePassRequest request = new GatePassRequest();
        request.setRegNo(regNo);
        request.setStudentName(student.getFullName());
        request.setDepartment(department);
        request.setPurpose(purpose);
        request.setReason(reason);
        request.setRequestDate(requestDate != null ? requestDate : LocalDateTime.now());
        request.setStatus(GatePassRequest.RequestStatus.PENDING_STAFF);
        request.setStaffApproval(GatePassRequest.ApprovalStatus.PENDING);
        request.setHodApproval(GatePassRequest.ApprovalStatus.PENDING);
        request.setAssignedStaffCode(assignedStaffCode);
        request.setAssignedHodCode(assignedHodCode);
        request.setAttachmentUri(attachmentUri);
        request.setUserType("STUDENT");
        request.setPassType("SINGLE");
        
        GatePassRequest saved = gatePassRequestRepository.save(request);
        log.info("Gate pass request created with ID: {}", saved.getId());
        
        // Send notification to assigned staff (wrapped in try-catch to prevent transaction rollback)
        try {
            notificationService.notifyStaffOfNewStudentRequest(saved);
        } catch (Exception e) {
            log.error("Failed to notify staff of new student request for request {}", saved.getId(), e);
        }
        
        return saved;
    }
    
    // Submit staff gate pass request (staff submits for themselves)
    @Transactional
    public GatePassRequest submitStaffRequest(String staffCode, String purpose, String reason,
                                             LocalDateTime requestDate, String attachmentUri) {
        log.info("Submitting gate pass request for staff: {}", staffCode);
        
        // Find staff
        Optional<Staff> staffOpt = staffRepository.findByStaffCode(staffCode);
        if (staffOpt.isEmpty()) {
            throw new RuntimeException("Staff not found with code: " + staffCode);
        }
        
        Staff staff = staffOpt.get();
        String department = staff.getDepartment();
        
        // Find assigned HOD (optional — if not found, request is submitted without HOD assignment)
        String assignedHodCode = departmentLookupService.findHODForDepartment(department);
        if (assignedHodCode == null) {
            log.warn("No HOD found for department: {}. Staff request will be submitted without HOD assignment.", department);
        }
        String assignedHrCode = departmentLookupService.findActiveHR();
        
        // Create request
        GatePassRequest request = new GatePassRequest();
        request.setRegNo(staffCode);
        request.setStudentName(staff.getStaffName());
        request.setDepartment(department);
        request.setPurpose(purpose);
        request.setReason(reason);
        request.setRequestDate(requestDate != null ? requestDate : LocalDateTime.now());
        request.setStatus(GatePassRequest.RequestStatus.PENDING_HOD);
        request.setStaffApproval(GatePassRequest.ApprovalStatus.APPROVED); // Auto-approved
        request.setHodApproval(GatePassRequest.ApprovalStatus.PENDING);
        request.setAssignedStaffCode(staffCode); // Self-assigned
        request.setAssignedHodCode(assignedHodCode);
        request.setAssignedHrCode(assignedHrCode);
        request.setStaffApprovedBy(staffCode);
        request.setStaffApprovalDate(LocalDateTime.now());
        request.setAttachmentUri(attachmentUri);
        request.setUserType("STAFF");
        request.setPassType("SINGLE");
        
        GatePassRequest saved = gatePassRequestRepository.save(request);
        log.info("Staff gate pass request created with ID: {}", saved.getId());
        
        // Send notification to assigned HOD (wrapped in try-catch to prevent transaction rollback)
        try {
            notificationService.notifyHODOfNewStaffRequest(saved);
        } catch (Exception e) {
            log.error("Failed to notify HOD of new staff request for request {}", saved.getId(), e);
        }
        
        return saved;
    }
    
    // Approve by staff
    @Transactional
    public GatePassRequest approveByStaff(Long requestId, String staffCode, String staffRemark) {
        log.info("Staff {} approving request {}", staffCode, requestId);
        
        Optional<GatePassRequest> requestOpt = gatePassRequestRepository.findById(requestId);
        if (requestOpt.isEmpty()) {
            throw new RuntimeException("Gate pass request not found");
        }
        
        GatePassRequest request = requestOpt.get();
        
        // Verify authorization
        if (!staffCode.equals(request.getAssignedStaffCode())) {
            throw new RuntimeException("You are not authorized to approve this request");
        }
        
        // Update approval status
        request.setStaffApproval(GatePassRequest.ApprovalStatus.APPROVED);
        request.setStaffApprovedBy(staffCode);
        request.setStaffApprovalDate(LocalDateTime.now());
        if (staffRemark != null && !staffRemark.trim().isEmpty()) {
            request.setStaffRemark(staffRemark.trim());
        }
        
        // For VISITOR requests: auto-approve fully (no HOD step needed) and generate QR
        if ("VISITOR".equals(request.getUserType()) || request.getAssignedHodCode() == null) {
            request.setStatus(GatePassRequest.RequestStatus.APPROVED);
            request.setHodApproval(GatePassRequest.ApprovalStatus.APPROVED);
            request.setHodApprovalDate(LocalDateTime.now());
            
            // Generate QR code
            try {
                generateSinglePassQRCode(request);
            } catch (Exception e) {
                log.error("Error generating QR code for visitor pass", e);
            }
            
            log.info("Request {} (VISITOR) auto-approved by staff, QR generated", requestId);
        } else {
            // Normal student/staff flow: forward to HOD
            request.setStatus(GatePassRequest.RequestStatus.PENDING_HOD);
        }
        
        GatePassRequest saved = gatePassRequestRepository.save(request);
        log.info("Request {} approved by staff", requestId);
        
        // Send notifications (wrapped in try-catch to prevent transaction rollback)
        try {
            notificationService.notifyStudentOfStaffApproval(saved);
        } catch (Exception e) {
            log.error("Failed to notify student of staff approval for request {}", requestId, e);
        }
        
        // Send email to student (fire-and-forget)
        try {
            String regNo = saved.getRegNo();
            if ("STUDENT".equals(saved.getUserType())) {
                studentRepository.findByRegNo(regNo).ifPresent(student -> {
                    if (student.getEmail() != null && !student.getEmail().isBlank()) {
                        new Thread(() -> {
                            try {
                                emailService.sendGatePassStatusEmail(
                                    student.getEmail(), student.getFullName(),
                                    "Staff Approved", saved.getPurpose(),
                                    "Your gate pass request has been approved by Staff and is now awaiting HOD approval."
                                );
                            } catch (Exception ex) {
                                log.warn("Email send failed for staff approval (non-critical): {}", ex.getMessage());
                            }
                        }).start();
                    }
                });
            }
        } catch (Exception e) {
            log.warn("Email notification setup failed (non-critical): {}", e.getMessage());
        }
        
        // Only notify HOD if there is one assigned
        if (saved.getAssignedHodCode() != null && !"VISITOR".equals(saved.getUserType())) {
            try {
                notificationService.notifyHODOfStaffApproval(saved);
            } catch (Exception e) {
                log.error("Failed to notify HOD of staff approval for request {}", requestId, e);
            }
        }
        
        return saved;
    }
    
    // Approve by HOD
    @Transactional
    public GatePassRequest approveByHOD(Long requestId, String hodCode, String hodRemark) {
        log.info("HOD {} approving request {}", hodCode, requestId);
        
        Optional<GatePassRequest> requestOpt = gatePassRequestRepository.findById(requestId);
        if (requestOpt.isEmpty()) {
            throw new RuntimeException("Gate pass request not found");
        }
        
        GatePassRequest request = requestOpt.get();
        
        // Verify authorization
        if (!hodCode.equals(request.getAssignedHodCode())) {
            throw new RuntimeException("You are not authorized to approve this request");
        }
        
        // Update approval status
        request.setHodApproval(GatePassRequest.ApprovalStatus.APPROVED);
        request.setHodApprovedBy(hodCode);
        request.setHodApprovalDate(LocalDateTime.now());
        if (hodRemark != null && !hodRemark.trim().isEmpty()) {
            request.setHodRemark(hodRemark.trim());
        }
        
        boolean requiresHrAfterHod = "STAFF".equals(request.getUserType()) || "HOD".equals(request.getUserType());
        if (request.getStaffApproval() == GatePassRequest.ApprovalStatus.APPROVED) {
            if (requiresHrAfterHod) {
                if (request.getAssignedHrCode() == null || request.getAssignedHrCode().isBlank()) {
                    String assignedHrCode = departmentLookupService.findActiveHR();
                    if (assignedHrCode == null) {
                        throw new RuntimeException("No active HR found in the system");
                    }
                    request.setAssignedHrCode(assignedHrCode);
                }
                request.setStatus(GatePassRequest.RequestStatus.PENDING_HR);
                request.setHrApproval(GatePassRequest.ApprovalStatus.PENDING);
            } else {
                request.setStatus(GatePassRequest.RequestStatus.APPROVED);
                
                // Generate QR code after HOD approval for student-only flow
                if ("BULK".equals(request.getPassType())) {
                    log.info("Generating QR code for approved bulk pass request {}", requestId);
                    try {
                        generateBulkPassQRCode(request);
                    } catch (Exception e) {
                        log.error("Error generating QR code for bulk pass", e);
                        throw new RuntimeException("Failed to generate QR code: " + e.getMessage());
                    }
                } else {
                    log.info("Generating QR code for approved single pass request {}", requestId);
                    try {
                        generateSinglePassQRCode(request);
                    } catch (Exception e) {
                        log.error("Error generating QR code for single pass", e);
                        throw new RuntimeException("Failed to generate QR code: " + e.getMessage());
                    }
                }
            }
        }
        
        GatePassRequest saved = gatePassRequestRepository.save(request);
        log.info("Request {} approved by HOD", requestId);
        
        // Send notification to student (QR ready)
        if ("STUDENT".equals(saved.getUserType())) {
            notificationService.notifyStudentOfHODApproval(saved);
            // Email student — gate pass fully approved, QR ready (fire-and-forget)
            try {
                studentRepository.findByRegNo(saved.getRegNo()).ifPresent(student -> {
                    if (student.getEmail() != null && !student.getEmail().isBlank()) {
                        new Thread(() -> {
                            try {
                                emailService.sendGatePassStatusEmail(
                                    student.getEmail(), student.getFullName(),
                                    "Gate Pass Approved ✓", saved.getPurpose(),
                                    "Your gate pass has been fully approved by HOD. Your QR code is ready — open the app to view it."
                                );
                            } catch (Exception ex) {
                                log.warn("Email send failed for HOD approval (non-critical): {}", ex.getMessage());
                            }
                        }).start();
                    }
                });
            } catch (Exception e) {
                log.warn("Email notification setup failed (non-critical): {}", e.getMessage());
            }
        } else if ("STAFF".equals(saved.getUserType())) {
            if (saved.getStatus() == GatePassRequest.RequestStatus.PENDING_HR) {
                try {
                    notificationService.notifyHROfNewHODRequest(saved);
                } catch (Exception e) {
                    log.error("Failed to notify HR of staff request awaiting HR approval for request {}", requestId, e);
                }
            } else {
                notificationService.notifyStaffOfHODApproval(saved);
                try {
                    staffRepository.findByStaffCode(saved.getRegNo()).ifPresent(staff -> {
                        if (staff.getEmail() != null && !staff.getEmail().isBlank()) {
                            new Thread(() -> {
                                try {
                                    emailService.sendGatePassStatusEmail(
                                        staff.getEmail(), staff.getStaffName(),
                                        "Gate Pass Approved ✓", saved.getPurpose(),
                                        "Your gate pass has been approved. Your QR code is ready — open the app to view it."
                                    );
                                } catch (Exception ex) {
                                    log.warn("Email send failed for approval (non-critical): {}", ex.getMessage());
                                }
                            }).start();
                        }
                    });
                } catch (Exception e) {
                    log.warn("Email notification setup failed (non-critical): {}", e.getMessage());
                }
                
                if ("BULK".equals(saved.getPassType())) {
                    notificationService.notifyBulkParticipants(saved);
                }
            }
        }
        
        return saved;
    }
    
    // Generate QR code for single pass after HOD approval
    public void generateSinglePassQRCode(GatePassRequest request) {
        try {
            // Check if QR already exists for this request
            List<QRTable> existingQRs = qrTableRepository.findAll().stream()
                .filter(qr -> qr.getPassRequestId() != null && 
                             qr.getPassRequestId().equals(request.getId()))
                .collect(java.util.stream.Collectors.toList());
            
            if (!existingQRs.isEmpty()) {
                String existingQR = existingQRs.get(0).getQrString();
                // Check if existing QR uses correct format (SF|, ST|, VG|, or HD|)
                if (existingQR != null && 
                    (existingQR.startsWith("SF|") || existingQR.startsWith("ST|") || existingQR.startsWith("VG|") || existingQR.startsWith("HD|"))) {
                    log.info("⚠️  QR already exists for request {} with correct format, skipping generation", request.getId());
                    // Update request with existing QR
                    request.setQrCode(existingQR);
                    request.setQrCodeGeneratedAt(existingQRs.get(0).getCreatedAt());
                    return;
                } else {
                    // Old format detected, delete and regenerate
                    log.warn("🔄 Old QR format detected for request {}: {}. Deleting and regenerating...", request.getId(), existingQR);
                    qrTableRepository.deleteAll(existingQRs);
                }
            }
            
            // Generate unique token
            String token = generateUniqueToken();
            
            // Determine user type prefix: SF (Staff), ST (Student), VG (Visitor)
            String userTypePrefix = "ST"; // Default to Student
            String userId = request.getRegNo(); // Default to student reg number
            
            if (request.getUserType() != null) {
                if (request.getUserType().equals("STAFF")) {
                    userTypePrefix = "SF";
                    // For staff, regNo contains the staff code
                    userId = request.getRegNo();
                } else if (request.getUserType().equals("HOD")) {
                    userTypePrefix = "HD";
                    // For HOD, regNo contains the HOD code
                    userId = request.getRegNo();
                } else if (request.getUserType().equals("VISITOR")) {
                    userTypePrefix = "VG";
                    userId = request.getId().toString(); // Use Request ID as Visitor ID
                }
            }
            
            // Build QR string format: SF/ST/VG|staffCode/studentId/null|randomNumber
            String qrString = String.format("%s|%s|%s",
                userTypePrefix,
                userId,
                token
            );
            
            // Create QRTable entry
            QRTable qrTable = new QRTable();
            qrTable.setPassRequestId(request.getId());
            qrTable.setRequestedByStaffCode(request.getAssignedStaffCode() != null ? request.getAssignedStaffCode() : "SYSTEM");
            qrTable.setQrString(qrString);
            qrTable.setManualEntryCode(generateManualCode());
            qrTable.setPassType("SINGLE");
            qrTable.setIncludeStaff(false);
            qrTable.setStudentCount(1);
            qrTable.setStaffCount(0);
            qrTable.setStatus("ACTIVE");
            qrTable.setUserType(userTypePrefix); // SF for Staff, ST for Student, VG for Visitor, HD for HOD
            qrTable.setUserId(userId);
            qrTable.setQrCode(token);
            
            // For Visitors, the first scan is an ENTRY. For Students/Staff, it is an EXIT.
            if ("VG".equals(userTypePrefix)) {
                qrTable.setEntry(token);
                qrTable.setExit(null);
            } else {
                qrTable.setEntry(null);
                qrTable.setExit(token); // Token goes in exit column (single-use)
            }
            
            qrTable.setCreatedAt(LocalDateTime.now());
            qrTable.setUpdatedAt(LocalDateTime.now());
            
            qrTableRepository.save(qrTable);
            
            // Update request with QR info
            request.setQrCode(qrString);
            request.setManualCode(qrTable.getManualEntryCode()); // Store manual code in request
            request.setQrCodeGeneratedAt(LocalDateTime.now());
            
            log.info("✅ Generated QR code for single pass {} - Token: {} - Manual Code: {}", 
                request.getId(), token, qrTable.getManualEntryCode());
            
        } catch (Exception e) {
            log.error("Error generating single pass QR code", e);
            throw e;
        }
    }
    
    // Generate QR code for bulk pass after HOD approval
    private void generateBulkPassQRCode(GatePassRequest request) {
        try {
            // Check if GP format QR already exists for this request
            List<QRTable> existingQRs = qrTableRepository.findAll().stream()
                .filter(qr -> qr.getPassRequestId() != null && 
                             qr.getPassRequestId().equals(request.getId()))
                .collect(java.util.stream.Collectors.toList());
            
            if (!existingQRs.isEmpty()) {
                String existingQR = existingQRs.get(0).getQrString();
                // Check if existing QR uses correct format (GP|)
                if (existingQR != null && existingQR.startsWith("GP|")) {
                    log.info("⚠️  GP format QR already exists for request {}, skipping generation", request.getId());
                    // Update request with existing QR
                    request.setQrCode(existingQR);
                    request.setQrCodeGeneratedAt(existingQRs.get(0).getCreatedAt());
                    return;
                } else {
                    // Old format detected, delete and regenerate
                    log.warn("🔄 Old QR format detected for request {}: {}. Deleting and regenerating...", request.getId(), existingQR);
                    qrTableRepository.deleteAll(existingQRs);
                }
            }
            
            // Generate unique token
            String token = generateUniqueToken();
            
            // Build QR string format: GP|incharge|students|staff|subtype:token
            // Original 5-part format as specified in GROUP-PASS-IMPLEMENTATION.md
            // Get student and staff lists from request fields
            String studentList = request.getStudentList() != null ? request.getStudentList() : "";
            String staffList = request.getStaffList() != null ? request.getStaffList() : "";
            String subtype = request.getIncludeStaff() ? "SIG" : "SEG"; // SIG = Staff Included Group, SEG = Staff Excluded Group
            
            String qrString = String.format("GP|%s|%s|%s|%s:%s",
                request.getRequestedByStaffCode(),
                studentList,
                staffList,
                subtype,
                token
            );
            
            // Create QRTable entry
            QRTable qrTable = new QRTable();
            qrTable.setPassRequestId(request.getId());
            qrTable.setRequestedByStaffCode(request.getRequestedByStaffCode());
            qrTable.setQrString(qrString);
            qrTable.setManualEntryCode(generateManualCode());
            qrTable.setPassType("BULK");
            qrTable.setIncludeStaff(request.getIncludeStaff());
            qrTable.setStudentCount(request.getStudentCount() != null ? request.getStudentCount() : 0);
            qrTable.setStaffCount(request.getIncludeStaff() ? 1 : 0);
            qrTable.setStatus("ACTIVE");
            qrTable.setUserType("GP");
            qrTable.setUserId(request.getQrOwnerId() != null ? request.getQrOwnerId() : request.getRequestedByStaffCode());
            qrTable.setQrCode(token);
            qrTable.setGroupType(subtype);
            qrTable.setEntry(null); // No entry column for group pass
            qrTable.setExit(token); // Token goes in exit column (single-use)
            qrTable.setCreatedAt(LocalDateTime.now());
            qrTable.setUpdatedAt(LocalDateTime.now());
            
            qrTableRepository.save(qrTable);
            
            // Update request with QR info
            request.setQrCode(qrString);
            request.setManualCode(qrTable.getManualEntryCode()); // Store manual code in request
            request.setQrCodeGeneratedAt(LocalDateTime.now());
            
            log.info("✅ Generated QR code for bulk pass {} - Token: {} - Manual Code: {}", 
                request.getId(), token, qrTable.getManualEntryCode());
            
        } catch (Exception e) {
            log.error("Error generating bulk pass QR code", e);
            throw e;
        }
    }
    
    // Generate unique token for QR code
    private String generateUniqueToken() {
        String token;
        do {
            token = generateRandomToken();
        } while (qrTableRepository.findByToken(token).isPresent());
        return token;
    }
    
    // Generate random alphanumeric token
    private String generateRandomToken() {
        StringBuilder sb = new StringBuilder(8);
        SecureRandom random = new SecureRandom();
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        for (int i = 0; i < 8; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        return sb.toString();
    }
    
    // Generate manual entry code
    private String generateManualCode() {
        return String.format("%06d", new SecureRandom().nextInt(1000000));
    }
    
    // Reject by staff
    @Transactional
    public GatePassRequest rejectByStaff(Long requestId, String staffCode, String reason) {
        log.info("Staff {} rejecting request {}", staffCode, requestId);
        
        Optional<GatePassRequest> requestOpt = gatePassRequestRepository.findById(requestId);
        if (requestOpt.isEmpty()) {
            throw new RuntimeException("Gate pass request not found");
        }
        
        GatePassRequest request = requestOpt.get();
        
        // Verify authorization
        if (!staffCode.equals(request.getAssignedStaffCode())) {
            throw new RuntimeException("You are not authorized to reject this request");
        }
        
        // Update rejection status
        request.setStaffApproval(GatePassRequest.ApprovalStatus.REJECTED);
        request.setStatus(GatePassRequest.RequestStatus.REJECTED);
        request.setStaffApprovedBy(staffCode);
        request.setStaffApprovalDate(LocalDateTime.now());
        request.setRejectedBy(staffCode);
        request.setRejectionReason(reason);
        request.setStaffRemark(reason);
        request.setRejectedAt(LocalDateTime.now());
        
        GatePassRequest saved = gatePassRequestRepository.save(request);
        log.info("Request {} rejected by staff", requestId);
        
        // Send notification to student
        notificationService.notifyStudentOfStaffRejection(saved);
        
        return saved;
    }
    
    // Reject by HOD
    @Transactional
    public GatePassRequest rejectByHOD(Long requestId, String hodCode, String reason) {
        log.info("HOD {} rejecting request {}", hodCode, requestId);
        
        Optional<GatePassRequest> requestOpt = gatePassRequestRepository.findById(requestId);
        if (requestOpt.isEmpty()) {
            throw new RuntimeException("Gate pass request not found");
        }
        
        GatePassRequest request = requestOpt.get();
        
        // Verify authorization
        if (!hodCode.equals(request.getAssignedHodCode())) {
            throw new RuntimeException("You are not authorized to reject this request");
        }
        
        // Update rejection status
        request.setHodApproval(GatePassRequest.ApprovalStatus.REJECTED);
        request.setStatus(GatePassRequest.RequestStatus.REJECTED);
        request.setHodApprovedBy(hodCode);
        request.setHodApprovalDate(LocalDateTime.now());
        request.setRejectedBy(hodCode);
        request.setRejectionReason(reason);
        request.setHodRemark(reason);
        request.setRejectedAt(LocalDateTime.now());
        
        GatePassRequest saved = gatePassRequestRepository.save(request);
        log.info("Request {} rejected by HOD", requestId);
        
        // Send notification to student or staff
        if ("STUDENT".equals(saved.getUserType())) {
            notificationService.notifyStudentOfHODRejection(saved);
        } else if ("STAFF".equals(saved.getUserType())) {
            notificationService.notifyStaffOfHODRejection(saved);
        }
        
        return saved;
    }
    
    // Get requests by student (includes individual requests + bulk passes where student is QR owner)
    public List<GatePassRequest> getRequestsByStudent(String regNo) {
        log.info("Fetching all requests for student: {}", regNo);
        
        // Get individual requests where student is the requester
        List<GatePassRequest> individualRequests = gatePassRequestRepository.findByRegNoOrderByCreatedAtDesc(regNo);
        
        // Get bulk passes where student is the QR owner (SEG bulk passes with this student as receiver)
        List<GatePassRequest> bulkPassesAsReceiver = gatePassRequestRepository.findByQrOwnerIdOrderByCreatedAtDesc(regNo);
        
        // Merge the two lists
        List<GatePassRequest> allRequests = new java.util.ArrayList<>(individualRequests);
        for (GatePassRequest bulkPass : bulkPassesAsReceiver) {
            // Only add if not already in the list (avoid duplicates)
            if (!allRequests.stream().anyMatch(r -> r.getId().equals(bulkPass.getId()))) {
                allRequests.add(bulkPass);
            }
        }
        
        // Sort by created date descending (null-safe)
        allRequests.sort((a, b) -> {
            LocalDateTime da = a.getCreatedAt() != null ? a.getCreatedAt() : a.getRequestDate();
            LocalDateTime db = b.getCreatedAt() != null ? b.getCreatedAt() : b.getRequestDate();
            if (da == null && db == null) return 0;
            if (da == null) return 1;
            if (db == null) return -1;
            return db.compareTo(da);
        });
        
        log.info("Found {} individual requests + {} bulk passes as receiver = {} total requests for student {}", 
            individualRequests.size(), bulkPassesAsReceiver.size(), allRequests.size(), regNo);
        return allRequests;
    }
    
    // Get requests for staff approval
    public List<GatePassRequest> getRequestsForStaffApproval(String staffCode) {
        return gatePassRequestRepository.findByAssignedStaffCodeAndStaffApprovalOrderByCreatedAtDesc(
            staffCode, GatePassRequest.ApprovalStatus.PENDING);
    }
    
    // Get requests for HOD approval
    public List<GatePassRequest> getRequestsForHodApproval(String hodCode) {
        return gatePassRequestRepository.findByAssignedHodCodeAndHodApprovalOrderByCreatedAtDesc(
            hodCode, GatePassRequest.ApprovalStatus.PENDING);
    }
    
    // Get all requests for staff
    public List<GatePassRequest> getAllRequestsForStaff(String staffCode) {
        return gatePassRequestRepository.findByAssignedStaffCodeOrderByCreatedAtDesc(staffCode);
    }
    
    // Get staff's own gate pass requests (requests submitted by staff for themselves + bulk passes where staff is QR owner)
    public List<GatePassRequest> getStaffOwnRequests(String staffCode) {
        log.info("Fetching own requests for staff: {}", staffCode);
        
        // Get individual requests where staff is the requester
        List<GatePassRequest> individualRequests = gatePassRequestRepository.findByRegNoAndUserTypeOrderByCreatedAtDesc(staffCode, "STAFF");
        
        // Get bulk passes where staff is the QR owner (SEG bulk passes with this staff as receiver)
        List<GatePassRequest> bulkPassesAsReceiver = gatePassRequestRepository.findByQrOwnerIdOrderByCreatedAtDesc(staffCode);
        
        // Merge the two lists
        List<GatePassRequest> allRequests = new java.util.ArrayList<>(individualRequests);
        for (GatePassRequest bulkPass : bulkPassesAsReceiver) {
            // Only add if not already in the list (avoid duplicates)
            if (!allRequests.stream().anyMatch(r -> r.getId().equals(bulkPass.getId()))) {
                allRequests.add(bulkPass);
            }
        }
        
        // Sort by created date descending (null-safe)
        allRequests.sort((a, b) -> {
            LocalDateTime da = a.getCreatedAt() != null ? a.getCreatedAt() : a.getRequestDate();
            LocalDateTime db = b.getCreatedAt() != null ? b.getCreatedAt() : b.getRequestDate();
            if (da == null && db == null) return 0;
            if (da == null) return 1;
            if (db == null) return -1;
            return db.compareTo(da);
        });
        
        log.info("Found {} individual requests + {} bulk passes as receiver = {} total requests for staff {}", 
            individualRequests.size(), bulkPassesAsReceiver.size(), allRequests.size(), staffCode);
        return allRequests;
    }
    
    // Get all requests for HOD (includes requests for approval + HOD's own requests + bulk passes where HOD is QR owner)
    public List<GatePassRequest> getAllRequestsForHod(String hodCode) {
        log.info("Fetching all requests for HOD: {}", hodCode);
        
        // Get requests assigned to HOD for approval
        List<GatePassRequest> assignedRequests = gatePassRequestRepository.findByAssignedHodCodeOrderByCreatedAtDesc(hodCode);
        
        // Get bulk passes where HOD is the QR owner (SEG bulk passes with this HOD as receiver)
        List<GatePassRequest> bulkPassesAsReceiver = gatePassRequestRepository.findByQrOwnerIdOrderByCreatedAtDesc(hodCode);
        
        // Merge the two lists
        List<GatePassRequest> allRequests = new java.util.ArrayList<>(assignedRequests);
        for (GatePassRequest bulkPass : bulkPassesAsReceiver) {
            // Only add if not already in the list (avoid duplicates)
            if (!allRequests.stream().anyMatch(r -> r.getId().equals(bulkPass.getId()))) {
                allRequests.add(bulkPass);
            }
        }
        
        // Sort by created date descending (null-safe)
        allRequests.sort((a, b) -> {
            LocalDateTime da = a.getCreatedAt() != null ? a.getCreatedAt() : a.getRequestDate();
            LocalDateTime db = b.getCreatedAt() != null ? b.getCreatedAt() : b.getRequestDate();
            if (da == null && db == null) return 0;
            if (da == null) return 1;
            if (db == null) return -1;
            return db.compareTo(da);
        });
        
        log.info("Found {} assigned requests + {} bulk passes as receiver = {} total requests for HOD {}", 
            assignedRequests.size(), bulkPassesAsReceiver.size(), allRequests.size(), hodCode);
        return allRequests;
    }
    
    // Get pending counts
    public long getPendingRequestsCountForStaff(String staffCode) {
        List<GatePassRequest> pending = gatePassRequestRepository
            .findByAssignedStaffCodeAndStaffApprovalOrderByCreatedAtDesc(
                staffCode, GatePassRequest.ApprovalStatus.PENDING);
        return pending.size();
    }
    
    public long getPendingRequestsCountForHod(String hodCode) {
        List<GatePassRequest> pending = gatePassRequestRepository
            .findByAssignedHodCodeAndHodApprovalOrderByCreatedAtDesc(
                hodCode, GatePassRequest.ApprovalStatus.PENDING);
        return pending.size();
    }
    
    // Mark QR as used
    @Transactional
    public GatePassRequest markQRCodeAsUsed(Long requestId) {
        Optional<GatePassRequest> requestOpt = gatePassRequestRepository.findById(requestId);
        if (requestOpt.isEmpty()) {
            throw new RuntimeException("Gate pass request not found");
        }
        
        GatePassRequest request = requestOpt.get();
        if (Boolean.TRUE.equals(request.getQrUsed())) {
            throw new RuntimeException("This gate pass has already been used");
        }
        
        request.setQrUsed(true);
        request.setQrUsedAt(LocalDateTime.now());
        
        return gatePassRequestRepository.save(request);
    }
    
    // Get QR code for approved request
    public String getQRCodeForRequest(Long requestId, String identifier) {
        log.info("Fetching QR code for request {} by user {}", requestId, identifier);
        
        Optional<GatePassRequest> requestOpt = gatePassRequestRepository.findById(requestId);
        if (requestOpt.isEmpty()) {
            throw new RuntimeException("Gate pass request not found");
        }
        
        GatePassRequest request = requestOpt.get();
        
        // Verify authorization - check qrOwnerId for proper routing
        // For SINGLE passes: user must be the requester
        // For BULK passes: user must be the QR owner (staff if includeStaff=true, receiver if includeStaff=false)
        boolean isAuthorized = false;
        
        if ("SINGLE".equals(request.getPassType())) {
            // Single pass: check if user is the requester
            isAuthorized = identifier.equals(request.getRegNo());
        } else if ("BULK".equals(request.getPassType())) {
            // Bulk pass: check if user is the QR owner
            // If includeStaff = true: QR owner is the staff who created it
            // If includeStaff = false (SEG): QR owner is the selected receiver
            String qrOwner = request.getQrOwnerId();
            if (qrOwner != null && !qrOwner.isEmpty()) {
                isAuthorized = identifier.equals(qrOwner);
            } else {
                // Fallback: check if user is the staff who created it (for old records)
                isAuthorized = identifier.equals(request.getRequestedByStaffCode());
            }
        }
        
        if (!isAuthorized) {
            log.warn("Unauthorized access attempt for request {} by user {}", requestId, identifier);
            throw new RuntimeException("You are not authorized to view this QR code");
        }
        
        // Check if request is approved
        if (request.getStatus() != GatePassRequest.RequestStatus.APPROVED) {
            log.warn("QR code requested for non-approved request {} (status: {})", requestId, request.getStatus());
            throw new RuntimeException("QR code is only available for approved requests");
        }
        
        // Check if QR code exists
        if (request.getQrCode() == null || request.getQrCode().isEmpty()) {
            log.error("QR code is null or empty for approved request {}", requestId);
            throw new RuntimeException("QR code has not been generated yet. Please contact support.");
        }
        
        log.info("✅ Returning QR code for request {}: {}", requestId, request.getQrCode().substring(0, Math.min(20, request.getQrCode().length())) + "...");
        
        // Return QR code string
        return request.getQrCode();
    }


    // Regenerate QR code for a request (useful for fixing wrong QR codes)
    @Transactional
    public void regenerateQRCode(Long requestId) {
        log.info("Regenerating QR code for request {}", requestId);

        Optional<GatePassRequest> requestOpt = gatePassRequestRepository.findById(requestId);
        if (requestOpt.isEmpty()) {
            throw new RuntimeException("Request not found");
        }

        GatePassRequest request = requestOpt.get();

        // Delete existing QR codes for this request
        List<QRTable> existingQRs = qrTableRepository.findAll().stream()
            .filter(qr -> qr.getPassRequestId() != null &&
                         qr.getPassRequestId().equals(requestId))
            .collect(java.util.stream.Collectors.toList());

        if (!existingQRs.isEmpty()) {
            log.info("Deleting {} existing QR code(s) for request {}", existingQRs.size(), requestId);
            qrTableRepository.deleteAll(existingQRs);
        }

        // Clear QR code from request
        request.setQrCode(null);
        request.setQrCodeGeneratedAt(null);

        // Regenerate based on pass type
        if ("SINGLE".equals(request.getPassType())) {
            generateSinglePassQRCode(request);
        } else if ("BULK".equals(request.getPassType())) {
            generateBulkPassQRCode(request);
        }

        gatePassRequestRepository.save(request);
        log.info("✅ QR code regenerated successfully for request {}", requestId);
    }

    // ==================== HOD GATE PASS METHODS ====================
    
    // Submit HOD gate pass request (HOD submits for themselves)
    @Transactional
    public GatePassRequest submitHODRequest(String hodCode, String purpose, String reason,
                                           LocalDateTime requestDate, String attachmentUri) {
        log.info("Submitting gate pass request for HOD: {}", hodCode);
        
        // Look up HOD details from staff table
        Optional<Staff> staffOpt = staffRepository.findByStaffCode(hodCode);
        if (staffOpt.isEmpty()) {
            throw new RuntimeException("HOD/Staff not found with code: " + hodCode);
        }
        Staff hodStaff = staffOpt.get();
        String hodName = hodStaff.getStaffName();
        String department = hodStaff.getDepartment();
        
        // Find assigned HR (first active HR — role contains "HR" in staff table)
        String assignedHrCode = departmentLookupService.findActiveHR();
        if (assignedHrCode == null) {
            throw new RuntimeException("No active HR found in the system");
        }
        
        // Create request
        GatePassRequest request = new GatePassRequest();
        request.setRegNo(hodCode);
        request.setStudentName(hodName);
        request.setDepartment(department);
        request.setPurpose(purpose);
        request.setReason(reason);
        request.setRequestDate(requestDate != null ? requestDate : LocalDateTime.now());
        request.setStatus(GatePassRequest.RequestStatus.PENDING_HR);
        request.setStaffApproval(GatePassRequest.ApprovalStatus.APPROVED); // Auto-approved
        request.setHodApproval(GatePassRequest.ApprovalStatus.APPROVED); // Auto-approved
        request.setHrApproval(GatePassRequest.ApprovalStatus.PENDING);
        request.setAssignedStaffCode(hodCode); // Self-assigned
        request.setAssignedHodCode(hodCode); // Self-assigned
        request.setAssignedHrCode(assignedHrCode);
        request.setStaffApprovedBy(hodCode);
        request.setStaffApprovalDate(LocalDateTime.now());
        request.setHodApprovedBy(hodCode);
        request.setHodApprovalDate(LocalDateTime.now());
        request.setAttachmentUri(attachmentUri);
        request.setUserType("HOD");
        request.setPassType("SINGLE");
        
        GatePassRequest saved = gatePassRequestRepository.save(request);
        log.info("HOD gate pass request created with ID: {}", saved.getId());
        
        // Send notification to assigned HR (wrapped in try-catch to prevent transaction rollback)
        try {
            notificationService.notifyHROfNewHODRequest(saved);
        } catch (Exception e) {
            log.error("Failed to notify HR of new HOD request for request {}", saved.getId(), e);
        }
        
        return saved;
    }
    
    // ==================== HR APPROVAL METHODS ====================
    
    // Approve by HR
    @Transactional
    public GatePassRequest approveByHR(Long requestId, String hrCode) {
        log.info("HR {} approving request {}", hrCode, requestId);
        
        Optional<GatePassRequest> requestOpt = gatePassRequestRepository.findById(requestId);
        if (requestOpt.isEmpty()) {
            throw new RuntimeException("Gate pass request not found");
        }
        
        GatePassRequest request = requestOpt.get();
        
        // Verify authorization
        if (!hrCode.equals(request.getAssignedHrCode())) {
            throw new RuntimeException("You are not authorized to approve this request");
        }
        
        // Update approval status
        request.setHrApproval(GatePassRequest.ApprovalStatus.APPROVED);
        request.setHrApprovedBy(hrCode);
        request.setHrApprovalDate(LocalDateTime.now());
        
        // Check if all approvals are complete
        if (request.getStaffApproval() == GatePassRequest.ApprovalStatus.APPROVED &&
            request.getHodApproval() == GatePassRequest.ApprovalStatus.APPROVED) {
            request.setStatus(GatePassRequest.RequestStatus.APPROVED);
            
            // Generate QR code after HR approval
            if ("BULK".equals(request.getPassType())) {
                log.info("Generating QR code for approved bulk pass request {}", requestId);
                try {
                    generateBulkPassQRCode(request);
                } catch (Exception e) {
                    log.error("Error generating QR code for bulk pass", e);
                    throw new RuntimeException("Failed to generate QR code: " + e.getMessage());
                }
            } else {
                // Generate QR code for SINGLE passes
                log.info("Generating QR code for approved single pass request {}", requestId);
                try {
                    generateSinglePassQRCode(request);
                } catch (Exception e) {
                    log.error("Error generating QR code for single pass", e);
                    throw new RuntimeException("Failed to generate QR code: " + e.getMessage());
                }
            }
        }
        
        GatePassRequest saved = gatePassRequestRepository.save(request);
        log.info("Request {} approved by HR", requestId);
        
        // Send notification after HR decision
        if ("HOD".equals(saved.getUserType())) {
            notificationService.notifyHODOfHRApproval(saved);
            
            // If it's a bulk pass, notify all participants
            if ("BULK".equals(saved.getPassType())) {
                notificationService.notifyBulkParticipants(saved);
            }
        } else if ("STAFF".equals(saved.getUserType())) {
            notificationService.notifyStaffOfHRApproval(saved);
        }
        
        return saved;
    }
    
    // Reject by HR
    @Transactional
    public GatePassRequest rejectByHR(Long requestId, String hrCode, String reason) {
        log.info("HR {} rejecting request {}", hrCode, requestId);
        
        Optional<GatePassRequest> requestOpt = gatePassRequestRepository.findById(requestId);
        if (requestOpt.isEmpty()) {
            throw new RuntimeException("Gate pass request not found");
        }
        
        GatePassRequest request = requestOpt.get();
        
        // Verify authorization
        if (!hrCode.equals(request.getAssignedHrCode())) {
            throw new RuntimeException("You are not authorized to reject this request");
        }
        
        // Update rejection status
        request.setHrApproval(GatePassRequest.ApprovalStatus.REJECTED);
        request.setStatus(GatePassRequest.RequestStatus.REJECTED);
        request.setHrApprovedBy(hrCode);
        request.setHrApprovalDate(LocalDateTime.now());
        request.setRejectedBy(hrCode);
        request.setRejectionReason(reason);
        request.setRejectedAt(LocalDateTime.now());
        
        GatePassRequest saved = gatePassRequestRepository.save(request);
        log.info("Request {} rejected by HR", requestId);
        
        // Send notification after HR rejection
        if ("HOD".equals(saved.getUserType())) {
            notificationService.notifyHODOfHRRejection(saved);
        } else if ("STAFF".equals(saved.getUserType())) {
            notificationService.notifyStaffOfHRRejection(saved);
        }
        
        return saved;
    }
    
    // Get requests for HR approval
    public List<GatePassRequest> getRequestsForHRApproval(String hrCode) {
        return gatePassRequestRepository.findByAssignedHrCodeAndHrApprovalOrderByCreatedAtDesc(
            hrCode, GatePassRequest.ApprovalStatus.PENDING);
    }
    
    // Get all requests for HR
    public List<GatePassRequest> getAllRequestsForHR(String hrCode) {
        return gatePassRequestRepository.findByAssignedHrCodeOrderByCreatedAtDesc(hrCode);
    }
    
    // Get pending counts for HR
    public long getPendingRequestsCountForHR(String hrCode) {
        List<GatePassRequest> pending = gatePassRequestRepository
            .findByAssignedHrCodeAndHrApprovalOrderByCreatedAtDesc(
                hrCode, GatePassRequest.ApprovalStatus.PENDING);
        return pending.size();
    }
    
    // Get requests by HOD (includes both individual and bulk pass requests where HOD is QR owner)
    public List<GatePassRequest> getRequestsByHOD(String hodCode) {
        log.info("Fetching all requests for HOD: {}", hodCode);
        
        // Get individual requests where HOD is the requester
        List<GatePassRequest> individualRequests = gatePassRequestRepository.findByRegNoOrderByCreatedAtDesc(hodCode);
        
        // Get bulk passes where HOD is the QR owner (SEG bulk passes with this HOD as receiver)
        List<GatePassRequest> bulkPassesAsReceiver = gatePassRequestRepository.findByQrOwnerIdOrderByCreatedAtDesc(hodCode);
        
        // Merge the two lists
        List<GatePassRequest> allRequests = new java.util.ArrayList<>(individualRequests);
        for (GatePassRequest bulkPass : bulkPassesAsReceiver) {
            // Only add if not already in the list (avoid duplicates)
            if (!allRequests.stream().anyMatch(r -> r.getId().equals(bulkPass.getId()))) {
                allRequests.add(bulkPass);
            }
        }
        
        // Sort by created date descending (null-safe)
        allRequests.sort((a, b) -> {
            LocalDateTime da = a.getCreatedAt() != null ? a.getCreatedAt() : a.getRequestDate();
            LocalDateTime db = b.getCreatedAt() != null ? b.getCreatedAt() : b.getRequestDate();
            if (da == null && db == null) return 0;
            if (da == null) return 1;
            if (db == null) return -1;
            return db.compareTo(da);
        });
        
        log.info("Found {} individual requests + {} bulk passes as receiver = {} total requests for HOD {}", 
            individualRequests.size(), bulkPassesAsReceiver.size(), allRequests.size(), hodCode);
        return allRequests;
    }
    
}