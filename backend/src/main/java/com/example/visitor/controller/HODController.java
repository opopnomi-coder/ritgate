package com.example.visitor.controller;

import com.example.visitor.entity.GatePassRequest;
import com.example.visitor.entity.Student;
import com.example.visitor.entity.Staff;
import com.example.visitor.entity.HOD;
import com.example.visitor.entity.HODBulkGatePassRequest;
import com.example.visitor.repository.StudentRepository;
import com.example.visitor.repository.StaffRepository;
import com.example.visitor.repository.HODRepository;
import com.example.visitor.repository.GatePassRequestRepository;
import com.example.visitor.service.GatePassRequestService;
import com.example.visitor.service.HODBulkGatePassService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.ArrayList;
import java.util.Optional;
import java.util.HashMap;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/hod")
@CrossOrigin(origins = "*", allowedHeaders = "*")
@RequiredArgsConstructor
@Slf4j
public class HODController {
    
    private final GatePassRequestService gatePassRequestService;
    private final HODBulkGatePassService hodBulkGatePassService;
    private final StudentRepository studentRepository;
    private final StaffRepository staffRepository;
    private final HODRepository hodRepository;
    private final GatePassRequestRepository gatePassRequestRepository;
    
    // ==================== HOD GATE PASS REQUESTS ====================
    
    // Submit HOD gate pass request
    @PostMapping("/gate-pass/submit")
    public ResponseEntity<?> submitHODGatePassRequest(@RequestBody Map<String, Object> requestData) {
        try {
            String hodCode = (String) requestData.get("hodCode");
            String purpose = (String) requestData.get("purpose");
            String reason = (String) requestData.get("reason");
            String attachmentUri = (String) requestData.get("attachmentUri");
            
            if (hodCode == null || purpose == null) {
                return ResponseEntity.badRequest().body(Map.of(
                    "status", "ERROR",
                    "message", "HOD code and purpose are required"
                ));
            }
            
            GatePassRequest request = gatePassRequestService.submitHODRequest(
                hodCode, purpose, reason, LocalDateTime.now(), attachmentUri);
            
            log.info("✅ HOD gate pass request submitted: {}", request.getId());
            
            return ResponseEntity.ok(Map.of(
                "status", "SUCCESS",
                "message", "Gate pass request submitted successfully",
                "requestId", request.getId(),
                "request", request
            ));
            
        } catch (Exception e) {
            log.error("Error submitting HOD gate pass request", e);
            return ResponseEntity.internalServerError().body(Map.of(
                "status", "ERROR",
                "message", "Failed to submit request: " + e.getMessage()
            ));
        }
    }
    
    // Get HOD's own gate pass requests
    @GetMapping("/gate-pass/my-requests")
    public ResponseEntity<?> getMyRequests(@RequestParam String hodCode) {
        try {
            List<GatePassRequest> requests = gatePassRequestService.getRequestsByHOD(hodCode);
            
            log.info("Fetched {} requests for HOD {}", requests.size(), hodCode);

            List<Map<String, Object>> requestList = requests.stream().map(req -> {
                Map<String, Object> map = new HashMap<>();
                // Copy all standard fields
                map.put("id", req.getId());
                map.put("regNo", req.getRegNo());
                map.put("studentName", req.getStudentName());
                map.put("requestedByStaffCode", req.getRequestedByStaffCode());
                map.put("requestedByStaffName", req.getRequestedByStaffName());
                map.put("department", req.getDepartment());
                map.put("passType", req.getPassType());
                map.put("bulkType", req.getBulkType());
                map.put("purpose", req.getPurpose());
                map.put("reason", req.getReason());
                map.put("exitDateTime", req.getExitDateTime());
                map.put("returnDateTime", req.getReturnDateTime());
                map.put("requestDate", req.getRequestDate());
                map.put("createdAt", req.getCreatedAt());
                map.put("status", req.getStatus());
                map.put("staffApproval", req.getStaffApproval());
                map.put("hodApproval", req.getHodApproval());
                map.put("hrApproval", req.getHrApproval());
                map.put("hodRemark", req.getHodRemark());
                map.put("qrCode", req.getQrCode());
                map.put("manualCode", req.getManualCode());
                map.put("qrUsed", req.getQrUsed());
                map.put("qrOwnerId", req.getQrOwnerId());
                map.put("includeStaff", req.getIncludeStaff());
                map.put("userType", req.getUserType());
                map.put("attachmentUri", req.getAttachmentUri());
                map.put("rejectionReason", req.getRejectionReason());

                // Separate student and staff counts for bulk passes
                int studentCount = 0;
                int staffCount = 0;
                if (req.getStudentList() != null && !req.getStudentList().trim().isEmpty()) {
                    String[] students = req.getStudentList().split(",");
                    studentCount = (int) java.util.Arrays.stream(students).filter(s -> !s.trim().isEmpty()).count();
                }
                if (req.getStaffList() != null && !req.getStaffList().trim().isEmpty()) {
                    String[] staff = req.getStaffList().split(",");
                    staffCount = (int) java.util.Arrays.stream(staff).filter(s -> !s.trim().isEmpty()).count();
                }
                map.put("studentCount", studentCount);
                map.put("staffCount", staffCount);
                map.put("participantCount", studentCount + staffCount);

                return map;
            }).collect(Collectors.toList());
            
            return ResponseEntity.ok(Map.of(
                "status", "SUCCESS",
                "requests", requestList,
                "count", requestList.size()
            ));
            
        } catch (Exception e) {
            log.error("Error fetching HOD requests", e);
            return ResponseEntity.internalServerError().body(Map.of(
                "status", "ERROR",
                "message", "Failed to fetch requests: " + e.getMessage()
            ));
        }
    }
    
