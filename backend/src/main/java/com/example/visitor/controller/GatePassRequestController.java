package com.example.visitor.controller;

import com.example.visitor.entity.GatePassRequest;
import com.example.visitor.entity.Visitor;
import com.example.visitor.repository.GatePassRequestRepository;
import com.example.visitor.repository.VisitorRepository;
import com.example.visitor.service.GatePassRequestService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/gate-pass")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
@Slf4j
public class GatePassRequestController {
    
    private final GatePassRequestService gatePassRequestService;
    private final GatePassRequestRepository gatePassRequestRepository;

    @Autowired
    private VisitorRepository visitorRepository;
    
    // Submit student gate pass request
    @PostMapping("/student/submit")
    public ResponseEntity<Map<String, Object>> submitStudentRequest(@RequestBody Map<String, Object> requestData) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            String regNo = (String) requestData.get("regNo");
            String purpose = (String) requestData.get("purpose");
            String reason = (String) requestData.get("reason");
            String requestDateStr = (String) requestData.get("requestDate");
            String attachmentUri = (String) requestData.get("attachmentUri");
            
            // Validate required fields
            if (regNo == null || regNo.trim().isEmpty()) {
                response.put("success", false);
                response.put("message", "Registration number is required");
                return ResponseEntity.badRequest().body(response);
            }
            
            if (purpose == null || purpose.trim().isEmpty()) {
                response.put("success", false);
                response.put("message", "Purpose is required");
                return ResponseEntity.badRequest().body(response);
            }
            
            if (reason == null || reason.trim().isEmpty()) {
                response.put("success", false);
                response.put("message", "Reason is required");
                return ResponseEntity.badRequest().body(response);
            }
            
            // Parse request date
            LocalDateTime requestDate;
            try {
                requestDate = LocalDateTime.parse(requestDateStr, DateTimeFormatter.ISO_DATE_TIME);
            } catch (Exception e) {
                requestDate = LocalDateTime.now();
            }
            
            // Submit the request
            GatePassRequest gatePassRequest = gatePassRequestService.submitStudentRequest(
                regNo, purpose, reason, requestDate, attachmentUri);
            
            response.put("success", true);
            response.put("message", "Gate pass request submitted successfully");
            response.put("requestId", gatePassRequest.getId());
            response.put("status", gatePassRequest.getStatus().toString());
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("Error submitting student request", e);
            response.put("success", false);
            response.put("message", "Error submitting request: " + e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }
    
    // Submit staff gate pass request
    @PostMapping("/staff/submit")
    public ResponseEntity<Map<String, Object>> submitStaffRequest(@RequestBody Map<String, Object> requestData) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            String staffCode = (String) requestData.get("staffCode");
            String purpose = (String) requestData.get("purpose");
            String reason = (String) requestData.get("reason");
            String requestDateStr = (String) requestData.get("requestDate");
            String attachmentUri = (String) requestData.get("attachmentUri");
            
            // Validate required fields
            if (staffCode == null || staffCode.trim().isEmpty()) {
                response.put("success", false);
                response.put("message", "Staff code is required");
                return ResponseEntity.badRequest().body(response);
            }
            
            if (purpose == null || purpose.trim().isEmpty()) {
                response.put("success", false);
                response.put("message", "Purpose is required");
                return ResponseEntity.badRequest().body(response);
            }
            
            if (reason == null || reason.trim().isEmpty()) {
                response.put("success", false);
                response.put("message", "Reason is required");
                return ResponseEntity.badRequest().body(response);
            }
            
            // Parse request date
            LocalDateTime requestDate;
            try {
                requestDate = LocalDateTime.parse(requestDateStr, DateTimeFormatter.ISO_DATE_TIME);
            } catch (Exception e) {
                requestDate = LocalDateTime.now();
            }
            
            // Submit the staff request
            GatePassRequest gatePassRequest = gatePassRequestService.submitStaffRequest(
                staffCode, purpose, reason, requestDate, attachmentUri);
            
            response.put("success", true);
            response.put("message", "Staff gate pass request submitted successfully");
            response.put("requestId", gatePassRequest.getId());
            response.put("status", gatePassRequest.getStatus().toString());
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("Error submitting staff request", e);
            response.put("success", false);
            response.put("message", "Error submitting staff request: " + e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }
    
