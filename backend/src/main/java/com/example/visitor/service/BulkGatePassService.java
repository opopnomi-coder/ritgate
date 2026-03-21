package com.example.visitor.service;

import com.example.visitor.entity.*;
import com.example.visitor.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class BulkGatePassService {
    
    private final GatePassRequestRepository gatePassRequestRepository;
    private final StudentRepository studentRepository;
    private final StaffRepository staffRepository;
    private final HODRepository hodRepository;
    private final QRTableRepository qrTableRepository;
    private final GatePassScanLogRepository scanLogRepository;
    private final NotificationService notificationService;
    private final DepartmentLookupService departmentLookupService;
    
    // Get students by staff department
    public Map<String, Object> getStudentsByStaffDepartment(String staffCode) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            // Find staff
            Optional<Staff> staffOpt = staffRepository.findByStaffCode(staffCode);
            if (!staffOpt.isPresent()) {
                response.put("success", false);
                response.put("message", "Staff not found");
                return response;
            }
            
            Staff staff = staffOpt.get();
            String department = staff.getDepartment();
            String staffName = staff.getStaffName();
            
            log.info("Finding students for staff: '{}' (code: {}) dept: '{}'", staffName, staffCode, department);
            
            // Strategy 1: exact match on class_incharge
            List<Student> students = studentRepository.findByClassIncharge(staffName);
            log.info("Strategy 1 (exact class_incharge='{}') → {} students", staffName, students.size());
            
            // Strategy 2: case-insensitive contains match within department
            if (students.isEmpty()) {
                students = studentRepository.findByClassInchargeContainingAndDepartment(staffName, department);
                log.info("Strategy 2 (contains '{}' in dept '{}') → {} students", staffName, department, students.size());
            }
            
            // Strategy 3: full department fallback
            if (students.isEmpty()) {
                log.warn("No students matched class_incharge for staff '{}', falling back to full department", staffName);
                students = studentRepository.findByDepartment(department);
                log.info("Strategy 3 (full dept fallback) → {} students", students.size());
            }
            
            // Convert to simple map
            List<Map<String, String>> studentList = new ArrayList<>();
            for (Student s : students) {
                Map<String, String> studentInfo = new HashMap<>();
                studentInfo.put("regNo", s.getRegNo());
                studentInfo.put("studentName", s.getFullName());
                studentInfo.put("department", s.getDepartment());
                studentInfo.put("section", s.getSection() != null ? s.getSection() : "");
                studentInfo.put("year", s.getYear() != null ? s.getYear() : "");
                studentInfo.put("classIncharge", s.getClassIncharge() != null ? s.getClassIncharge() : "");
                studentInfo.put("email", s.getEmail());
                studentList.add(studentInfo);
            }
            
            response.put("success", true);
            response.put("students", studentList);
            response.put("department", department);
            response.put("staffName", staffName);
            response.put("count", studentList.size());
            
        } catch (Exception e) {
            response.put("success", false);
            response.put("message", "Error fetching students: " + e.getMessage());
            log.error("Error fetching students", e);
        }
        
        return response;
    }
    
    // Create bulk gate pass request
    @Transactional
    public Map<String, Object> createBulkGatePassRequest(String staffCode, List<String> studentRegNos,
                                                         String purpose, String reason,
                                                         LocalDateTime exitDateTime, LocalDateTime returnDateTime,
                                                         Boolean includeStaff, String receiverId, String attachmentUri) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            // Validate staff
            Optional<Staff> staffOpt = staffRepository.findByStaffCode(staffCode);
            if (!staffOpt.isPresent()) {
                response.put("success", false);
                response.put("message", "Staff not found");
                return response;
            }
            
            Staff staff = staffOpt.get();
            String department = staff.getDepartment();
            
            // Validate students
            if (studentRegNos == null || studentRegNos.isEmpty()) {
                response.put("success", false);
                response.put("message", "No students selected");
                return response;
            }
            
            // Build eligible members list (students + staff if included)
            Set<String> eligibleMembers = new HashSet<>(studentRegNos);
            boolean includeStaffFlag = includeStaff != null ? includeStaff : false;
            if (includeStaffFlag) {
                eligibleMembers.add(staffCode);
            }
            
            // VALIDATION: If includeStaff = false, receiverId is REQUIRED
            if (!includeStaffFlag && (receiverId == null || receiverId.trim().isEmpty())) {
                response.put("success", false);
                response.put("message", "Receiver selection required when staff is not included");
                return response;
            }
            
            // VALIDATION: If receiverId provided, it must be in eligible members
            if (receiverId != null && !receiverId.trim().isEmpty()) {
                if (!eligibleMembers.contains(receiverId)) {
                    response.put("success", false);
                    response.put("message", "Receiver must be part of the selected group");
                    return response;
                }
            }
            
            // Determine QR owner
            String qrOwnerId;
            if (includeStaffFlag) {
                qrOwnerId = staffCode; // QR goes to creator (staff)
            } else {
                qrOwnerId = receiverId; // QR goes to selected receiver
            }
            
            // Fetch and validate all students
            List<Student> students = new ArrayList<>();
            for (String regNo : studentRegNos) {
                Optional<Student> studentOpt = studentRepository.findByRegNo(regNo);
                if (!studentOpt.isPresent()) {
                    response.put("success", false);
                    response.put("message", "Student not found: " + regNo);
                    return response;
                }
                
                Student student = studentOpt.get();
                
                // Validate department match
                if (!department.equals(student.getDepartment())) {
                    response.put("success", false);
                    response.put("message", "Student " + regNo + " is not from your department");
                    return response;
                }
                
                students.add(student);
            }
            
            // Find HOD for the department
            String hodCode = departmentLookupService.findHODForDepartment(department);
            
            // Determine bulk type
            String bulkType = includeStaffFlag ? "BULK_INCLUDE_STAFF" : "BULK_EXCLUDE_STAFF";
            
            // Build student and staff lists for QR generation
            String studentListStr = String.join(",", studentRegNos);
            String staffListStr = includeStaffFlag ? staffCode : "";
            
            // Create gate pass request
            GatePassRequest gatePassRequest = new GatePassRequest();
            gatePassRequest.setRegNo(staff.getStaffCode());
            gatePassRequest.setRequestedByStaffCode(staff.getStaffCode());
            gatePassRequest.setRequestedByStaffName(staff.getStaffName());
            gatePassRequest.setStudentName("Bulk Pass - " + students.size() + " students");
            gatePassRequest.setDepartment(department);
            gatePassRequest.setPassType("BULK");
            gatePassRequest.setBulkType(bulkType);
            gatePassRequest.setIncludeStaff(includeStaffFlag);
            gatePassRequest.setQrOwnerId(qrOwnerId); // Store QR owner
            gatePassRequest.setReceiverId(receiverId); // Store receiver selection
            gatePassRequest.setStudentCount(students.size());
            gatePassRequest.setStudentList(studentListStr); // Store comma-separated student list
            gatePassRequest.setStaffList(staffListStr); // Store comma-separated staff list
            gatePassRequest.setPurpose(purpose);
            gatePassRequest.setReason(reason);
            gatePassRequest.setRequestDate(LocalDateTime.now());
            gatePassRequest.setRequestSubmittedAt(LocalDateTime.now());
            gatePassRequest.setExitDateTime(exitDateTime);
            gatePassRequest.setReturnDateTime(returnDateTime);
            gatePassRequest.setAttachmentUri(attachmentUri);
            gatePassRequest.setStatus(GatePassRequest.RequestStatus.PENDING_HOD);
            gatePassRequest.setStaffApproval(GatePassRequest.ApprovalStatus.APPROVED); // Auto-approved by staff
            gatePassRequest.setHodApproval(GatePassRequest.ApprovalStatus.PENDING);
            gatePassRequest.setAssignedHodCode(hodCode);
            gatePassRequest.setStaffApprovedBy(staff.getStaffCode());
            gatePassRequest.setStaffApprovalDate(LocalDateTime.now());
            gatePassRequest.setUserType("STAFF");
            
            // Save gate pass request
            GatePassRequest savedRequest = gatePassRequestRepository.save(gatePassRequest);
            
            // Notify HOD about new staff bulk pass request
            if (hodCode != null) {
                notificationService.notifyHODOfNewStaffRequest(savedRequest);
            }
            
            // NOTE: Student mappings removed - using consolidated Gatepass table only
            // All student data is stored in the Gatepass table itself
            // Individual student tracking is not needed for the simplified system
            
            response.put("success", true);
            response.put("message", "Bulk gate pass request created successfully");
            response.put("requestId", savedRequest.getId());
            response.put("studentCount", students.size());
            response.put("includeStaff", includeStaffFlag);
            
        } catch (Exception e) {
            response.put("success", false);
            response.put("message", "Error creating bulk gate pass: " + e.getMessage());
            log.error("Error creating bulk gate pass", e);
        }
        
        return response;
    }
    
    // Get bulk gate pass details with student list
    public Map<String, Object> getBulkGatePassDetails(Long requestId) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            Optional<GatePassRequest> requestOpt = gatePassRequestRepository.findById(requestId);
            if (!requestOpt.isPresent()) {
                response.put("success", false);
                response.put("message", "Gate pass request not found");
                return response;
            }
            
            GatePassRequest request = requestOpt.get();
            
            // Get participant details from student_list and staff_list
            List<Map<String, String>> participants = new ArrayList<>();
            
            // Add requester if they included themselves
            if (request.getIncludeStaff() != null && request.getIncludeStaff()) {
                String requesterCode = request.getRequestedByStaffCode() != null ? 
                                       request.getRequestedByStaffCode() : request.getRegNo();
                log.info("Including staff requester as participant: {}", requesterCode);
                
                Optional<Staff> staffOpt = staffRepository.findByStaffCode(requesterCode);
                if (staffOpt.isPresent()) {
                    Staff staff = staffOpt.get();
                    Map<String, String> info = new HashMap<>();
                    info.put("id", staff.getStaffCode());
                    info.put("name", staff.getStaffName());
                    info.put("type", "staff");
                    info.put("department", staff.getDepartment());
                    participants.add(info);
                }
            }
            
            // Add students
            if (request.getStudentList() != null && !request.getStudentList().isEmpty()) {
                String[] studentRegNos = request.getStudentList().split(",");
                for (String regNo : studentRegNos) {
                    Optional<Student> studentOpt = studentRepository.findByRegNo(regNo.trim());
                    if (studentOpt.isPresent()) {
                        Student student = studentOpt.get();
                        Map<String, String> info = new HashMap<>();
                        info.put("id", student.getRegNo());
                        info.put("name", student.getFullName());
                        info.put("type", "student");
                        info.put("department", student.getDepartment());
                        participants.add(info);
                    }
                }
            }
            
            // Add staff
            if (request.getStaffList() != null && !request.getStaffList().isEmpty()) {
                String requesterCode = request.getRequestedByStaffCode() != null ? 
                                       request.getRequestedByStaffCode() : request.getRegNo();
                                       
                String[] staffCodesArray = request.getStaffList().split(",");
                for (String code : staffCodesArray) {
                    String trimmedCode = code.trim();
                    
                    // Skip if already added as requester
                    if (request.getIncludeStaff() != null && request.getIncludeStaff() && 
                        trimmedCode.equalsIgnoreCase(requesterCode)) {
                        continue;
                    }
                    // Check if it's staff
                    Optional<Staff> staffOpt = staffRepository.findByStaffCode(trimmedCode);
                    if (staffOpt.isPresent()) {
                        Staff staff = staffOpt.get();
                        Map<String, String> info = new HashMap<>();
                        info.put("id", staff.getStaffCode());
                        info.put("name", staff.getStaffName());
                        info.put("type", "staff");
                        info.put("department", staff.getDepartment());
                        participants.add(info);
                    } else {
                        // Check if it's HOD (unlikely for staff bulk pass but for robustness)
                        Optional<HOD> hodOpt = hodRepository.findByHodCode(trimmedCode);
                        if (hodOpt.isPresent()) {
                            HOD hod = hodOpt.get();
                            Map<String, String> info = new HashMap<>();
                            info.put("id", hod.getHodCode());
                            info.put("name", hod.getHodName());
                            info.put("type", "hod");
                            info.put("department", hod.getDepartment());
                            participants.add(info);
                        }
                    }
                }
            }
            
            // Build response
            Map<String, Object> requestData = new HashMap<>();
            requestData.put("id", request.getId());
            requestData.put("passType", request.getPassType());
            requestData.put("requestedByStaffCode", request.getRequestedByStaffCode());
            requestData.put("requestedByStaffName", request.getRequestedByStaffName());
            requestData.put("department", request.getDepartment());
            requestData.put("purpose", request.getPurpose());
            requestData.put("reason", request.getReason());
            requestData.put("exitDateTime", request.getExitDateTime());
            requestData.put("returnDateTime", request.getReturnDateTime());
            requestData.put("status", request.getStatus());
            requestData.put("staffApproval", request.getStaffApproval());
            requestData.put("hodApproval", request.getHodApproval());
            requestData.put("studentCount", request.getStudentCount() != null ? request.getStudentCount() : 0);
            requestData.put("participantCount", participants.size());
            requestData.put("participants", participants);
            requestData.put("qrCode", request.getQrCode());
            requestData.put("includeStaff", request.getIncludeStaff());
            requestData.put("qrOwnerId", request.getQrOwnerId());
            requestData.put("receiverId", request.getReceiverId());
            requestData.put("requestDate", request.getRequestDate());
            requestData.put("createdAt", request.getCreatedAt());
            requestData.put("attachmentUri", request.getAttachmentUri());
            requestData.put("hodRemark", request.getHodRemark());
            
            // Fetch manual entry code from QRTable
            Optional<QRTable> qrOpt = qrTableRepository.findByPassRequestId(request.getId());
            if (qrOpt.isPresent()) {
                requestData.put("manualCode", qrOpt.get().getManualEntryCode());
            }
            
            response.put("success", true);
            response.put("request", requestData);
            
        } catch (Exception e) {
            response.put("success", false);
            response.put("message", "Error fetching gate pass details: " + e.getMessage());
            log.error("Error fetching gate pass details", e);
        }
        
        return response;
    }
    
    // Get bulk pass with full student details (for viewing)
    public Map<String, Object> getBulkPassStudentDetails(Long requestId) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            Optional<GatePassRequest> requestOpt = gatePassRequestRepository.findById(requestId);
            if (!requestOpt.isPresent()) {
                response.put("success", false);
                response.put("message", "Gate pass request not found");
                return response;
            }
            
            GatePassRequest request = requestOpt.get();
            
            // Build requester info
            Map<String, Object> requesterInfo = new HashMap<>();
            requesterInfo.put("name", request.getRequestedByStaffName() != null ? request.getRequestedByStaffName() : request.getStudentName());
            requesterInfo.put("code", request.getRequestedByStaffCode() != null ? request.getRequestedByStaffCode() : request.getRegNo());
            requesterInfo.put("role", request.getUserType() != null ? request.getUserType() : "STAFF");
            requesterInfo.put("department", request.getDepartment());
            
            // Build request info
            Map<String, Object> requestInfo = new HashMap<>();
            requestInfo.put("id", request.getId());
            requestInfo.put("passType", request.getPassType());
            requestInfo.put("bulkType", request.getBulkType());
            requestInfo.put("includeStaff", request.getIncludeStaff());
            requestInfo.put("studentCount", request.getStudentCount());
            requestInfo.put("purpose", request.getPurpose());
            requestInfo.put("reason", request.getReason());
            requestInfo.put("exitDateTime", request.getExitDateTime());
            requestInfo.put("returnDateTime", request.getReturnDateTime());
            requestInfo.put("status", request.getStatus());
            requestInfo.put("hrApproval", request.getHrApproval());
            requestInfo.put("hodApproval", request.getHodApproval());
            requestInfo.put("qrCode", request.getQrCode());
            requestInfo.put("manualCode", request.getManualCode());
            requestInfo.put("qrOwnerId", request.getQrOwnerId());
            requestInfo.put("qrGenerated", request.getQrCode() != null);
            requestInfo.put("requestDate", request.getRequestDate());
            requestInfo.put("attachmentUri", request.getAttachmentUri());
            requestInfo.put("hodRemark", request.getHodRemark());
            
            // Build unified participants list (students + staff)
            List<Map<String, Object>> participants = new ArrayList<>();

            // Add students from student_list
            if (request.getStudentList() != null && !request.getStudentList().isEmpty()) {
                String[] studentRegNos = request.getStudentList().split(",");
                for (String regNo : studentRegNos) {
                    Optional<Student> studentOpt = studentRepository.findByRegNo(regNo.trim());
                    if (studentOpt.isPresent()) {
                        Student student = studentOpt.get();
                        Map<String, Object> info = new HashMap<>();
                        info.put("id", student.getRegNo());
                        info.put("regNo", student.getRegNo());
                        info.put("name", student.getFullName());
                        info.put("studentName", student.getFullName());
                        info.put("fullName", student.getFullName());
                        info.put("department", student.getDepartment());
                        info.put("type", "student");
                        info.put("qrUsed", request.getQrUsed() != null ? request.getQrUsed() : false);
                        participants.add(info);
                    }
                }
            }

            // Add staff from staff_list
            if (request.getStaffList() != null && !request.getStaffList().isEmpty()) {
                String requesterCode = request.getRequestedByStaffCode() != null ?
                        request.getRequestedByStaffCode() : request.getRegNo();
                String[] staffCodes = request.getStaffList().split(",");
                log.info("Processing staffList for request {}: '{}'", request.getId(), request.getStaffList());
                for (String code : staffCodes) {
                    String trimmed = code.trim();
                    if (trimmed.isEmpty()) continue;
                    // Skip if already added as HOD requester
                    if (Boolean.TRUE.equals(request.getIncludeStaff()) && trimmed.equalsIgnoreCase(requesterCode)) continue;

                    Optional<Staff> staffOpt = staffRepository.findByStaffCode(trimmed);
                    if (staffOpt.isPresent()) {
                        Staff staff = staffOpt.get();
                        Map<String, Object> info = new HashMap<>();
                        info.put("id", staff.getStaffCode());
                        info.put("staffCode", staff.getStaffCode());
                        info.put("name", staff.getStaffName());
                        info.put("fullName", staff.getStaffName());
                        info.put("department", staff.getDepartment());
                        info.put("type", "staff");
                        participants.add(info);
                        log.info("Added staff participant: {} - {}", staff.getStaffCode(), staff.getStaffName());
                    } else {
                        // Check HOD table
                        Optional<HOD> hodOpt = hodRepository.findByHodCode(trimmed);
                        if (hodOpt.isPresent()) {
                            HOD hod = hodOpt.get();
                            Map<String, Object> info = new HashMap<>();
                            info.put("id", hod.getHodCode());
                            info.put("name", hod.getHodName());
                            info.put("fullName", hod.getHodName());
                            info.put("department", hod.getDepartment());
                            info.put("type", "hod");
                            participants.add(info);
                        } else {
                            log.warn("Staff/HOD not found for code: {}", trimmed);
                        }
                    }
                }
            }

            requestInfo.put("participants", participants);
            
            response.put("success", true);
            response.put("requester", requesterInfo);
            response.put("request", requestInfo);
            response.put("students", participants); // keep backward compat
            response.put("participants", participants);
            
        } catch (Exception e) {
            response.put("success", false);
            response.put("message", "Error fetching bulk pass student details: " + e.getMessage());
            log.error("Error fetching bulk pass student details", e);
        }
        
        return response;
    }
    
    // Validate manual entry code
    public Map<String, Object> validateManualEntryCode(String manualEntryCode) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            // Find QR by manual entry code
            Optional<QRTable> qrTableOpt = qrTableRepository.findByManualEntryCode(manualEntryCode);
            if (!qrTableOpt.isPresent()) {
                response.put("success", false);
                response.put("message", "Invalid entry code");
                response.put("valid", false);
                return response;
            }
            
            QRTable qrTable = qrTableOpt.get();
            
            // Check if QR is active
            if (!"ACTIVE".equals(qrTable.getStatus())) {
                response.put("success", false);
                response.put("message", "Entry code is " + qrTable.getStatus());
                response.put("valid", false);
                return response;
            }
            
            // Fetch gate pass from database
            Optional<GatePassRequest> requestOpt = gatePassRequestRepository.findById(qrTable.getPassRequestId());
            if (!requestOpt.isPresent()) {
                response.put("success", false);
                response.put("message", "Gate pass not found in database");
                response.put("valid", false);
                return response;
            }
            
            GatePassRequest request = requestOpt.get();
            
            // Check if approved
            if (request.getHodApproval() != GatePassRequest.ApprovalStatus.APPROVED) {
                response.put("success", false);
                response.put("message", "Gate pass not approved by HOD");
                response.put("valid", false);
                return response;
            }
            
            // Get student details from student_list field
            List<Map<String, String>> studentList = new ArrayList<>();
            if (request.getStudentList() != null && !request.getStudentList().isEmpty()) {
                String[] studentRegNos = request.getStudentList().split(",");
                for (String regNo : studentRegNos) {
                    Optional<Student> studentOpt = studentRepository.findByRegNo(regNo.trim());
                    if (studentOpt.isPresent()) {
                        Student student = studentOpt.get();
                        Map<String, String> info = new HashMap<>();
                        info.put("regNo", student.getRegNo());
                        info.put("studentName", student.getFullName());
                        info.put("department", student.getDepartment());
                        studentList.add(info);
                    }
                }
            }
            
            // Build success response
            response.put("success", true);
            response.put("valid", true);
            response.put("message", "✅ Valid Entry Code");
            response.put("passRequestId", qrTable.getPassRequestId());
            response.put("passType", qrTable.getPassType());
            response.put("includeStaff", qrTable.getIncludeStaff());
            response.put("staffCode", qrTable.getRequestedByStaffCode());
            response.put("manualEntryCode", qrTable.getManualEntryCode());
            response.put("qrString", qrTable.getQrString());
            
            // Get staff details
            Optional<Staff> staffOpt = staffRepository.findByStaffCode(qrTable.getRequestedByStaffCode());
            if (staffOpt.isPresent()) {
                response.put("staffName", staffOpt.get().getStaffName());
            }
            
            response.put("department", request.getDepartment());
            response.put("purpose", request.getPurpose());
            response.put("reason", request.getReason());
            response.put("studentCount", qrTable.getStudentCount());
            response.put("students", studentList);
            response.put("exitDateTime", request.getExitDateTime());
            response.put("returnDateTime", request.getReturnDateTime());
            response.put("status", qrTable.getStatus());
            response.put("entryScannedAt", qrTable.getEntryScannedAt());
            response.put("exitScannedAt", qrTable.getExitScannedAt());
            response.put("hodApproval", request.getHodApproval());
            
        } catch (Exception e) {
            response.put("success", false);
            response.put("message", "Error validating entry code: " + e.getMessage());
            response.put("valid", false);
            log.error("Error validating entry code", e);
        }
        
        return response;
    }
    
    // Validate QR string
    public Map<String, Object> validateQRString(String qrString) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            // Find QR in qr_table
            Optional<QRTable> qrTableOpt = qrTableRepository.findByQrString(qrString);
            if (!qrTableOpt.isPresent()) {
                response.put("success", false);
                response.put("message", "QR code not found in system");
                response.put("valid", false);
                return response;
            }
            
            QRTable qrTable = qrTableOpt.get();
            
            // Check if QR is active
            if (!"ACTIVE".equals(qrTable.getStatus())) {
                response.put("success", false);
                response.put("message", "QR code is " + qrTable.getStatus());
                response.put("valid", false);
                return response;
            }
            
            // Fetch gate pass from database
            Optional<GatePassRequest> requestOpt = gatePassRequestRepository.findById(qrTable.getPassRequestId());
            if (!requestOpt.isPresent()) {
                response.put("success", false);
                response.put("message", "Gate pass not found in database");
                response.put("valid", false);
                return response;
            }
            
            GatePassRequest request = requestOpt.get();
            
            // Check if approved
            if (request.getHodApproval() != GatePassRequest.ApprovalStatus.APPROVED) {
                response.put("success", false);
                response.put("message", "Gate pass not approved by HOD");
                response.put("valid", false);
                return response;
            }
            
            // Get student details from student_list field
            List<Map<String, String>> studentList = new ArrayList<>();
            if (request.getStudentList() != null && !request.getStudentList().isEmpty()) {
                String[] studentRegNos = request.getStudentList().split(",");
                for (String regNo : studentRegNos) {
                    Optional<Student> studentOpt = studentRepository.findByRegNo(regNo.trim());
                    if (studentOpt.isPresent()) {
                        Student student = studentOpt.get();
                        Map<String, String> info = new HashMap<>();
                        info.put("regNo", student.getRegNo());
                        info.put("studentName", student.getFullName());
                        info.put("department", student.getDepartment());
                        studentList.add(info);
                    }
                }
            }
            
            // Build success response
            response.put("success", true);
            response.put("valid", true);
            response.put("message", "✅ Valid Gate Pass");
            response.put("passRequestId", qrTable.getPassRequestId());
            response.put("passType", qrTable.getPassType());
            response.put("includeStaff", qrTable.getIncludeStaff());
            response.put("staffCode", qrTable.getRequestedByStaffCode());
            
            // Get staff details
            Optional<Staff> staffOpt = staffRepository.findByStaffCode(qrTable.getRequestedByStaffCode());
            if (staffOpt.isPresent()) {
                response.put("staffName", staffOpt.get().getStaffName());
            }
            
            response.put("department", request.getDepartment());
            response.put("purpose", request.getPurpose());
            response.put("reason", request.getReason());
            response.put("studentCount", qrTable.getStudentCount());
            response.put("students", studentList);
            response.put("exitDateTime", request.getExitDateTime());
            response.put("returnDateTime", request.getReturnDateTime());
            response.put("status", qrTable.getStatus());
            response.put("entryScannedAt", qrTable.getEntryScannedAt());
            response.put("exitScannedAt", qrTable.getExitScannedAt());
            response.put("hodApproval", request.getHodApproval());
            
        } catch (Exception e) {
            response.put("success", false);
            response.put("message", "Error validating QR: " + e.getMessage());
            response.put("valid", false);
            log.error("Error validating QR", e);
        }
        
        return response;
    }
    
    // Record entry scan (one-time only)
    @Transactional
    public Map<String, Object> recordEntryScan(String identifier, String scannedBy) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            // Find QR in qr_table (try both qrString and manualEntryCode)
            Optional<QRTable> qrTableOpt = qrTableRepository.findByQrString(identifier);
            if (!qrTableOpt.isPresent()) {
                qrTableOpt = qrTableRepository.findByManualEntryCode(identifier);
            }
            
            if (!qrTableOpt.isPresent()) {
                response.put("success", false);
                response.put("message", "QR code or entry code not found");
                return response;
            }
            
            QRTable qrTable = qrTableOpt.get();
            
            // Check if already scanned for entry
            if (qrTable.getEntryScannedAt() != null) {
                response.put("success", false);
                response.put("message", "❌ Entry already scanned at: " + qrTable.getEntryScannedAt());
                response.put("alreadyScanned", true);
                return response;
            }
            
            // Check if QR is active
            if (!"ACTIVE".equals(qrTable.getStatus())) {
                response.put("success", false);
                response.put("message", "QR code is " + qrTable.getStatus());
                return response;
            }
            
            // Record entry scan
            qrTable.setEntryScannedAt(LocalDateTime.now());
            qrTable.setEntryScannedBy(scannedBy);
            qrTableRepository.save(qrTable);
            
            response.put("success", true);
            response.put("message", "✅ Entry scan recorded successfully");
            response.put("entryScannedAt", qrTable.getEntryScannedAt());
            
        } catch (Exception e) {
            response.put("success", false);
            response.put("message", "Error recording entry scan: " + e.getMessage());
            log.error("Error recording entry scan", e);
        }
        
        return response;
    }
    
    // Record exit scan (one-time only, marks as COMPLETED)
    @Transactional
    public Map<String, Object> recordExitScan(String identifier, String scannedBy) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            // Find QR in qr_table (try both qrString and manualEntryCode)
            Optional<QRTable> qrTableOpt = qrTableRepository.findByQrString(identifier);
            if (!qrTableOpt.isPresent()) {
                qrTableOpt = qrTableRepository.findByManualEntryCode(identifier);
            }
            
            if (!qrTableOpt.isPresent()) {
                response.put("success", false);
                response.put("message", "QR code or entry code not found");
                return response;
            }
            
            QRTable qrTable = qrTableOpt.get();
            
            // Check if entry was scanned first
            if (qrTable.getEntryScannedAt() == null) {
                response.put("success", false);
                response.put("message", "❌ Entry must be scanned before exit");
                return response;
            }
            
            // Check if already scanned for exit
            if (qrTable.getExitScannedAt() != null) {
                response.put("success", false);
                response.put("message", "❌ Exit already scanned at: " + qrTable.getExitScannedAt());
                response.put("alreadyScanned", true);
                return response;
            }
            
            // Record exit scan and mark as COMPLETED
            qrTable.setExitScannedAt(LocalDateTime.now());
            qrTable.setStatus("COMPLETED");
            qrTable.setExitScannedBy(scannedBy);
            qrTableRepository.save(qrTable);
            
            response.put("success", true);
            response.put("message", "✅ Exit scan recorded successfully - Pass marked as COMPLETED");
            response.put("exitScannedAt", qrTable.getExitScannedAt());
            response.put("status", "COMPLETED");
            
        } catch (Exception e) {
            response.put("success", false);
            response.put("message", "Error recording exit scan: " + e.getMessage());
            log.error("Error recording exit scan", e);
        }
        
        return response;
    }
}