    // Get requests pending HOD approval (for student/staff requests)
    @GetMapping("/gate-pass/pending")
    public ResponseEntity<?> getPendingRequests(@RequestParam String hodCode) {
        try {
            List<GatePassRequest> requests = gatePassRequestService.getRequestsForHodApproval(hodCode);
            
            log.info("Fetched {} pending requests for HOD {}", requests.size(), hodCode);
            
            return ResponseEntity.ok(Map.of(
                "status", "SUCCESS",
                "requests", requests,
                "count", requests.size()
            ));
            
        } catch (Exception e) {
            log.error("Error fetching pending requests for HOD", e);
            return ResponseEntity.internalServerError().body(Map.of(
                "status", "ERROR",
                "message", "Failed to fetch pending requests: " + e.getMessage()
            ));
        }
    }
    
    // Get all requests for HOD approval
    @GetMapping("/gate-pass/all")
    public ResponseEntity<?> getAllRequests(@RequestParam String hodCode) {
        try {
            List<GatePassRequest> requests = gatePassRequestService.getAllRequestsForHod(hodCode);
            
            log.info("Fetched {} total requests for HOD {}", requests.size(), hodCode);
            
            return ResponseEntity.ok(Map.of(
                "status", "SUCCESS",
                "requests", requests,
                "count", requests.size()
            ));
            
        } catch (Exception e) {
            log.error("Error fetching all requests for HOD", e);
            return ResponseEntity.internalServerError().body(Map.of(
                "status", "ERROR",
                "message", "Failed to fetch requests: " + e.getMessage()
            ));
        }
    }
    
    // Approve request as HOD
    @PostMapping("/gate-pass/{id}/approve")
    public ResponseEntity<?> approveRequest(@PathVariable Long id, @RequestBody Map<String, String> data) {
        try {
            String hodCode = data.get("hodCode");
            String hodRemark = data.get("hodRemark");
            
            if (hodCode == null) {
                return ResponseEntity.badRequest().body(Map.of(
                    "status", "ERROR",
                    "message", "HOD code is required"
                ));
            }
            
            GatePassRequest request = gatePassRequestService.approveByHOD(id, hodCode, hodRemark);
            
            log.info("✅ Request {} approved by HOD {}", id, hodCode);
            
            return ResponseEntity.ok(Map.of(
                "status", "SUCCESS",
                "message", "Request approved successfully",
                "request", request
            ));
            
        } catch (Exception e) {
            log.error("Error approving request", e);
            return ResponseEntity.internalServerError().body(Map.of(
                "status", "ERROR",
                "message", "Failed to approve request: " + e.getMessage()
            ));
        }
    }
    