    // Get student's requests
    @GetMapping("/student/{regNo}")
    public ResponseEntity<Map<String, Object>> getStudentRequests(@PathVariable String regNo) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            List<GatePassRequest> requests = gatePassRequestService.getRequestsByStudent(regNo);
            
            response.put("success", true);
            response.put("requests", requests);
            response.put("count", requests.size());
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("Error fetching student requests", e);
            response.put("success", false);
            response.put("message", "Error fetching requests: " + e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }
    
    // Get staff's own gate pass requests (requests submitted by staff for themselves)
    @GetMapping("/staff/{staffCode}/own")
    public ResponseEntity<Map<String, Object>> getStaffOwnRequests(@PathVariable String staffCode) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            // Get requests where regNo = staffCode AND userType = STAFF
            List<GatePassRequest> requests = gatePassRequestService.getStaffOwnRequests(staffCode);
            
            response.put("success", true);
            response.put("requests", requests);
            response.put("count", requests.size());
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("Error fetching staff own requests", e);
            response.put("success", false);
            response.put("message", "Error fetching requests: " + e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }
    
    // Get pending requests for staff approval
    @GetMapping("/staff/{staffCode}/pending")
    public ResponseEntity<Map<String, Object>> getStaffPendingRequests(@PathVariable String staffCode) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            List<GatePassRequest> requests = gatePassRequestService.getRequestsForStaffApproval(staffCode);
            
            response.put("success", true);
            response.put("requests", requests);
            response.put("count", requests.size());
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("Error fetching staff pending requests", e);
            response.put("success", false);
            response.put("message", "Error fetching staff pending requests: " + e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }
    
