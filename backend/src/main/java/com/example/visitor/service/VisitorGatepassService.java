package com.example.visitor.service;

import com.example.visitor.entity.Visitor;
import com.example.visitor.entity.Staff;
import com.example.visitor.entity.QRTable;
import com.example.visitor.repository.VisitorRepository;
import com.example.visitor.repository.StaffRepository;
import com.example.visitor.repository.QRTableRepository;
import com.example.visitor.service.NotificationService;
import com.example.visitor.service.EmailService;
import com.example.visitor.util.DepartmentMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class VisitorGatepassService {
    
    @Autowired
    private VisitorRepository visitorRepository;
    
    @Autowired
    private StaffRepository staffRepository;

    @Autowired
    private QRTableRepository qrTableRepository;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private EmailService emailService;
    
    /**
     * Create a new visitor gatepass request with validation
     * Ensures multi-device visibility through immediate database commit
     */
    @Transactional
    public Visitor createRequest(Visitor request) throws Exception {
        // Validate staff exists in main staff table
        Optional<Staff> staffOpt = staffRepository.findByStaffCode(request.getStaffCode());
        if (!staffOpt.isPresent()) {
            throw new Exception("Staff member not found with ID: " + request.getStaffCode());
        }
        
        Staff staff = staffOpt.get();
        
        // Validate department match using DepartmentMapper
        if (staff.getDepartment() != null && request.getDepartment() != null && 
            !DepartmentMapper.isSameDepartment(staff.getDepartment(), request.getDepartment())) {
            throw new Exception("Department mismatch. Staff belongs to " + staff.getDepartment() + 
                              " but request is for " + request.getDepartment());
        }
        
        // Set initial status
        request.setStatus("PENDING");
        
        // Save to database - transaction will commit immediately after method returns
        Visitor savedRequest = visitorRepository.save(request);
        
        // Force flush to ensure immediate database write
        visitorRepository.flush();
        
        System.out.println("✓ Visitor gatepass request created: ID=" + savedRequest.getId() + 
                         ", Visitor=" + savedRequest.getName() + 
                         ", Staff=" + request.getStaffCode());

        // Notify and email assigned staff (keeps visitor workflow consistent with UnifiedVisitorService).
        try {
            String staffId = savedRequest.getStaffCode();
            String staffName = staff.getStaffName();
            String staffEmail = staff.getEmail();

            notificationService.createUserNotification(
                staffId,
                "New Visitor Request",
                "New visitor request from " + savedRequest.getName() + ". Please review and approve.",
                "GATE_PASS",
                "HIGH"
            );

            emailService.sendApprovalRequestEmail(
                staffEmail,
                staffName,
                savedRequest.getName(),
                savedRequest.getEmail(),
                savedRequest.getPhone(),
                savedRequest.getPurpose(),
                savedRequest.getNumberOfPeople(),
                savedRequest.getDepartment(),
                savedRequest.getId()
            );
        } catch (Exception ignored) {
            // Notifications/emails should not break the core gatepass request creation.
        }
        
        return savedRequest;
    }
    
    /**
     * Get all pending requests for a specific staff member
     * Always reads fresh from database - no caching
     */
    @Transactional(readOnly = true)
    public List<Visitor> getPendingRequestsForStaff(String staffId) {
        return visitorRepository.findByStaffCodeAndStatus(staffId, "PENDING");
    }
    
    /**
     * Approve a visitor request and optionally generate QR code
     */
    @Transactional
    public Visitor approveRequest(Long requestId) throws Exception {
        Optional<Visitor> requestOpt = visitorRepository.findById(requestId);
        if (!requestOpt.isPresent()) {
            throw new Exception("Request not found with ID: " + requestId);
        }
        
        Visitor request = requestOpt.get();
        
        // Update approval status
        request.setStatus("APPROVED");
        request.setApprovedAt(LocalDateTime.now());
        
        // Generate QR code (VG|<visitorId>|<token>) and manual code.
        // This format is required by SecurityController's QR scanner logic.
        String token = generateUniqueToken();
        String qrString = generateQRCodeString(request, token);
        request.setQrCode(qrString);
        
        String manualCode = String.format("%06d", new java.util.Random().nextInt(999999));
        request.setManualCode(manualCode);

        // Create QR table entry so scanners can validate/consume the token.
        QRTable qrTable = new QRTable();
        qrTable.setPassRequestId(request.getId());
        qrTable.setRequestedByStaffCode(request.getStaffCode() != null ? request.getStaffCode() : "SYSTEM");
        qrTable.setQrString(qrString);
        qrTable.setManualEntryCode(manualCode);
        qrTable.setPassType("SINGLE");
        qrTable.setIncludeStaff(false);
        qrTable.setStudentCount(1);
        qrTable.setStaffCount(0);
        qrTable.setStatus("ACTIVE");
        qrTable.setUserType("VG");
        qrTable.setUserId(request.getId().toString());
        qrTable.setQrCode(token);
        // Visitor QR uses entry->exit flow in SecurityController.
        qrTable.setEntry(token);
        qrTable.setExit(null);
        qrTable.setCreatedAt(LocalDateTime.now());
        qrTable.setUpdatedAt(LocalDateTime.now());
        qrTableRepository.save(qrTable);

        Visitor savedRequest = visitorRepository.save(request);
        visitorRepository.flush();
        
        System.out.println("✓ Request approved: ID=" + requestId + ", QR=" + qrString);

        // Notify and email the visitor (QR/manual codes ready).
        try {
            Staff staff = staffRepository.findByStaffCode(savedRequest.getStaffCode()).orElse(null);
            String personToMeet = staff != null ? staff.getStaffName() : savedRequest.getStaffCode();

            notificationService.createUserNotification(
                savedRequest.getStaffCode(),
                "Visitor Approved",
                "Visitor pass approved for " + savedRequest.getName() + ". QR/manual codes are ready.",
                "APPROVAL",
                "URGENT"
            );

            String registeredBy = savedRequest.getRegisteredBy();
            boolean websiteOrigin = registeredBy != null && registeredBy.startsWith("WEB-");
            if (!websiteOrigin) {
                String visitDate = savedRequest.getVisitDate() != null ? savedRequest.getVisitDate().toString() : "";
                String visitTime = savedRequest.getVisitTime() != null ? savedRequest.getVisitTime().toString() : "";

                emailService.sendVisitorPassEmail(
                    savedRequest.getEmail(),
                    savedRequest.getName(),
                    savedRequest.getQrCode(),
                    savedRequest.getManualCode(),
                    personToMeet,
                    savedRequest.getDepartment(),
                    visitDate,
                    visitTime
                );
            }
        } catch (Exception ignored) {
            // Do not block approval by email/notification.
        }
        
        return savedRequest;
    }
    
    /**
     * Reject a visitor request with reason
     */
    @Transactional
    public Visitor rejectRequest(Long requestId, String rejectionReason) throws Exception {
        Optional<Visitor> requestOpt = visitorRepository.findById(requestId);
        if (!requestOpt.isPresent()) {
            throw new Exception("Request not found with ID: " + requestId);
        }
        
        Visitor request = requestOpt.get();
        
        // Update rejection status
        request.setStatus("REJECTED");
        request.setRejectionReason(rejectionReason);
        request.setRejectedAt(LocalDateTime.now());
        
        Visitor savedRequest = visitorRepository.save(request);
        visitorRepository.flush();
        
        System.out.println("✗ Request rejected: ID=" + requestId + ", Reason=" + rejectionReason);

        // Notify and email visitor about rejection (where possible).
        try {
            Staff staff = staffRepository.findByStaffCode(savedRequest.getStaffCode()).orElse(null);
            String personToMeet = staff != null ? staff.getStaffName() : savedRequest.getPersonToMeet();

            notificationService.createUserNotification(
                savedRequest.getStaffCode(),
                "Visitor Rejected",
                "Visitor request rejected for " + savedRequest.getName() + ". Reason: " + rejectionReason,
                "REJECTION",
                "HIGH"
            );

            emailService.sendRejectionEmail(
                savedRequest.getEmail(),
                savedRequest.getName(),
                personToMeet
            );
        } catch (Exception ignored) {
            // Do not block rejection by email/notification.
        }
        
        return savedRequest;
    }
    
    private static final String TOKEN_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final int TOKEN_LENGTH = 8;
    private final SecureRandom random = new SecureRandom();

    private String generateUniqueToken() {
        // QRTable.qr_code must be unique (see @Column(unique=true))
        for (int attempts = 0; attempts < 200; attempts++) {
            String token = generateRandomToken();
            if (qrTableRepository.findByQrCode(token).isEmpty()) {
                return token;
            }
        }
        throw new RuntimeException("Failed to generate unique QR token for visitor after retries");
    }

    private String generateRandomToken() {
        StringBuilder token = new StringBuilder(TOKEN_LENGTH);
        for (int i = 0; i < TOKEN_LENGTH; i++) {
            token.append(TOKEN_CHARS.charAt(random.nextInt(TOKEN_CHARS.length())));
        }
        return token.toString();
    }

    /**
     * Generate QR string in format: VG|visitor_id|token
     * Required by SecurityController's QR parsing/validation.
     */
    private String generateQRCodeString(Visitor request, String token) {
        return "VG|" + request.getId() + "|" + token;
    }
    
    /**
     * Get request by ID
     */
    @Transactional(readOnly = true)
    public Optional<Visitor> getRequestById(Long id) {
        return visitorRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public Optional<Visitor> getRequestForMachine(Long requestId, String machineId) {
        if (machineId == null || machineId.isBlank()) {
            return Optional.empty();
        }
        return visitorRepository.findById(requestId)
            .filter(v -> machineId.equals(v.getRegisteredBy()));
    }
    
    /**
     * Get all requests for a staff member (all statuses)
     */
    @Transactional(readOnly = true)
    public List<Visitor> getAllRequestsForStaff(String staffId) {
        return visitorRepository.findByStaffCode(staffId);
    }
}