    // Reject request as HOD
    @PostMapping("/gate-pass/{id}/reject")
    public ResponseEntity<?> rejectRequest(@PathVariable Long id, @RequestBody Map<String, String> data) {
        try {
            String hodCode = data.get("hodCode");
            String reason = data.get("reason");
            
            if (hodCode == null || reason == null) {
                return ResponseEntity.badRequest().body(Map.of(
                    "status", "ERROR",
                    "message", "HOD code and reason are required"
                ));
            }
            
            GatePassRequest request = gatePassRequestService.rejectByHOD(id, hodCode, reason);
            
            log.info("✅ Request {} rejected by HOD {}", id, hodCode);
            
            return ResponseEntity.ok(Map.of(
                "status", "SUCCESS",
                "message", "Request rejected successfully",
                "request", request
            ));
            
        } catch (Exception e) {
            log.error("Error rejecting request", e);
            return ResponseEntity.internalServerError().body(Map.of(
                "status", "ERROR",
                "message", "Failed to reject request: " + e.getMessage()
            ));
        }
    }
    
    // Get pending count
    @GetMapping("/gate-pass/pending-count")
    public ResponseEntity<?> getPendingCount(@RequestParam String hodCode) {
        try {
            long count = gatePassRequestService.getPendingRequestsCountForHod(hodCode);
            
            return ResponseEntity.ok(Map.of(
                "status", "SUCCESS",
                "count", count
            ));
            
        } catch (Exception e) {
            log.error("Error fetching pending count", e);
            return ResponseEntity.internalServerError().body(Map.of(
                "status", "ERROR",
                "message", "Failed to fetch pending count: " + e.getMessage()
            ));
        }
    }
    
    // Get QR code for approved request
    @GetMapping("/gate-pass/{id}/qr-code")
    public ResponseEntity<?> getQRCode(@PathVariable Long id, @RequestParam String hodCode) {
        try {
            String qrCode = gatePassRequestService.getQRCodeForRequest(id, hodCode);
            
            // Also fetch the manual code
            Optional<GatePassRequest> requestOpt = gatePassRequestRepository.findById(id);
            String manualCode = requestOpt.map(GatePassRequest::getManualCode).orElse(null);
            
            return ResponseEntity.ok(Map.of(
                "status", "SUCCESS",
                "qrCode", qrCode,
                "manualCode", manualCode != null ? manualCode : ""
            ));
            
        } catch (Exception e) {
            log.error("Error fetching QR code", e);
            return ResponseEntity.status(403).body(Map.of(
                "status", "ERROR",
                "message", e.getMessage()
            ));
        }
    }
    
    // ==================== HOD BULK GATE PASS ENDPOINTS ====================
    
    // Resolve all departments this HOD has control over (via students.hod column)
    private List<String> getHODDepartments(String hodCode) {
        HOD hod = hodRepository.findByHodCode(hodCode)
            .orElseThrow(() -> new RuntimeException("HOD not found"));
        String hodName = hod.getHodName();

        // Find all departments where this staff member's name appears in students.hod
        List<String> allHodDepts = studentRepository.findAll().stream()
            .filter(s -> s.getHod() != null && !s.getHod().isBlank() && s.getDepartment() != null)
            .filter(s -> {
                String cleaned = s.getHod().split("/")[0].trim().replaceAll("(?i)^dr\\.?\\s*", "").trim();
                return cleaned.equalsIgnoreCase(hodName) || hodName.toLowerCase().contains(cleaned.toLowerCase());
            })
            .map(Student::getDepartment)
            .distinct()
            .collect(Collectors.toList());

        // Always include the HOD's own staff department as fallback
        if (allHodDepts.isEmpty() && hod.getDepartment() != null) {
            allHodDepts = java.util.Arrays.asList(hod.getDepartment());
        }
        return allHodDepts;
    }