    // Get all requests for staff
    @GetMapping("/staff/{staffCode}/pending-all")
    public ResponseEntity<Map<String, Object>> getStaffPendingAll(@PathVariable String staffCode) {
        Map<String, Object> response = new HashMap<>();
        try {
            List<Map<String, Object>> combined = new ArrayList<>();

            // 1. Gate pass requests (student/staff single & bulk)
            List<GatePassRequest> gpRequests = gatePassRequestService.getRequestsForStaffApproval(staffCode);
            for (GatePassRequest gp : gpRequests) {
                Map<String, Object> item = new HashMap<>();
                item.put("id", gp.getId());
                item.put("passType", gp.getPassType() != null ? gp.getPassType() : "SINGLE");
                item.put("regNo", gp.getRegNo());
                item.put("department", gp.getDepartment());
                item.put("purpose", gp.getPurpose());
                item.put("exitDateTime", gp.getExitDateTime());
                item.put("requestDate", gp.getRequestDate());
                item.put("status", gp.getStatus());
                item.put("requestedByStaffName", gp.getRequestedByStaffName());
                item.put("userType", gp.getUserType());
                item.put("includeStaff", gp.getIncludeStaff());
                item.put("studentCount", gp.getStudentCount());
                item.put("sourceType", "GATE_PASS");
                combined.add(item);
            }

            // 2. Visitor requests assigned to this staff (PENDING only)
            List<Visitor> visitors = visitorRepository.findByStaffCodeAndStatus(staffCode, "PENDING");
            for (Visitor v : visitors) {
                Map<String, Object> item = new HashMap<>();
                item.put("id", v.getId());
                item.put("passType", "VISITOR");
                item.put("regNo", null);
                item.put("visitorName", v.getName());
                item.put("visitorEmail", v.getEmail());
                item.put("visitorPhone", v.getPhone());
                item.put("department", v.getDepartment());
                item.put("role", v.getRole() != null ? v.getRole() : "VISITOR");
                item.put("purpose", v.getPurpose());
                item.put("numberOfPeople", v.getNumberOfPeople());
                item.put("vehicleNumber", v.getVehicleNumber());
                item.put("requestDate", v.getCreatedAt());
                item.put("status", v.getStatus());
                item.put("registeredBy", v.getRegisteredBy());
                item.put("sourceType", "VISITOR");
                combined.add(item);
            }

            response.put("success", true);
            response.put("requests", combined);
            response.put("count", combined.size());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error fetching staff pending-all requests", e);
            response.put("success", false);
            response.put("message", "Error: " + e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    // Get all requests for staff
    @GetMapping("/staff/{staffCode}/all")    public ResponseEntity<Map<String, Object>> getAllStaffRequests(@PathVariable String staffCode) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            List<GatePassRequest> requests = gatePassRequestService.getAllRequestsForStaff(staffCode);
            
            response.put("success", true);
            response.put("requests", requests);
            response.put("count", requests.size());
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("Error fetching all staff requests", e);
            response.put("success", false);
            response.put("message", "Error fetching requests: " + e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }
    
    // Get pending requests for HOD approval
    @GetMapping("/hod/{hodCode}/pending")
    public ResponseEntity<Map<String, Object>> getHodPendingRequests(@PathVariable String hodCode) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            List<GatePassRequest> requests = gatePassRequestService.getRequestsForHodApproval(hodCode);
            
            response.put("success", true);
            response.put("requests", requests);
            response.put("count", requests.size());
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("Error fetching HOD pending requests", e);
            response.put("success", false);
            response.put("message", "Error fetching HOD pending requests: " + e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }
    
    // Get all requests for HOD
    @GetMapping("/hod/{hodCode}/all")
    public ResponseEntity<Map<String, Object>> getAllHodRequests(@PathVariable String hodCode) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            List<GatePassRequest> requests = gatePassRequestService.getAllRequestsForHod(hodCode);
            
            response.put("success", true);
            response.put("requests", requests);
            response.put("count", requests.size());
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("Error fetching all HOD requests", e);
            response.put("success", false);
            response.put("message", "Error fetching requests: " + e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }
    
    // Staff approves request
    @PostMapping("/staff/{staffCode}/approve/{requestId}")
    public ResponseEntity<Map<String, Object>> approveByStaff(
        @PathVariable String staffCode,
        @PathVariable Long requestId,
        @RequestBody(required = false) Map<String, String> requestData) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            String staffRemark = requestData != null ? requestData.get("remark") : null;
            GatePassRequest request = gatePassRequestService.approveByStaff(requestId, staffCode, staffRemark);
            
            response.put("success", true);
            response.put("message", "Request approved by staff");
            response.put("request", request);
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("Error approving request by staff", e);
            response.put("success", false);
            response.put("message", "Error approving request: " + e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }
    
    // HOD approves request
    @PostMapping("/hod/{hodCode}/approve/{requestId}")
    public ResponseEntity<Map<String, Object>> approveByHod(
        @PathVariable String hodCode,
        @PathVariable Long requestId,
        @RequestBody(required = false) Map<String, String> requestData) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            String hodRemark = requestData != null ? requestData.get("remark") : null;
            GatePassRequest request = gatePassRequestService.approveByHOD(requestId, hodCode, hodRemark);
            
            response.put("success", true);
            response.put("message", "Request approved by HOD");
            response.put("request", request);
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("Error approving request by HOD", e);
            response.put("success", false);
            response.put("message", "Error approving request: " + e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }
    
    // Staff rejects request
    @PostMapping("/staff/{staffCode}/reject/{requestId}")
    public ResponseEntity<Map<String, Object>> rejectByStaff(
        @PathVariable String staffCode,
        @PathVariable Long requestId,
        @RequestBody Map<String, String> requestData) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            String reason = requestData.get("reason") != null ? requestData.get("reason") : requestData.get("remark");
            if (reason == null || reason.trim().isEmpty()) {
                response.put("success", false);
                response.put("message", "Rejection reason is required");
                return ResponseEntity.badRequest().body(response);
            }
            
            GatePassRequest request = gatePassRequestService.rejectByStaff(requestId, staffCode, reason);
            
            response.put("success", true);
            response.put("message", "Request rejected by staff");
            response.put("request", request);
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("Error rejecting request by staff", e);
            response.put("success", false);
            response.put("message", "Error rejecting request: " + e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }
    
    // HOD rejects request
    @PostMapping("/hod/{hodCode}/reject/{requestId}")
    public ResponseEntity<Map<String, Object>> rejectByHod(
        @PathVariable String hodCode,
        @PathVariable Long requestId,
        @RequestBody Map<String, String> requestData) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            String reason = requestData.get("reason") != null ? requestData.get("reason") : requestData.get("remark");
            if (reason == null || reason.trim().isEmpty()) {
                response.put("success", false);
                response.put("message", "Rejection reason is required");
                return ResponseEntity.badRequest().body(response);
            }
            
            GatePassRequest request = gatePassRequestService.rejectByHOD(requestId, hodCode, reason);
            
            response.put("success", true);
            response.put("message", "Request rejected by HOD");
            response.put("request", request);
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("Error rejecting request by HOD", e);
            response.put("success", false);
            response.put("message", "Error rejecting request: " + e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }
    
    // Mark QR code as used
    @PostMapping("/use-qr/{requestId}")
    public ResponseEntity<Map<String, Object>> useQRCode(@PathVariable Long requestId) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            GatePassRequest request = gatePassRequestService.markQRCodeAsUsed(requestId);
            
            response.put("success", true);
            response.put("message", "QR code used successfully");
            response.put("request", request);
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("Error using QR code", e);
            response.put("success", false);
            response.put("message", "Error using QR code: " + e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }
    
    // Get pending counts
    @GetMapping("/staff/{staffCode}/pending-count")
    public ResponseEntity<Map<String, Object>> getStaffPendingCount(@PathVariable String staffCode) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            long count = gatePassRequestService.getPendingRequestsCountForStaff(staffCode);
            
            response.put("success", true);
            response.put("count", count);
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("Error fetching staff pending count", e);
            response.put("success", false);
            response.put("message", "Error fetching count: " + e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }
    
    @GetMapping("/hod/{hodCode}/pending-count")
    public ResponseEntity<Map<String, Object>> getHodPendingCount(@PathVariable String hodCode) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            long count = gatePassRequestService.getPendingRequestsCountForHod(hodCode);
            
            response.put("success", true);
            response.put("count", count);
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("Error fetching HOD pending count", e);
            response.put("success", false);
            response.put("message", "Error fetching count: " + e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }
    
    // Get QR code for approved gate pass
    @GetMapping("/qr-code/{requestId}")
    public ResponseEntity<Map<String, Object>> getQRCode(
        @PathVariable Long requestId,
        @RequestParam(required = false) String regNo,
        @RequestParam(required = false) String staffCode,
        @RequestParam(required = false) String identifier,
        @RequestParam(required = false, defaultValue = "false") Boolean download) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            // Use identifier first, then regNo or staffCode as fallback
            String userIdentifier = identifier != null ? identifier : (regNo != null ? regNo : staffCode);
            
            if (userIdentifier == null) {
                response.put("success", false);
                response.put("message", "Either identifier, regNo, or staffCode is required");
                return ResponseEntity.badRequest().body(response);
            }
            
            log.info("📱 Fetching QR code for request {} by user {}", requestId, userIdentifier);
            
            String qrCode = gatePassRequestService.getQRCodeForRequest(requestId, userIdentifier);
            
            if (qrCode != null) {
                // Also fetch the manual code from the request
                Optional<GatePassRequest> requestOpt = gatePassRequestRepository.findById(requestId);
                String manualCode = requestOpt.map(GatePassRequest::getManualCode).orElse(null);
                
                response.put("success", true);
                response.put("qrCode", qrCode);
                response.put("manualCode", manualCode);
                response.put("message", "QR code retrieved successfully");
                log.info("✅ QR code retrieved successfully for request {} (manual code: {})", requestId, manualCode);
            } else {
                response.put("success", false);
                response.put("message", "QR code not found or not yet generated");
                log.warn("⚠️ QR code not found for request {}", requestId);
            }
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("❌ Error fetching QR code for request {}: {}", requestId, e.getMessage(), e);
            response.put("success", false);
            response.put("message", "Error fetching QR code: " + e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }


    // Regenerate QR code for a request
    @PostMapping("/regenerate-qr/{requestId}")
    public ResponseEntity<?> regenerateQRCode(@PathVariable Long requestId) {
        try {
            log.info("API: Regenerating QR code for request {}", requestId);
            gatePassRequestService.regenerateQRCode(requestId);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "QR code regenerated successfully");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error regenerating QR code for request {}", requestId, e);
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Error regenerating QR code: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

}