    // Get all students across all departments this HOD controls
    @GetMapping("/{hodCode}/department/students")
    public ResponseEntity<?> getDepartmentStudents(@PathVariable String hodCode) {
        try {
            List<String> hodDepts = getHODDepartments(hodCode);
            log.info("HOD {} controls departments: {}", hodCode, hodDepts);

            List<Map<String, Object>> students = studentRepository.findAll().stream()
                .filter(s -> s.getDepartment() != null && hodDepts.contains(s.getDepartment()) && s.getIsActive())
                .map(s -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("id", s.getId());
                    m.put("regNo", s.getRegNo());
                    m.put("fullName", s.getFullName());
                    m.put("department", s.getDepartment());
                    m.put("year", s.getYear() != null ? s.getYear() : "");
                    m.put("section", s.getSection() != null ? s.getSection() : "");
                    return m;
                })
                .collect(Collectors.toList());

            return ResponseEntity.ok(Map.of("success", true, "students", students, "count", students.size()));
        } catch (Exception e) {
            log.error("Error fetching HOD students", e);
            return ResponseEntity.internalServerError().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    // Get all staff across all departments this HOD controls
    @GetMapping("/{hodCode}/department/staff")
    public ResponseEntity<?> getDepartmentStaff(@PathVariable String hodCode) {
        try {
            List<String> hodDepts = getHODDepartments(hodCode);

            HOD hod = hodRepository.findByHodCode(hodCode)
                .orElseThrow(() -> new RuntimeException("HOD not found"));
            String hodName = hod.getHodName() != null ? hod.getHodName().trim().toLowerCase() : "";

            List<Map<String, Object>> staff = staffRepository.findAll().stream()
                .filter(s -> s.getDepartment() != null && hodDepts.contains(s.getDepartment()) && s.getIsActive())
                .filter(s -> !s.getStaffCode().equalsIgnoreCase(hodCode))
                .filter(s -> s.getStaffName() == null || !s.getStaffName().trim().toLowerCase().equals(hodName))
                .map(s -> {
                    Map<String, Object> staffMap = new HashMap<>();
                    staffMap.put("id", s.getId());
                    staffMap.put("staffCode", s.getStaffCode());
                    staffMap.put("fullName", s.getStaffName());
                    staffMap.put("department", s.getDepartment());
                    return staffMap;
                })
                .collect(Collectors.toList());

            log.info("Fetched {} staff for HOD {} (excluded self) across depts: {}", staff.size(), hodCode, hodDepts);
            
            return ResponseEntity.ok(Map.of(
                "success", true,
                "staff", staff,
                "count", staff.size()
            ));
            
        } catch (Exception e) {
            log.error("Error fetching department staff", e);
            return ResponseEntity.internalServerError().body(Map.of(
                "success", false,
                "message", "Failed to fetch staff: " + e.getMessage()
            ));
        }
    }
    
    // Submit HOD bulk gate pass request (unified Gatepass table)
    // Alias endpoint for frontend compatibility
    @PostMapping("/{hodCode}/bulk-gate-pass")
    public ResponseEntity<?> submitBulkGatePassAlias(@PathVariable String hodCode, @RequestBody Map<String, Object> requestData) {
        // Add hodCode to request data if not present
        if (!requestData.containsKey("hodCode")) {
            requestData.put("hodCode", hodCode);
        }
        return submitBulkGatePass(requestData);
    }
    
    // Submit HOD bulk gate pass request (unified Gatepass table)
    @PostMapping("/bulk-pass/create")
    public ResponseEntity<?> submitBulkGatePass(@RequestBody Map<String, Object> requestData) {
        try {
            String hodCode = (String) requestData.get("hodCode");
            
            // Validate HOD exists
            HOD hod = hodRepository.findByHodCode(hodCode)
                .orElseThrow(() -> new RuntimeException("HOD not found"));
                   // Extract basic fields first to avoid variable ordering issues in logging
            String purpose = (String) requestData.get("purpose");
            String reason = (String) requestData.get("reason");
            String exitDateTimeStr = (String) requestData.get("exitDateTime");
            String returnDateTimeStr = (String) requestData.get("returnDateTime");
            Boolean includeHOD = (Boolean) requestData.get("includeHOD");
            String receiverId = (String) requestData.get("receiverId");
            String attachmentUri = (String) requestData.get("attachmentUri");

            // Extract parameters - be robust and handle multiple possible payload structures
            List<String> studentRegNos = new ArrayList<>();
            List<String> staffCodes = new ArrayList<>();

            // 1. Try direct lists first
            Object studentIdsObj = requestData.get("studentRegNos");
            Object staffIdsObj = requestData.get("staffCodes");
            
            if (studentIdsObj instanceof List) {
                for (Object id : (List<?>) studentIdsObj) {
                    if (id != null) studentRegNos.add(String.valueOf(id));
                }
            }
            if (staffIdsObj instanceof List) {
                for (Object id : (List<?>) staffIdsObj) {
                    if (id != null) staffCodes.add(String.valueOf(id));
                }
            }

            // 2. Try extracting from participantDetails (used by mixed selection)
            Object participantDetailsObj = requestData.get("participantDetails");
            if (participantDetailsObj instanceof List) {
                List<Map<String, Object>> participantDetails = (List<Map<String, Object>>) participantDetailsObj;
                for (Map<String, Object> detail : participantDetails) {
                    Object idObj = detail.get("id");
                    Object typeObj = detail.get("type");
                    if (idObj == null || typeObj == null) continue;
                    
                    String id = String.valueOf(idObj);
                    String type = String.valueOf(typeObj);
                    
                    if ("student".equalsIgnoreCase(type)) {
                        if (!studentRegNos.contains(id)) studentRegNos.add(id);
                    } else if ("staff".equalsIgnoreCase(type) || "hod".equalsIgnoreCase(type)) {
                        if (!staffCodes.contains(id)) staffCodes.add(id);
                    }
                }
            }

            log.info("Creating bulk pass: HOD={}, students={}, staff={}, includeHOD={}, receiver={}", 
                hodCode, studentRegNos.size(), staffCodes.size(), includeHOD, receiverId);

            if (!studentRegNos.isEmpty()) log.debug("Students: {}", studentRegNos);
            if (!staffCodes.isEmpty()) log.debug("Staff: {}", staffCodes);
            
            // Parse dates - handle ISO format with millis and Z
            LocalDateTime exitDateTime;
            if (exitDateTimeStr != null && !exitDateTimeStr.isEmpty()) {
                try {
                    // Try ISO instant format first (e.g., 2026-03-17T14:16:25.503Z)
                    exitDateTime = Instant.parse(exitDateTimeStr).atZone(ZoneId.systemDefault()).toLocalDateTime();
                } catch (Exception e1) {
                    try {
                        exitDateTime = LocalDateTime.parse(exitDateTimeStr, DateTimeFormatter.ISO_DATE_TIME);
                    } catch (Exception e2) {
                        exitDateTime = LocalDateTime.now();
                    }
                }
            } else {
                exitDateTime = LocalDateTime.now();
            }

            LocalDateTime returnDateTime;
            if (returnDateTimeStr != null && !returnDateTimeStr.isEmpty()) {
                try {
                    returnDateTime = Instant.parse(returnDateTimeStr).atZone(ZoneId.systemDefault()).toLocalDateTime();
                } catch (Exception e1) {
                    try {
                        returnDateTime = LocalDateTime.parse(returnDateTimeStr, DateTimeFormatter.ISO_DATE_TIME);
                    } catch (Exception e2) {
                        returnDateTime = exitDateTime.plusHours(24);
                    }
                }
            } else {
                returnDateTime = exitDateTime.plusHours(24);
            }
            
            // Create bulk pass request using unified service
            Map<String, Object> response = hodBulkGatePassService.createBulkGatePassRequest(
                hodCode, studentRegNos, staffCodes, purpose, reason,
                exitDateTime, returnDateTime, includeHOD, receiverId, attachmentUri
            );
            
            if ((Boolean) response.get("success")) {
                log.info("✅ HOD bulk gate pass request created: ID={}, HOD={}, participants={}, studentList='{}', staffList='{}'", 
                    response.get("requestId"), hodCode, response.get("participantCount"),
                    response.get("studentList"), response.get("staffList"));
            }
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("Error submitting HOD bulk gate pass", e);
            return ResponseEntity.internalServerError().body(Map.of(
                "success", false,
                "message", "Failed to submit bulk gate pass: " + e.getMessage()
            ));
        }
    }
    
    // Helper method to parse year from string
    private Integer parseYear(String yearStr) {
        if (yearStr == null || yearStr.isEmpty()) {
            return null;
        }
        try {
            // Extract first digit from year string (e.g., "1st Year" -> 1)
            String numStr = yearStr.replaceAll("[^0-9]", "");
            if (!numStr.isEmpty()) {
                return Integer.parseInt(numStr.substring(0, 1));
            }
        } catch (Exception e) {
            log.warn("Failed to parse year: {}", yearStr);
        }
        return null;
    }
    
    // ==================== HOD BULK PASS MANAGEMENT ====================
    
    // Get HOD's bulk pass requests (unified Gatepass table)
    @GetMapping("/{hodCode}/bulk-pass/requests")
        public ResponseEntity<?> getHODBulkPassRequests(@PathVariable String hodCode) {
            try {
                List<GatePassRequest> requests = hodBulkGatePassService.getHODRequests(hodCode);

                List<Map<String, Object>> requestList = requests.stream().map(req -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", req.getId());
                    map.put("purpose", req.getPurpose());
                    map.put("reason", req.getReason());
                    map.put("exitDateTime", req.getExitDateTime());
                    map.put("returnDateTime", req.getReturnDateTime());

                    // Calculate participant count from student_list and staff_list
                    int studentCount = 0;
                    int staffCount = 0;

                    // Count students from student_list
                    if (req.getStudentList() != null && !req.getStudentList().trim().isEmpty()) {
                        String[] students = req.getStudentList().split(",");
                        studentCount = (int) java.util.Arrays.stream(students).filter(s -> !s.trim().isEmpty()).count();
                    }

                    // Count staff from staff_list
                    if (req.getStaffList() != null && !req.getStaffList().trim().isEmpty()) {
                        String[] staff = req.getStaffList().split(",");
                        staffCount = (int) java.util.Arrays.stream(staff).filter(s -> !s.trim().isEmpty()).count();
                    }

                    map.put("studentCount", studentCount);
                    map.put("staffCount", staffCount);
                    map.put("participantCount", studentCount + staffCount);
                    map.put("includeHOD", req.getIncludeStaff()); // Using includeStaff field
                    map.put("status", req.getStatus());
                    map.put("hrApproval", req.getHrApproval());
                    map.put("qrCode", req.getQrCode());
                    map.put("createdAt", req.getCreatedAt());
                    if (req.getHrApprovedBy() != null) {
                        map.put("approvedByHr", req.getHrApprovedBy());
                        map.put("approvalDate", req.getHrApprovalDate());
                    }
                    if (req.getRejectionReason() != null) {
                        map.put("rejectionReason", req.getRejectionReason());
                    }
                    return map;
                }).collect(Collectors.toList());

                return ResponseEntity.ok(Map.of(
                    "success", true,
                    "requests", requestList,
                    "count", requestList.size()
                ));
            } catch (Exception e) {
                log.error("Error fetching HOD bulk pass requests", e);
                return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "message", "Error fetching bulk pass requests: " + e.getMessage()
                ));
            }
        }
    
    // Get specific bulk pass request details (unified Gatepass table)
    @GetMapping("/bulk-pass/details/{requestId}")
    public ResponseEntity<?> getBulkPassRequestDetails(@PathVariable Long requestId) {
        try {
            Map<String, Object> response = hodBulkGatePassService.getBulkGatePassDetails(requestId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error fetching bulk pass details", e);
            return ResponseEntity.internalServerError().body(Map.of(
                "success", false,
                "message", "Error fetching bulk pass details: " + e.getMessage()
            ));
        }
    }

    // Get HOD profile by HOD code
    @GetMapping("/{hodCode}")
    public ResponseEntity<?> getHODProfile(@PathVariable String hodCode) {
        try {
            log.info("📋 Fetching HOD profile for: {}", hodCode);

            Optional<HOD> hodOpt = hodRepository.findByHodCode(hodCode);
            if (!hodOpt.isPresent()) {
                log.error("❌ HOD not found: {}", hodCode);
                return ResponseEntity.notFound().build();
            }

            HOD hod = hodOpt.get();
            Map<String, Object> hodDTO = new HashMap<>();
            hodDTO.put("id", hod.getId());
            hodDTO.put("hodCode", hod.getHodCode());
            hodDTO.put("hodId", hod.getHodCode());
            hodDTO.put("name", hod.getHodName());
            hodDTO.put("hodName", hod.getHodName());
            hodDTO.put("email", hod.getEmail());
            hodDTO.put("phone", hod.getPhone());
            hodDTO.put("department", hod.getDepartment());
            hodDTO.put("isActive", hod.getIsActive());

            log.info("✅ Found HOD: {}", hod.getHodName());
            return ResponseEntity.ok(hodDTO);

        } catch (Exception e) {
            log.error("❌ Error fetching HOD profile: {}", e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }

}
