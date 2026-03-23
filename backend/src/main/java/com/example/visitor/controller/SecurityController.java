package com.example.visitor.controller;

import com.example.visitor.entity.Person;
import com.example.visitor.entity.VehicleRegistration;
import com.example.visitor.entity.ScanLog;
import com.example.visitor.entity.Staff;
import com.example.visitor.entity.Student;
import com.example.visitor.entity.StaffMember;
import com.example.visitor.entity.QRTable;
import com.example.visitor.entity.PersonType;
import com.example.visitor.entity.ApprovalStatus;
import com.example.visitor.entity.Notification;
import com.example.visitor.entity.HOD;
import com.example.visitor.entity.Department;
import com.example.visitor.entity.Visitor;
import com.example.visitor.entity.RailwayExitLog;
import com.example.visitor.entity.RailwayEntry;
import com.example.visitor.entity.GatePassRequest;
import com.example.visitor.repository.PersonRepository;
import com.example.visitor.util.DepartmentMapper;
import com.example.visitor.repository.VehicleRegistrationRepository;
import com.example.visitor.repository.ScanLogRepository;
import com.example.visitor.repository.StaffRepository;
import com.example.visitor.repository.StudentRepository;
import com.example.visitor.repository.StaffMemberRepository;
import com.example.visitor.repository.QRTableRepository;
import com.example.visitor.repository.HODRepository;
import com.example.visitor.repository.DepartmentRepository;
import com.example.visitor.repository.VisitorRepository;
import com.example.visitor.service.NotificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.Map;
import java.util.HashMap;

@RestController
@RequestMapping("/api/security")
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class SecurityController {
    
    @Autowired
    private PersonRepository personRepository;
    
    @Autowired
    private VehicleRegistrationRepository vehicleRegistrationRepository;
    
    @Autowired
    private ScanLogRepository scanLogRepository;
    
    @Autowired
    private StaffRepository staffRepository;
    
    @Autowired
    private StudentRepository studentRepository;
    
    @Autowired
    private StaffMemberRepository staffMemberRepository;
    
    @Autowired
    private QRTableRepository qrTableRepository;
    
    @Autowired
    private NotificationService notificationService;
    
    @Autowired
    private HODRepository hodRepository;
    
    @Autowired
    private DepartmentRepository departmentRepository;
    
    @Autowired
    private VisitorRepository visitorRepository;
    
    @Autowired
    private com.example.visitor.service.GroupPassService groupPassService;
    
    @Autowired
    private com.example.visitor.service.GroupPassQRGenerationService groupPassQRGenerationService;
    
    @Autowired
    private com.example.visitor.repository.RailwayExitLogRepository railwayExitLogRepository;
    
    @Autowired
    private com.example.visitor.repository.RailwayEntryRepository railwayEntryRepository;
    
    @Autowired
    private com.example.visitor.repository.SecurityPersonnelRepository securityPersonnelRepository;
    
    @Autowired
    private com.example.visitor.repository.GatePassRequestRepository gatePassRequestRepository;
    
    @Autowired
    private com.example.visitor.service.LateEntryService lateEntryService;
    
    @Autowired
    private com.example.visitor.service.EmailService emailService;
    
    @Autowired
    private com.example.visitor.service.UnifiedVisitorService unifiedVisitorService;

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;
    
    // Parse new QR code format: user_type/user_id/random_qr_number
    private Optional<Person> parseAndFindPerson(String qrCode) {
        // Check if QR code uses new format (contains /)
        if (qrCode.contains("/")) {
            String[] parts = qrCode.split("/");
            if (parts.length >= 2) {
                String userType = parts[0].toUpperCase();
                String userId = parts[1];
                
                System.out.println("Parsing new QR format - Type: " + userType + ", ID: " + userId);
                
                // Lookup based on user type
                switch (userType) {
                    case "ST": // Student
                        if (!userId.equals("NULL")) {
                            return personRepository.findByStudentId(userId);
                        }
                        break;
                    case "SF": // Staff/Faculty
                        if (!userId.equals("NULL")) {
                            return personRepository.findByFacultyId(userId);
                        }
                        break;
                    case "HD": // HOD
                        if (!userId.equals("NULL")) {
                            return personRepository.findByFacultyId(userId);
                        }
                        break;
                    case "VG": // Visitor
                        // For visitors, try to find by QR code
                        return personRepository.findByQrCode(qrCode);
                    default:
                        System.out.println("Unknown user type: " + userType);
                }
            }
        }
        
        // Fallback: Try legacy format (direct QR code lookup)
        return personRepository.findByQrCode(qrCode);
    }
    
    // Validate QR code format: user_type/user_id/random
    private boolean isValidQRFormat(String qrCode) {
        // Support both pipe (|) and slash (/) formats
        if (!qrCode.contains("|") && !qrCode.contains("/")) {
            return false;
        }
        
        String[] parts = qrCode.contains("|") ? qrCode.split("\\|") : qrCode.split("/");
        if (parts.length < 2) {
            return false;
        }
        
        String userType = parts[0].toUpperCase();
        return userType.equals("ST") || userType.equals("SF") || userType.equals("VG") || userType.equals("GP") || userType.equals("HD");
    }
    
    // QR Code Scanning Endpoints - POST version to avoid URL encoding issues
    @PostMapping("/scan")
    public ResponseEntity<?> scanQrCodePost(@RequestBody java.util.Map<String, String> request) {
        String qrCode = request.get("qrCode");
        if (qrCode == null || qrCode.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(new java.util.HashMap<String, Object>() {{
                put("status", "ERROR");
                put("message", "QR code is required");
            }});
        }
        return scanQrCodeInternal(qrCode);
    }
    
    // QR Code Scanning Endpoints - GET version (legacy support)
    @GetMapping("/scan/{qrCode}")
    public ResponseEntity<?> scanQrCode(@PathVariable String qrCode) {
        return scanQrCodeInternal(qrCode);
    }
    
    // Late Entry Scanning Endpoint - For students/staff arriving late
    @PostMapping("/scan-late-entry")
    public ResponseEntity<?> scanLateEntry(@RequestBody java.util.Map<String, String> request) {
        try {
            String idCode = request.get("idCode");
            String securityId = request.getOrDefault("securityId", "SEC001");
            
            if (idCode == null || idCode.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(java.util.Map.of(
                    "success", false,
                    "message", "ID code is required"
                ));
            }
            
            System.out.println("🔍 Late Entry Scan - ID Code: " + idCode + ", Security: " + securityId);
            
            // Try to identify user type by checking different tables
            // 1. Check if it's a student (registration number)
            Optional<Student> studentOpt = studentRepository.findByRegNo(idCode);
            if (studentOpt.isPresent()) {
                com.example.visitor.service.LateEntryService.LateEntryResponse response = 
                    lateEntryService.recordStudentLateEntry(idCode, securityId);
                return ResponseEntity.ok(response);
            }
            
            // 2. Check if it's a staff member (staff code)
            Optional<Staff> staffOpt = staffRepository.findByStaffCode(idCode);
            if (staffOpt.isPresent()) {
                com.example.visitor.service.LateEntryService.LateEntryResponse response = 
                    lateEntryService.recordStaffLateEntry(idCode, securityId);
                return ResponseEntity.ok(response);
            }
            
            // 3. Check if it's a staff member in StaffMember table
            Optional<StaffMember> staffMemberOpt = staffMemberRepository.findByStaffCode(idCode);
            if (staffMemberOpt.isPresent()) {
                com.example.visitor.service.LateEntryService.LateEntryResponse response = 
                    lateEntryService.recordStaffLateEntry(idCode, securityId);
                return ResponseEntity.ok(response);
            }
            
            // 4. Check if it's a HOD (HOD code)
            Optional<HOD> hodOpt = hodRepository.findByHodCode(idCode);
            if (hodOpt.isPresent()) {
                com.example.visitor.service.LateEntryService.LateEntryResponse response = 
                    lateEntryService.recordHODLateEntry(idCode, securityId);
                return ResponseEntity.ok(response);
            }
            
            // 5. Check if it's a Visitor Manual Code (new GatePassRequest structure)
            Optional<GatePassRequest> gpVisOpt = gatePassRequestRepository.findByManualCode(idCode);
            if (gpVisOpt.isPresent()) {
                String qrCode = gpVisOpt.get().getQrCode();
                if (qrCode != null) {
                    System.out.println("✅ Found modern visitor manual code. Routing to QR processor...");
                    ResponseEntity<?> qrResponse = scanQrCodeInternal(qrCode);
                    return adaptQrResponseForLateEntry(qrResponse);
                }
            }
            
            // 6. Check if it's a Visitor Manual Code (legacy Visitor structure)
            Optional<Visitor> visitorOpt = visitorRepository.findByManualCode(idCode);
            if (visitorOpt.isPresent()) {
                String qrCode = visitorOpt.get().getQrCode();
                if (qrCode != null) {
                    System.out.println("✅ Found legacy visitor manual code. Routing to QR processor...");
                    ResponseEntity<?> qrResponse = scanQrCodeInternal(qrCode);
                    return adaptQrResponseForLateEntry(qrResponse);
                }
            }
            
            // User not found
            System.out.println("❌ User not found with ID code: " + idCode);
            return ResponseEntity.status(404).body(java.util.Map.of(
                "success", false,
                "message", "User not found with ID code: " + idCode
            ));
            
        } catch (Exception e) {
            System.err.println("Error processing late entry: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(500).body(java.util.Map.of(
                "success", false,
                "message", "Error processing late entry: " + e.getMessage()
            ));
        }
    }
    
    // Helper to adapt QR scanner response format to Late Entry response format
    private ResponseEntity<?> adaptQrResponseForLateEntry(ResponseEntity<?> qrResponse) {
        if (qrResponse.getBody() instanceof java.util.Map) {
            @SuppressWarnings("unchecked")
            java.util.Map<String, Object> body = new java.util.HashMap<>((java.util.Map<String, Object>) qrResponse.getBody());
            
            // If QR scan was approved, force success=true for the late entry frontend parser
            if ("APPROVED".equals(body.get("status"))) {
                body.put("success", true);
                if (!body.containsKey("message")) {
                    body.put("message", "Visitor " + (body.containsKey("name") ? body.get("name") : "") + " scan successful");
                }
                return ResponseEntity.ok(body);
            } else {
                body.put("success", false);
                return ResponseEntity.status(qrResponse.getStatusCode()).body(body);
            }
        }
        return qrResponse;
    }
    
    // Internal method for QR code scanning logic with QR table push/pop
    @org.springframework.transaction.annotation.Transactional
    private ResponseEntity<?> scanQrCodeInternal(String qrCode) {
        try {
            // Step 0: Check if this is a bulk/group pass (GP| prefix)
            if (qrCode.startsWith("GP|")) {
                return handleBulkPassScan(qrCode);
            }
            
            // Step 0.5: Check if this is a manual entry code (6 digits only)
            if (qrCode.matches("^\\d{6}$")) {
                System.out.println("🔐 Manual entry code detected: " + qrCode);
                return handleManualCodeScan(qrCode);
            }
            
            // Step 1: Validate QR code format
            if (!isValidQRFormat(qrCode)) {
                System.out.println("❌ ACCESS DENIED - Invalid QR format: " + qrCode);
                
                // Do NOT save invalid QR codes to scan history
                return ResponseEntity.status(403).body(new java.util.HashMap<String, Object>() {{
                    put("qrCode", qrCode);
                    put("status", "DENIED");
                    put("message", "Invalid QR code format");
                    put("accessGranted", false);
                    put("name", "Invalid QR");
                    put("type", "VISITOR");
                }});
            }
            
            // Step 2: Parse QR code (support both | and / separators)
            String[] parts = qrCode.contains("|") ? qrCode.split("\\|") : qrCode.split("/");
            String userType = parts[0].toUpperCase();
            String userId = parts[1];
            String randomNumber = parts.length >= 3 ? parts[2] : null;
            
            System.out.println("🔍 Scanning QR: " + qrCode + " | Type: " + userType + " | ID: " + userId + " | Random: " + randomNumber);
            
            // Step 3: Query QR table using qr_string (full QR code)
            Optional<QRTable> qrTableOpt = qrTableRepository.findByQrString(qrCode);
            
            if (!qrTableOpt.isPresent()) {
                System.out.println("❌ ACCESS DENIED - QR code not found in QR table: " + qrCode);
                
                PersonType personType = userType.equals("ST") ? PersonType.STUDENT : 
                                       userType.equals("SF") ? PersonType.FACULTY : 
                                       userType.equals("HD") ? PersonType.FACULTY : PersonType.VISITOR;
                
                // DO NOT save invalid QR codes to database
                // Just return error response without creating scan log
                
                return ResponseEntity.status(403).body(new java.util.HashMap<String, Object>() {{
                    put("qrCode", qrCode);
                    put("status", "DENIED");
                    put("message", "QR code not found in system");
                    put("accessGranted", false);
                    put("name", "QR Not Found");
                    put("type", personType.toString());
                }});
            }
            
            QRTable qrTable = qrTableOpt.get();
            
            // Step 3.5: Fallback for old Visitor passes which hardcoded userId as "null"
            if ("VG".equals(userType) && ("null".equals(userId) || userId == null)) {
                if (qrTable.getPassRequestId() != null) {
                    userId = qrTable.getPassRequestId().toString();
                    System.out.println("🔄 Recovered legacy Visitor ID from PassRequest: " + userId);
                }
            }
            
            // Step 4: Validate both entry and exit are not NULL
            if (qrTable.getEntry() == null && qrTable.getExit() == null) {
                System.out.println("❌ ACCESS DENIED - Both entry and exit are NULL for QR: " + qrCode);
                
                PersonType personType = userType.equals("ST") ? PersonType.STUDENT : 
                                       userType.equals("SF") ? PersonType.FACULTY : 
                                       userType.equals("HD") ? PersonType.FACULTY : PersonType.VISITOR;
                
                // Do NOT save invalid QR codes to scan history
                return ResponseEntity.status(403).body(new java.util.HashMap<String, Object>() {{
                    put("qrCode", qrCode);
                    put("status", "DENIED");
                    put("message", "QR code is invalid (already used)");
                    put("accessGranted", false);
                    put("name", "Invalid QR");
                    put("type", personType.toString());
                }});
            }
            
            // Step 5: Process based on user type
            boolean accessGranted = false;
            String scanLocation = "Main Gate";
            
            if (userType.equals("ST") || userType.equals("SF") || userType.equals("HD")) {
                // ST/SF/HD: Only use exit column
                
                // Validate if already exited today
                if (railwayExitLogRepository.existsByUserIdToday(userId)) {
                    System.out.println("❌ ACCESS DENIED - User already scanned out today: " + userId);
                    
                    PersonType personType = userType.equals("ST") ? PersonType.STUDENT : 
                                           userType.equals("SF") ? PersonType.FACULTY : 
                                           userType.equals("HD") ? PersonType.FACULTY : PersonType.VISITOR;
                    
                    return ResponseEntity.status(403).body(new java.util.HashMap<String, Object>() {{
                        put("qrCode", qrCode);
                        put("status", "DENIED");
                        put("message", "Daily Limit Reached: Gate Pass Already Scanned Today");
                        put("accessGranted", false);
                        put("name", "Daily Limit Reached");
                        put("type", personType.toString());
                    }});
                }

                // Validate: ST/SF/HD should never have entry value
                if (qrTable.getEntry() != null) {
                    System.out.println("❌ ACCESS DENIED - ST/SF/HD should not have entry value: " + qrCode);
                    
                    PersonType personType = userType.equals("ST") ? PersonType.STUDENT : 
                                           userType.equals("SF") ? PersonType.FACULTY : 
                                           userType.equals("HD") ? PersonType.FACULTY : PersonType.VISITOR;
                    
                    // Do NOT save invalid QR codes to scan history
                    return ResponseEntity.status(403).body(new java.util.HashMap<String, Object>() {{
                        put("qrCode", qrCode);
                        put("status", "DENIED");
                        put("message", "Invalid QR configuration for ST/SF/HD");
                        put("accessGranted", false);
                        put("name", "Invalid Entry");
                        put("type", personType.toString());
                    }});
                }
                
                // Check if random matches exit column
                if (randomNumber != null && randomNumber.equals(qrTable.getExit())) {
                    accessGranted = true;
                    scanLocation = "Exit Gate";
                    
                    // Create exit record BEFORE deleting QR
                    RailwayExitLog exitLog = new RailwayExitLog();
                    exitLog.setQrId(qrTable.getId());
                    exitLog.setUserId(userId);
                    exitLog.setUserType(userType.equals("ST") ? "STUDENT" : userType.equals("SF") ? "STAFF" : userType.equals("HD") ? "HOD" : "VISITOR");
                    exitLog.setExitTime(java.time.LocalDateTime.now());
                    exitLog.setVerifiedBy("Security Guard");
                    exitLog.setLocation(scanLocation);
                    exitLog.setQrCode(qrCode);
                    exitLog.setScanLocation(scanLocation);
                    exitLog.setAccessGranted(true);
                    railwayExitLogRepository.save(exitLog);
                    
                    // Delete the entire row from qr_table
                    qrTableRepository.delete(qrTable);
                    
                    System.out.println("✅ ST/SF/HD EXIT APPROVED - Random matched exit column, deleted row: " + qrCode);
                } else {
                    System.out.println("❌ ACCESS DENIED - Random does not match exit column: " + qrCode);
                    
                    PersonType personType = userType.equals("ST") ? PersonType.STUDENT : 
                                           userType.equals("SF") ? PersonType.FACULTY : 
                                           userType.equals("HD") ? PersonType.FACULTY : PersonType.VISITOR;
                    
                    // Do NOT save invalid QR codes to scan history
                    return ResponseEntity.status(403).body(new java.util.HashMap<String, Object>() {{
                        put("qrCode", qrCode);
                        put("status", "DENIED");
                        put("message", "QR code does not match exit record");
                        put("accessGranted", false);
                        put("name", "Exit Mismatch");
                        put("type", personType.toString());
                    }});
                }
                
            } else if (userType.equals("VG")) {
                // VG: Use entry → exit flow (Visitor Gate pass)
                
                if (qrTable.getEntry() != null && qrTable.getExit() == null) {
                    // First scan (Entry)
                    if (randomNumber != null && randomNumber.equals(qrTable.getEntry())) {
                        accessGranted = true;
                        scanLocation = "Entry Gate";
                        
                        // Create entry record (ScanLog will also save to this table in Step 7)
                        // Skipping redundant railwayEntryRepository.save here
                        
                        System.out.println("✅ VG ENTRY details captured, will save to ScanLog in Step 7");
                        
                        // Move random from entry to exit
                        qrTable.setExit(qrTable.getEntry());
                        qrTable.setEntry(null);
                        qrTableRepository.save(qrTable);
                        
                        // Update visitor entity - record entry time
                        try {
                            Long visitorId = Long.parseLong(userId);
                            Optional<Visitor> visitorOpt = visitorRepository.findById(visitorId);
                            if (visitorOpt.isPresent()) {
                                Visitor visitor = visitorOpt.get();
                                visitor.setEntryTime(java.time.LocalDateTime.now());
                                visitor.setScanCount(1);
                                visitorRepository.save(visitor);
                                System.out.println("✅ Visitor entry time recorded: " + visitor.getName());
                            }
                        } catch (Exception e) {
                            System.err.println("⚠️ Could not update visitor entry time: " + e.getMessage());
                        }
                        
                        System.out.println("✅ VG ENTRY APPROVED - Moved random from entry to exit: " + qrCode);
                    } else {
                        System.out.println("❌ ACCESS DENIED - Random does not match entry column: " + qrCode);
                        
                        // Do NOT save invalid QR codes to scan history
                        return ResponseEntity.status(403).body(new java.util.HashMap<String, Object>() {{
                            put("qrCode", qrCode);
                            put("status", "DENIED");
                            put("message", "QR code does not match entry record");
                            put("accessGranted", false);
                            put("name", "Entry Mismatch");
                            put("type", "VISITOR");
                        }});
                    }
                    
                } else if (qrTable.getEntry() == null && qrTable.getExit() != null) {
                    // Second scan (Exit)
                    if (randomNumber != null && randomNumber.equals(qrTable.getExit())) {
                        accessGranted = true;
                        scanLocation = "Exit Gate";
                        
                        // Update visitor entity - record exit time
                        try {
                            Long visitorId = Long.parseLong(userId);
                            Optional<Visitor> visitorOpt = visitorRepository.findById(visitorId);
                            if (visitorOpt.isPresent()) {
                                Visitor visitor = visitorOpt.get();
                                visitor.setExitTime(java.time.LocalDateTime.now());
                                visitor.setScanCount(2);
                                visitorRepository.save(visitor);
                                System.out.println("✅ Visitor exit time recorded: " + visitor.getName());
                            }
                        } catch (Exception e) {
                            System.err.println("⚠️ Could not update visitor exit time: " + e.getMessage());
                        }
                        
                        // Create exit record in Exit_logs table BEFORE deleting QR
                        RailwayExitLog exitLog = new RailwayExitLog();
                        exitLog.setQrId(qrTable.getId());
                        exitLog.setUserId(userId);
                        exitLog.setUserType("VISITOR");
                        exitLog.setExitTime(java.time.LocalDateTime.now());
                        exitLog.setVerifiedBy("Security Guard");
                        exitLog.setLocation(scanLocation);
                        exitLog.setQrCode(qrCode);
                        exitLog.setScanLocation(scanLocation);
                        exitLog.setAccessGranted(true);
                        railwayExitLogRepository.save(exitLog);
                        
                        System.out.println("✅ VG EXIT record created in Exit_logs table");
                        
                        // Delete the entire row from qr_table
                        qrTableRepository.delete(qrTable);
                        
                        System.out.println("✅ VG EXIT APPROVED - Deleted entire row: " + qrCode);
                    } else {
                        System.out.println("❌ ACCESS DENIED - Random does not match exit column: " + qrCode);
                        
                        // Do NOT save invalid QR codes to scan history
                        return ResponseEntity.status(403).body(new java.util.HashMap<String, Object>() {{
                            put("qrCode", qrCode);
                            put("status", "DENIED");
                            put("message", "QR code does not match exit record");
                            put("accessGranted", false);
                            put("name", "Exit Mismatch");
                            put("type", "VISITOR");
                        }});
                    }
                } else {
                    System.out.println("❌ ACCESS DENIED - Invalid VG state (both entry and exit have values): " + qrCode);
                    
                    // Do NOT save invalid QR codes to scan history
                    return ResponseEntity.status(403).body(new java.util.HashMap<String, Object>() {{
                        put("qrCode", qrCode);
                        put("status", "DENIED");
                        put("message", "Invalid visitor QR state");
                        put("accessGranted", false);
                        put("name", "Invalid State");
                        put("type", "VISITOR");
                    }});
                }
            }
            
            // Step 6: Fetch detailed information from students/staff tables
            java.util.Map<String, Object> detailedInfo = new java.util.HashMap<>();
            detailedInfo.put("qrCode", qrCode);
            detailedInfo.put("success", true);
            detailedInfo.put("accessGranted", accessGranted);
            detailedInfo.put("status", "APPROVED");
            
            String personName = "User ID: " + userId;
            String department = null;
            String email = null;
            String phone = null;
            String year = null;
            String role = null;
            PersonType personType;
            
            switch (userType) {
                case "ST": // Student
                    personType = PersonType.STUDENT;
                    detailedInfo.put("type", "STUDENT");
                    detailedInfo.put("studentId", userId);
                    
                    Optional<Student> student = studentRepository.findByRegNo(userId);
                    if (student.isPresent()) {
                        Student s = student.get();
                        personName = s.getFullName();
                        department = s.getDepartment();
                        email = s.getEmail();
                        phone = s.getPhone();
                        year = s.getYear();
                        
                        detailedInfo.put("name", personName);
                        detailedInfo.put("department", department);
                        detailedInfo.put("email", email);
                        detailedInfo.put("phone", phone);
                        detailedInfo.put("year", year);
                        detailedInfo.put("regNo", s.getRegNo());
                        
                        System.out.println("📋 Student details: " + personName + " - " + department + " - Year " + year);
                    } else {
                        personName = "Student - " + userId;
                        detailedInfo.put("name", personName);
                    }
                    break;
                    
                case "SF": // Staff/Faculty
                    personType = PersonType.FACULTY;
                    detailedInfo.put("type", "FACULTY");
                    detailedInfo.put("facultyId", userId);
                    
                    Optional<StaffMember> staffMember = staffMemberRepository.findByStaffCode(userId);
                    if (staffMember.isPresent()) {
                        StaffMember sm = staffMember.get();
                        personName = sm.getStaffName() != null ? sm.getStaffName() : sm.getName();
                        department = sm.getDepartment();
                        email = sm.getEmail();
                        phone = sm.getPhone();
                        role = sm.getRole();
                        
                        detailedInfo.put("name", personName);
                        detailedInfo.put("department", department);
                        detailedInfo.put("email", email);
                        detailedInfo.put("phone", phone);
                        detailedInfo.put("role", role);
                        detailedInfo.put("staffCode", sm.getStaffCode());
                        
                        System.out.println("📋 Staff details: " + personName + " - " + role + " - " + department);
                    } else {
                        personName = "Staff - " + userId;
                        detailedInfo.put("name", personName);
                    }
                    break;
                    
                case "HD": // HOD
                    personType = PersonType.FACULTY;
                    detailedInfo.put("type", "HOD");
                    detailedInfo.put("facultyId", userId);
                    
                    Optional<HOD> hod = hodRepository.findByHodCode(userId);
                    if (hod.isPresent()) {
                        HOD h = hod.get();
                        personName = h.getHodName();
                        department = h.getDepartment();
                        email = h.getEmail();
                        phone = h.getPhone();
                        role = "HOD";
                        
                        detailedInfo.put("name", personName);
                        detailedInfo.put("department", department);
                        detailedInfo.put("email", email);
                        detailedInfo.put("phone", phone);
                        detailedInfo.put("role", role);
                        detailedInfo.put("staffCode", h.getHodCode());
                        
                        System.out.println("📋 HOD details: " + personName + " - " + role + " - " + department);
                    } else {
                        personName = "HOD - " + userId;
                        detailedInfo.put("name", personName);
                    }
                    break;
                    
                case "VG": // Visitor
                    personType = PersonType.VISITOR;
                    detailedInfo.put("type", "VISITOR");
                    
                    // Fetch visitor details from visitors table
                    try {
                        Long visitorId = Long.parseLong(userId);
                        Optional<Visitor> visitorOpt = visitorRepository.findById(visitorId);
                        if (visitorOpt.isPresent()) {
                            Visitor v = visitorOpt.get();
                            personName = v.getName();
                            department = v.getDepartment();
                            email = v.getEmail();
                            phone = v.getPhone();
                            
                            detailedInfo.put("name", personName);
                            detailedInfo.put("department", department);
                            detailedInfo.put("email", email);
                            detailedInfo.put("phone", phone);
                            detailedInfo.put("purpose", v.getPurpose());
                            detailedInfo.put("personToMeet", v.getPersonToMeet());
                            detailedInfo.put("numberOfPeople", v.getNumberOfPeople());
                            detailedInfo.put("visitDate", v.getVisitDate() != null ? v.getVisitDate().toString() : null);
                            detailedInfo.put("visitTime", v.getVisitTime() != null ? v.getVisitTime().toString() : null);
                            detailedInfo.put("scanCount", v.getScanCount());
                            
                            System.out.println("📋 Visitor details: " + personName + " - Purpose: " + v.getPurpose() + " - Meeting: " + v.getPersonToMeet());
                        } else {
                            personName = "Visitor - " + userId;
                            detailedInfo.put("name", personName);
                        }
                    } catch (Exception e) {
                        personName = "Visitor - " + userId;
                        detailedInfo.put("name", personName);
                        System.err.println("⚠️ Could not fetch visitor details: " + e.getMessage());
                    }
                    break;
                    
                default:
                    personType = PersonType.VISITOR;
                    detailedInfo.put("type", "VISITOR");
                    detailedInfo.put("name", personName);
            }
            
            // Step 7: Create scan log with detailed info
            ScanLog scanLog = new ScanLog();
            scanLog.setQrCode(qrCode);
            scanLog.setPersonName(personName);
            scanLog.setPersonType(personType);
            scanLog.setStatus(ApprovalStatus.APPROVED);
            scanLog.setAccessGranted(true);
            scanLog.setScannedBy("Security Guard");
            scanLog.setScanLocation(scanLocation);
            scanLog.setDepartment(department);
            scanLog.setEmail(email);
            scanLog.setPhone(phone);
            scanLog.setUserId(userId);
            scanLog.setUserType(userType);
            scanLog.setQrId(qrTable.getId());
            
            if (userType.equals("ST")) {
                scanLog.setStudentId(userId);
            } else if (userType.equals("SF") || userType.equals("HD")) {
                scanLog.setFacultyId(userId);
                scanLog.setDesignation(role);
            }
            
            // Step 7: Create scan log with detailed info (ONLY for entries to avoid duplicates in history)
            if (scanLocation != null && scanLocation.toLowerCase().contains("entry")) {
                scanLogRepository.save(scanLog);
                System.out.println("✅ ACCESS GRANTED - Scan log created for ENTRY: " + personName);
            } else {
                System.out.println("✅ ACCESS GRANTED - Scan completed for EXIT (not mirrored to ScanLog to prevent history duplication): " + personName);
            }
            
            return ResponseEntity.ok(detailedInfo);
            
        } catch (Exception e) {
            System.err.println("Error scanning QR code: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }
    
    /**
     * Handle bulk/group pass scanning (EXIT-ONLY workflow)
     * Format: GP|incharge|students|staff|subtype:token
     * Gate passes are for EXIT only - no entry tracking
     */
    @org.springframework.transaction.annotation.Transactional
    private ResponseEntity<?> handleBulkPassScan(String qrCode) {
        try {
            System.out.println("🔍 Bulk Pass Scan: " + qrCode);
            
            // Parse 5-part format: GP|incharge|students|staff|subtype:token
            String[] parts = qrCode.split("\\|");
            if (parts.length != 5) {
                System.out.println("❌ Invalid bulk pass format - expected 5 parts, got " + parts.length);
                return ResponseEntity.status(403).body(new java.util.HashMap<String, Object>() {{
                    put("qrCode", qrCode);
                    put("status", "DENIED");
                    put("message", "Invalid bulk pass format");
                    put("accessGranted", false);
                    put("type", "BULK_PASS");
                }});
            }
            
            String prefix = parts[0]; // "GP"
            String incharge = parts[1]; // HOD or Staff code
            String studentList = parts[2]; // Comma-separated student reg numbers
            String staffList = parts[3]; // Comma-separated staff codes
            String subtypeToken = parts[4]; // "SEG:token" or "SIG:token"
            
            // Parse subtype and token
            String[] subtypeParts = subtypeToken.split(":");
            if (subtypeParts.length != 2) {
                System.out.println("❌ Invalid subtype format");
                return ResponseEntity.status(403).body(new java.util.HashMap<String, Object>() {{
                    put("qrCode", qrCode);
                    put("status", "DENIED");
                    put("message", "Invalid subtype format");
                    put("accessGranted", false);
                    put("type", "BULK_PASS");
                }});
            }
            
            String subtype = subtypeParts[0]; // "SEG" or "SIG"
            String token = subtypeParts[1];
            
            System.out.println("📋 Parsed - Incharge: " + incharge + ", Subtype: " + subtype + ", Token: " + token);
            
            // Find the QR in database
            Optional<QRTable> qrTableOpt = qrTableRepository.findByQrString(qrCode);
            if (!qrTableOpt.isPresent()) {
                System.out.println("❌ Bulk pass QR not found in database");
                return ResponseEntity.status(403).body(new java.util.HashMap<String, Object>() {{
                    put("qrCode", qrCode);
                    put("status", "DENIED");
                    put("message", "Bulk pass not found in system");
                    put("accessGranted", false);
                    put("type", "BULK_PASS");
                }});
            }
            
            QRTable qrTable = qrTableOpt.get();
            
            // Check if already used (exit should be null after first scan)
            if (qrTable.getExit() == null) {
                System.out.println("❌ Bulk pass already used");
                return ResponseEntity.status(403).body(new java.util.HashMap<String, Object>() {{
                    put("qrCode", qrCode);
                    put("status", "DENIED");
                    put("message", "Bulk pass already used (single scan only)");
                    put("accessGranted", false);
                    put("type", "BULK_PASS");
                }});
            }
            
            // Verify token matches
            if (!token.equals(qrTable.getExit())) {
                System.out.println("❌ Token mismatch - Expected: " + qrTable.getExit() + ", Got: " + token);
                return ResponseEntity.status(403).body(new java.util.HashMap<String, Object>() {{
                    put("qrCode", qrCode);
                    put("status", "DENIED");
                    put("message", "Invalid token");
                    put("accessGranted", false);
                    put("type", "BULK_PASS");
                }});
            }
            
            // Build participant list
            java.util.List<String> participants = new java.util.ArrayList<>();
            
            // Add students
            if (studentList != null && !studentList.trim().isEmpty()) {
                String[] students = studentList.split(",");
                for (String student : students) {
                    if (!student.trim().isEmpty()) {
                        participants.add("ST:" + student.trim());
                    }
                }
            }
            
            // Add staff
            if (staffList != null && !staffList.trim().isEmpty()) {
                String[] staff = staffList.split(",");
                for (String staffMember : staff) {
                    if (!staffMember.trim().isEmpty()) {
                        participants.add("SF:" + staffMember.trim());
                    }
                }
            }
            
            // If SIG (Staff/HOD Included Group), add the incharge to participants
            if ("SIG".equals(subtype)) {
                // Determine if incharge is HOD or Staff from DB (not via code prefix).
                boolean isHod = hodRepository.findByHodCode(incharge).isPresent();
                participants.add((isHod ? "HOD:" : "SF:") + incharge);
                System.out.println("✅ SIG detected - Added incharge to participants: " + incharge);
            }
            
            System.out.println("📋 Total participants: " + participants.size());
            
            // Create exit logs for all participants BEFORE deleting QR
            LocalDateTime exitTime = LocalDateTime.now();
            java.util.List<java.util.Map<String, String>> participantDetails = new java.util.ArrayList<>();
            
            for (String participant : participants) {
                String[] participantParts = participant.split(":");
                String participantType = participantParts[0];
                String participantId = participantParts[1];
                
                // Create exit log
                RailwayExitLog exitLog = new RailwayExitLog();
                exitLog.setQrId(qrTable.getId());
                exitLog.setUserId(participantId);
                exitLog.setUserType(participantType.equals("ST") ? "STUDENT" : 
                                   participantType.equals("SF") ? "STAFF" : "HOD");
                exitLog.setExitTime(exitTime);
                exitLog.setVerifiedBy("Security Guard");
                exitLog.setLocation("Exit Gate");
                exitLog.setQrCode(qrCode);
                exitLog.setScanLocation("Exit Gate");
                exitLog.setAccessGranted(true);
                railwayExitLogRepository.save(exitLog);
                
                // Fetch participant details
                String name = participantId;
                String department = null;
                
                if ("ST".equals(participantType)) {
                    Optional<Student> student = studentRepository.findByRegNo(participantId);
                    if (student.isPresent()) {
                        name = student.get().getFullName();
                        department = student.get().getDepartment();
                    }
                } else if ("SF".equals(participantType)) {
                    Optional<StaffMember> staff = staffMemberRepository.findByStaffCode(participantId);
                    if (staff.isPresent()) {
                        name = staff.get().getStaffName() != null ? staff.get().getStaffName() : staff.get().getName();
                        department = staff.get().getDepartment();
                    }
                } else if ("HOD".equals(participantType)) {
                    Optional<HOD> hod = hodRepository.findByHodCode(participantId);
                    if (hod.isPresent()) {
                        name = hod.get().getHodName();
                        department = hod.get().getDepartment();
                    }
                }
                
                java.util.Map<String, String> details = new java.util.HashMap<>();
                details.put("id", participantId);
                details.put("name", name);
                details.put("type", participantType);
                details.put("department", department);
                participantDetails.add(details);
                
                System.out.println("✅ Exit logged: " + name + " (" + participantId + ")");
            }
            
            // Delete the entire row from QR table (same as ST/SF workflow)
            qrTableRepository.delete(qrTable);
            
            System.out.println("✅ Bulk pass QR deleted from database (single-use enforced)");
            
            // Fetch the Gatepass request to get purpose and reason
            Optional<GatePassRequest> gatepassOpt = gatePassRequestRepository.findById(qrTable.getPassRequestId());
            String purpose = "Bulk Pass";
            String reason = "";
            
            if (gatepassOpt.isPresent()) {
                GatePassRequest gatepass = gatepassOpt.get();
                purpose = gatepass.getPurpose() != null ? gatepass.getPurpose() : "Bulk Pass";
                reason = gatepass.getReason() != null ? gatepass.getReason() : "";
            }
            
            // Build response
            java.util.Map<String, Object> response = new java.util.HashMap<>();
            response.put("qrCode", qrCode);
            response.put("success", true);
            response.put("accessGranted", true);
            response.put("status", "APPROVED");
            response.put("type", "BULK_PASS");
            response.put("subtype", subtype);
            response.put("incharge", incharge);
            response.put("participantCount", participants.size());
            response.put("participants", participantDetails);
            response.put("exitTime", exitTime.toString());
            response.put("message", "Bulk pass exit approved - " + participants.size() + " participants");
            
            System.out.println("🎉 BULK PASS EXIT APPROVED - " + participants.size() + " participants");
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            System.err.println("Error scanning bulk pass: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(500).body(new java.util.HashMap<String, Object>() {{
                put("qrCode", qrCode);
                put("status", "ERROR");
                put("message", "Error processing bulk pass: " + e.getMessage());
                put("accessGranted", false);
                put("type", "BULK_PASS");
            }});
        }
    }
    
    /**
     * Handle manual entry code scanning
     * Manual codes are 6-digit numbers stored in QR table
     */
    @org.springframework.transaction.annotation.Transactional
    private ResponseEntity<?> handleManualCodeScan(String manualCode) {
        try {
            System.out.println("🔐 Manual Code Scan: " + manualCode);
            
            // Look up QR entry by manual_entry_code
            Optional<QRTable> qrTableOpt = qrTableRepository.findByManualEntryCode(manualCode);
            
            if (!qrTableOpt.isPresent()) {
                System.out.println("❌ Manual code not found: " + manualCode);
                return ResponseEntity.status(403).body(new java.util.HashMap<String, Object>() {{
                    put("qrCode", manualCode);
                    put("status", "DENIED");
                    put("message", "Manual code not found or already used");
                    put("accessGranted", false);
                    put("type", "MANUAL_ENTRY");
                }});
            }
            
            QRTable qrTable = qrTableOpt.get();
            String qrString = qrTable.getQrString();
            
            System.out.println("✅ Manual code found - QR String: " + qrString);
            
            // Process the QR string using existing logic
            // Check if it's a bulk pass or single pass
            if (qrString.startsWith("GP|")) {
                return handleBulkPassScan(qrString);
            } else {
                return scanQrCodeInternal(qrString);
            }
            
        } catch (Exception e) {
            System.err.println("Error processing manual code: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(500).body(new java.util.HashMap<String, Object>() {{
                put("qrCode", manualCode);
                put("status", "ERROR");
                put("message", "Error processing manual code: " + e.getMessage());
                put("accessGranted", false);
                put("type", "MANUAL_ENTRY");
            }});
        }
    }
    
    // Get scan logs
    @GetMapping("/scan-logs")
    public ResponseEntity<List<ScanLog>> getAllScanLogs() {
        try {
            List<ScanLog> logs = scanLogRepository.findAll();
            return ResponseEntity.ok(logs);
        } catch (Exception e) {
            System.err.println("Error fetching scan logs: " + e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }
    
    // Get scan logs by access granted
    @GetMapping("/scan-logs/access/{granted}")
    public ResponseEntity<List<ScanLog>> getScanLogsByAccess(@PathVariable Boolean granted) {
        try {
            List<ScanLog> logs = scanLogRepository.findByAccessGranted(granted);
            return ResponseEntity.ok(logs);
        } catch (Exception e) {
            System.err.println("Error fetching scan logs by access: " + e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }
    
    // Get all persons by type
    @GetMapping("/persons/{type}")
    public ResponseEntity<List<Person>> getPersonsByType(@PathVariable PersonType type) {
        try {
            List<Person> persons = personRepository.findByType(type);
            return ResponseEntity.ok(persons);
        } catch (Exception e) {
            System.err.println("Error fetching persons by type: " + e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }
    
    // Get all persons by status
    @GetMapping("/persons/status/{status}")
    public ResponseEntity<List<Person>> getPersonsByStatus(@PathVariable ApprovalStatus status) {
        try {
            List<Person> persons = personRepository.findByStatus(status);
            return ResponseEntity.ok(persons);
        } catch (Exception e) {
            System.err.println("Error fetching persons by status: " + e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }
    
    // Add new person
    @PostMapping("/persons")
    public ResponseEntity<Person> addPerson(@RequestBody Person person) {
        try {
            Person savedPerson = personRepository.save(person);
            System.out.println("Person added: " + savedPerson.getName() + " (" + savedPerson.getType() + ")");
            return ResponseEntity.ok(savedPerson);
        } catch (Exception e) {
            System.err.println("Error adding person: " + e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }
    
    // Update person status
    @PutMapping("/persons/{id}/status")
    public ResponseEntity<Person> updatePersonStatus(@PathVariable Long id, @RequestBody ApprovalStatus status) {
        try {
            Optional<Person> personOpt = personRepository.findById(id);
            if (personOpt.isPresent()) {
                Person person = personOpt.get();
                person.setStatus(status);
                Person updatedPerson = personRepository.save(person);
                System.out.println("Person status updated: " + person.getName() + " - " + status);
                return ResponseEntity.ok(updatedPerson);
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (Exception e) {
            System.err.println("Error updating person status: " + e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }
    
    // Vehicle Registration Endpoints
    @PostMapping("/vehicles")
    public ResponseEntity<?> registerVehicle(@RequestBody VehicleRegistration vehicle) {
        try {
            System.out.println("=== VEHICLE REGISTRATION REQUEST ===");
            System.out.println("License Plate: " + vehicle.getLicensePlate());
            System.out.println("Owner Name: " + vehicle.getOwnerName());
            System.out.println("Owner Phone: " + vehicle.getOwnerPhone());
            System.out.println("Owner Type: " + vehicle.getOwnerType());
            System.out.println("Vehicle Type: " + vehicle.getVehicleType());
            System.out.println("Registered By: " + vehicle.getRegisteredBy());
            System.out.println("====================================");
            
            // Check if vehicle already exists
            Optional<VehicleRegistration> existingVehicle = vehicleRegistrationRepository.findByLicensePlate(vehicle.getLicensePlate());
            if (existingVehicle.isPresent()) {
                System.out.println("⚠️ Vehicle already registered: " + vehicle.getLicensePlate());
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("success", false);
                errorResponse.put("message", "Vehicle with license plate " + vehicle.getLicensePlate() + " is already registered. Use search to update existing vehicle.");
                errorResponse.put("existingVehicle", existingVehicle.get());
                return ResponseEntity.status(409).body(errorResponse); // 409 Conflict
            }
            
            VehicleRegistration savedVehicle = vehicleRegistrationRepository.save(vehicle);
            System.out.println("✅ Vehicle registered successfully: " + savedVehicle.getLicensePlate());
            
            // Return success response in expected format
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Vehicle registered successfully");
            response.put("data", savedVehicle);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.err.println("❌ ERROR REGISTERING VEHICLE:");
            System.err.println("Error Type: " + e.getClass().getName());
            System.err.println("Error Message: " + e.getMessage());
            e.printStackTrace();
            
            // Check if it's a duplicate entry error
            String errorMessage = e.getMessage();
            if (errorMessage != null && errorMessage.contains("Duplicate entry")) {
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("success", false);
                errorResponse.put("message", "Vehicle with this license plate is already registered. Use search to update existing vehicle.");
                return ResponseEntity.status(409).body(errorResponse);
            }
            
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", "Failed to register vehicle: " + e.getMessage());
            
            return ResponseEntity.status(500).body(errorResponse);
        }
    }
    
    // Get vehicle by license plate
    @GetMapping("/vehicles/{licensePlate}")
    public ResponseEntity<?> getVehicleByLicensePlate(@PathVariable String licensePlate) {
        try {
            Optional<VehicleRegistration> vehicle = vehicleRegistrationRepository.findByLicensePlate(licensePlate);
            if (vehicle.isPresent()) {
                return ResponseEntity.ok(vehicle.get());
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (Exception e) {
            System.err.println("Error fetching vehicle: " + e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }
    
    // Get all vehicles (sorted by latest first)
    @GetMapping("/vehicles")
    public ResponseEntity<?> getAllVehicles() {
        try {
            System.out.println("📋 Fetching all vehicles");
            List<VehicleRegistration> vehicles = vehicleRegistrationRepository.findAll();
            
            // Sort by createdAt descending (latest first)
            vehicles.sort((v1, v2) -> {
                if (v1.getCreatedAt() == null && v2.getCreatedAt() == null) return 0;
                if (v1.getCreatedAt() == null) return 1;
                if (v2.getCreatedAt() == null) return -1;
                return v2.getCreatedAt().compareTo(v1.getCreatedAt());
            });
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", vehicles);
            response.put("count", vehicles.size());
            
            System.out.println("✅ Found " + vehicles.size() + " total vehicles (sorted latest first)");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.err.println("❌ Error fetching vehicles: " + e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", "Error fetching vehicles: " + e.getMessage());
            return ResponseEntity.status(500).body(errorResponse);
        }
    }
    
    // Search vehicles by license plate (query parameter, sorted by latest first)
    @GetMapping("/vehicles/search")
    public ResponseEntity<?> searchVehicles(@RequestParam String licensePlate) {
        try {
            System.out.println("🔍 Searching for vehicle: " + licensePlate);
            
            List<VehicleRegistration> vehicles = vehicleRegistrationRepository
                .findAll()
                .stream()
                .filter(v -> v.getLicensePlate().toUpperCase().contains(licensePlate.toUpperCase()))
                .sorted((v1, v2) -> {
                    if (v1.getCreatedAt() == null && v2.getCreatedAt() == null) return 0;
                    if (v1.getCreatedAt() == null) return 1;
                    if (v2.getCreatedAt() == null) return -1;
                    return v2.getCreatedAt().compareTo(v1.getCreatedAt());
                })
                .collect(Collectors.toList());
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", vehicles);
            response.put("count", vehicles.size());
            
            System.out.println("✅ Found " + vehicles.size() + " vehicles matching: " + licensePlate + " (sorted latest first)");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.err.println("❌ Error searching vehicles: " + e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", "Error searching vehicles: " + e.getMessage());
            return ResponseEntity.status(500).body(errorResponse);
        }
    }
    
    // HOD Contact Directory Endpoints
    // HODs are derived from the `hod` column in the `students` table.
    // The hod column stores name + optional designation suffix (e.g. "KANAGAVALLI N./ASSO P").
    // We strip the suffix and look up contact info from the `staff` table by name match.
    @GetMapping("/hods")
    public ResponseEntity<List<HODDTO>> getAllHODs() {
        try {
            // Step 1: Get distinct (hod, department) pairs from students
            List<java.util.Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT DISTINCT hod, department FROM students WHERE hod IS NOT NULL AND hod != ''"
            );

            // Step 2: Build HOD list, deduplicating by cleaned name
            java.util.Map<String, HODDTO> hodMap = new java.util.LinkedHashMap<>();
            for (java.util.Map<String, Object> row : rows) {
                String rawHod = (String) row.get("hod");
                String dept   = (String) row.get("department");
                if (rawHod == null || rawHod.isBlank()) continue;

                // Strip designation suffix after '/'
                String cleanName = rawHod.contains("/") ? rawHod.substring(0, rawHod.indexOf('/')).trim() : rawHod.trim();
                if (cleanName.isEmpty()) continue;

                // Normalize: strip trailing dots/slashes for dedup key
                String dedupKey = cleanName.replaceAll("[./]+$", "").trim().toUpperCase();
                if (hodMap.containsKey(dedupKey)) continue; // already added

                // Step 3: Look up contact info from staff table by name (partial match)
                List<java.util.Map<String, Object>> staffRows = jdbcTemplate.queryForList(
                    "SELECT staff_code, name, email, contact_no, department FROM staff WHERE name LIKE ? LIMIT 1",
                    "%" + cleanName + "%"
                );

                String staffCode = cleanName.replaceAll("\\s+", "_").toUpperCase();
                String email = null, phone = null, staffDept = dept;

                if (!staffRows.isEmpty()) {
                    java.util.Map<String, Object> s = staffRows.get(0);
                    staffCode = s.get("staff_code") != null ? (String) s.get("staff_code") : staffCode;
                    email     = (String) s.get("email");
                    phone     = (String) s.get("contact_no");
                    if (s.get("department") != null) staffDept = (String) s.get("department");
                }

                hodMap.put(dedupKey, new HODDTO(staffCode, staffCode, cleanName, email, phone, staffDept));
            }

            List<HODDTO> hodDTOs = new java.util.ArrayList<>(hodMap.values());
            System.out.println("Fetched " + hodDTOs.size() + " HODs from students table");
            return ResponseEntity.ok(hodDTOs);
        } catch (Exception e) {
            System.err.println("Error fetching HODs: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }
    
    @GetMapping("/hods/department/{departmentName}")
    public ResponseEntity<HODDTO> getHODByDepartment(@PathVariable String departmentName) {
        try {
            List<HOD> hods = hodRepository.findByDepartment(departmentName);
            Optional<HOD> activeHod = hods.stream()
                .filter(hod -> hod.getIsActive())
                .findFirst();
            
            if (activeHod.isPresent()) {
                HOD hod = activeHod.get();
                HODDTO hodDTO = new HODDTO(
                    hod.getHodCode(),
                    hod.getHodCode(),
                    hod.getHodName(),
                    hod.getEmail(),
                    hod.getPhone(),
                    hod.getDepartment()
                );
                return ResponseEntity.ok(hodDTO);
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (Exception e) {
            System.err.println("Error fetching HOD by department: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }
    
    // DTO class for HOD response
    public static class HODDTO {
        private String id;
        private String hodCode;
        private String name;
        private String email;
        private String phone;
        private String department;
        
        public HODDTO(String id, String hodCode, String name, String email, String phone, String department) {
            this.id = id;
            this.hodCode = hodCode;
            this.name = name;
            this.email = email;
            this.phone = phone;
            this.department = department;
        }
        
        // Getters
        public String getId() { return id; }
        public String getHodCode() { return hodCode; }
        public String getName() { return name; }
        public String getEmail() { return email; }
        public String getPhone() { return phone; }
        public String getDepartment() { return department; }
    }
    
    // Get staff and HODs by department for visitor registration
    @GetMapping("/staff-and-hods/department/{departmentName}")
    public ResponseEntity<List<PersonToMeetDTO>> getStaffAndHODsByDepartment(@PathVariable String departmentName) {
        try {
            List<PersonToMeetDTO> people = new java.util.ArrayList<>();
            
            // Try to find department by code first, then by name
            String deptCode = departmentName;
            String deptFullName = departmentName;
            
            // If it's a full name, try to get the code
            if (departmentName.length() > 5) {
                // It's likely a full name, try to find the code
                List<com.example.visitor.entity.Department> depts = departmentRepository.findAll();
                for (com.example.visitor.entity.Department dept : depts) {
                    if (dept.getName().equalsIgnoreCase(departmentName)) {
                        deptCode = dept.getCode();
                        deptFullName = dept.getName();
                        break;
                    }
                }
            } else {
                // It's likely a code, try to find the full name
                try {
                    com.example.visitor.entity.Department dept = departmentRepository.findById(departmentName).orElse(null);
                    if (dept != null) {
                        deptFullName = dept.getName();
                    }
                } catch (Exception e) {
                    // Ignore
                }
            }
            
            System.out.println("Searching for staff with code: " + deptCode + " and name: " + deptFullName);

            // Convert to the exact format used in staff.department column
            String staffDeptFormat = DepartmentMapper.toStaffDeptFormat(departmentName);
            System.out.println("Staff dept format: " + staffDeptFormat);

            // Fetch staff members from staff table using staff-format department name
            List<Staff> staffList = staffRepository.findByDepartment(staffDeptFormat);
            for (Staff staff : staffList) {
                if (staff.getIsActive()) {
                    people.add(new PersonToMeetDTO(
                        staff.getStaffCode(),
                        staff.getStaffName(),
                        "Staff Member",
                        staff.getEmail(),
                        staff.getPhone(),
                        deptFullName,
                        "STAFF"
                    ));
                }
            }

            // Fetch HODs from students table for this department
            String shortCode = DepartmentMapper.toShortCode(departmentName);
            List<java.util.Map<String, Object>> hodRows = jdbcTemplate.queryForList(
                "SELECT DISTINCT hod FROM students WHERE hod IS NOT NULL AND hod != '' AND department LIKE ?",
                "%" + (shortCode != null ? shortCode : departmentName) + "%"
            );
            java.util.Set<String> addedHods = new java.util.HashSet<>();
            for (java.util.Map<String, Object> row : hodRows) {
                String rawHod = (String) row.get("hod");
                if (rawHod == null || rawHod.isBlank()) continue;
                String cleanName = rawHod.contains("/") ? rawHod.substring(0, rawHod.indexOf('/')).trim() : rawHod.trim();
                String dedupKey = cleanName.replaceAll("[./]+$", "").trim().toUpperCase();
                if (addedHods.contains(dedupKey)) continue;
                addedHods.add(dedupKey);

                // Try to find contact info from staff table
                List<java.util.Map<String, Object>> staffRows = jdbcTemplate.queryForList(
                    "SELECT staff_code, name, email, contact_no FROM staff WHERE name LIKE ? LIMIT 1",
                    "%" + cleanName + "%"
                );
                String email2 = null, phone2 = null, code2 = cleanName.replaceAll("\\s+", "_").toUpperCase();
                if (!staffRows.isEmpty()) {
                    email2 = (String) staffRows.get(0).get("email");
                    phone2 = (String) staffRows.get(0).get("contact_no");
                    if (staffRows.get(0).get("staff_code") != null) code2 = (String) staffRows.get(0).get("staff_code");
                }
                people.add(new PersonToMeetDTO(code2, cleanName, "Head of Department", email2, phone2, deptFullName, "HOD"));
            }
            
            System.out.println("Fetched " + people.size() + " people (staff + HODs) for department: " + departmentName);
            return ResponseEntity.ok(people);
        } catch (Exception e) {
            System.err.println("Error fetching staff and HODs by department: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }
    
    // DTO class for person to meet (staff or HOD)
    public static class PersonToMeetDTO {
        private String id;
        private String name;
        private String role;
        private String email;
        private String phone;
        private String department;
        private String type; // "STAFF" or "HOD"
        
        public PersonToMeetDTO(String id, String name, String role, String email, String phone, String department, String type) {
            this.id = id;
            this.name = name;
            this.role = role;
            this.email = email;
            this.phone = phone;
            this.department = department;
            this.type = type;
        }
        
        // Getters
        public String getId() { return id; }
        public String getName() { return name; }
        public String getRole() { return role; }
        public String getEmail() { return email; }
        public String getPhone() { return phone; }
        public String getDepartment() { return department; }
        public String getType() { return type; }
    }
    
    // Active Persons Endpoint - Only PENDING (currently inside)
    @GetMapping("/active-persons")
    public ResponseEntity<List<java.util.Map<String, Object>>> getActivePersons() {
        try {
            List<ScanLog> allScans = scanLogRepository.findAll();

            // Only consider VISITOR entries — students/staff manage their own entry/exit via QR
            // Group by person name
            java.util.Map<String, java.util.List<ScanLog>> scansByPerson = new java.util.HashMap<>();
            for (ScanLog scan : allScans) {
                String key = scan.getPersonName();
                if (key == null || key.isBlank()) continue;
                String utype = scan.getUserType() != null ? scan.getUserType().toUpperCase() : "";
                // Only track visitors
                if (!"VISITOR".equals(utype) && !"VG".equals(utype)) continue;
                scansByPerson.computeIfAbsent(key, k -> new java.util.ArrayList<>()).add(scan);
            }

            List<java.util.Map<String, Object>> activePersons = new java.util.ArrayList<>();
            int id = 1;

            for (java.util.List<ScanLog> personScans : scansByPerson.values()) {
                if (personScans.isEmpty()) continue;

                // Use timestamp (DB column) for sorting — scanTime is @Transient
                personScans.removeIf(scan -> scan.getTimestamp() == null);
                if (personScans.isEmpty()) continue;

                personScans.sort((a, b) -> a.getTimestamp().compareTo(b.getTimestamp()));

                ScanLog firstScan = personScans.get(0);
                ScanLog lastScan  = personScans.get(personScans.size() - 1);

                // Only include if the last scan is NOT an exit scan
                if (lastScan.getScanLocation() != null &&
                    lastScan.getScanLocation().toLowerCase().contains("exit")) {
                    continue;
                }

                java.util.Map<String, Object> person = new java.util.HashMap<>();
                person.put("id", id++);
                person.put("name", firstScan.getPersonName());
                person.put("type", "VISITOR");
                person.put("purpose", firstScan.getPurpose() != null ? firstScan.getPurpose() : "General");
                person.put("status", "PENDING");
                person.put("inTime", firstScan.getTimestamp().toString());
                person.put("outTime", null);
                if (firstScan.getDepartment() != null) person.put("department", firstScan.getDepartment());
                if (firstScan.getUserId() != null) person.put("userId", firstScan.getUserId());

                activePersons.add(person);
            }

            System.out.println("Fetched " + activePersons.size() + " active visitors (PENDING only)");
            return ResponseEntity.ok(activePersons);
        } catch (Exception e) {
            System.err.println("Error fetching active persons: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }
    
    // Helper method to resolve person name for legacy logs
    private String resolvePersonName(String userId, String userType, String existingName) {
        if (existingName != null && !existingName.trim().isEmpty() && !existingName.startsWith("User ") 
            && !existingName.equals("null") && !existingName.startsWith("Student -") && !existingName.equals(userId)) {
            return existingName;
        }
        if (userId == null || userId.equals("null") || userId.isEmpty() || userId.equals("UNKNOWN")) return "Unknown User";
        
        // Auto-detect actual type from userId pattern
        String detectedType = detectUserType(userId, userType);
        
        try {
            // Try HOD first if detected
            if ("HOD".equalsIgnoreCase(detectedType) || "HD".equalsIgnoreCase(detectedType)) {
                Optional<HOD> hod = hodRepository.findByHodCode(userId);
                if (hod.isPresent()) return hod.get().getHodName();
            }
            
            // Try Student
            if ("STUDENT".equalsIgnoreCase(detectedType) || "ST".equalsIgnoreCase(detectedType)) {
                Optional<Student> student = studentRepository.findByRegNo(userId);
                if (student.isPresent()) return student.get().getFullName();
            }
            
            // Try Staff
            if ("STAFF".equalsIgnoreCase(detectedType) || "SF".equalsIgnoreCase(detectedType) || "FACULTY".equalsIgnoreCase(detectedType)) {
                Optional<Staff> staff = staffRepository.findByStaffCode(userId);
                if (staff.isPresent()) return staff.get().getStaffName();
                Optional<StaffMember> staffMember = staffMemberRepository.findByStaffCode(userId);
                if (staffMember.isPresent()) return staffMember.get().getStaffName() != null ? staffMember.get().getStaffName() : staffMember.get().getName();
            }
            
            // Try Visitor
            if ("VISITOR".equalsIgnoreCase(detectedType) || "VG".equalsIgnoreCase(detectedType)) {
                try {
                    Long numericId = Long.parseLong(userId);
                    // Check legacy Visitor table
                    Optional<Visitor> visitorOpt = visitorRepository.findById(numericId);
                    if (visitorOpt.isPresent()) return visitorOpt.get().getName();
                } catch(NumberFormatException nfe) {
                    // ID wasn't numeric, ignore
                }
            }
            
            // Fallback: try ALL repositories if primary lookup failed
            try {
                Long numericId = Long.parseLong(userId);
                Optional<Visitor> vOpt = visitorRepository.findById(numericId);
                if (vOpt.isPresent()) return vOpt.get().getName();
            } catch(NumberFormatException ignored) {}
            
            Optional<HOD> hod = hodRepository.findByHodCode(userId);
            if (hod.isPresent()) return hod.get().getHodName();
            
            Optional<Staff> staff = staffRepository.findByStaffCode(userId);
            if (staff.isPresent()) return staff.get().getStaffName();
            
            Optional<StaffMember> staffMember = staffMemberRepository.findByStaffCode(userId);
            if (staffMember.isPresent()) return staffMember.get().getStaffName() != null ? staffMember.get().getStaffName() : staffMember.get().getName();
            
            Optional<Student> student = studentRepository.findByRegNo(userId);
            if (student.isPresent()) return student.get().getFullName();
            
        } catch (Exception e) {
            // Ignore exception
        }
        return userId; // Fallback to ID
    }
    
    // Helper method to resolve person role/designation for history
    private String resolvePersonRole(String userId, String userType) {
        if (userId == null || userId.equals("null") || userId.isEmpty() || userId.equals("UNKNOWN")) return "";
        
        String detectedType = detectUserType(userId, userType);
        
        try {
            if ("HOD".equalsIgnoreCase(detectedType) || "HD".equalsIgnoreCase(detectedType)) {
                Optional<HOD> hod = hodRepository.findByHodCode(userId);
                if (hod.isPresent()) {
                    String dept = DepartmentMapper.toFullName(hod.get().getDepartment());
                    return "HOD of " + dept;
                }
            }
            
            if ("STAFF".equalsIgnoreCase(detectedType) || "SF".equalsIgnoreCase(detectedType) || "FACULTY".equalsIgnoreCase(detectedType)) {
                Optional<Staff> staff = staffRepository.findByStaffCode(userId);
                if (staff.isPresent()) {
                    String dept = DepartmentMapper.toFullName(staff.get().getDepartment());
                    return "Faculty - " + dept;
                }
                
                Optional<StaffMember> staffMember = staffMemberRepository.findByStaffCode(userId);
                if (staffMember.isPresent()) return staffMember.get().getRole() != null ? staffMember.get().getRole() : "Staff";
            }
            
            if ("STUDENT".equalsIgnoreCase(detectedType) || "ST".equalsIgnoreCase(detectedType)) {
                Optional<Student> student = studentRepository.findByRegNo(userId);
                if (student.isPresent()) return student.get().getYear() + " Year " + student.get().getDepartment();
            }
            
            if ("VISITOR".equalsIgnoreCase(detectedType) || "VG".equalsIgnoreCase(detectedType)) {
                return "Visitor";
            }
        } catch (Exception e) {
            // Ignore
        }
        return "";
    }
    
    // Helper to detect actual user type from userId pattern
    private String detectUserType(String userId, String storedType) {
        if (userId == null) return storedType != null ? storedType : "UNKNOWN";
        String upper = userId.toUpperCase();
        
        // Detect HOD codes: contain "HOD" in any position
        if (upper.contains("HOD")) return "HOD";
        
        // Detect Staff codes: contain "STAFF" or common staff prefixes
        if (upper.contains("STAFF")) return "STAFF";
        
        // Detect Visitors (usually short numeric IDs < 10 digits OR explicitly stored as VISITOR/VG)
        if ("VISITOR".equalsIgnoreCase(storedType) || "VG".equalsIgnoreCase(storedType)) return "VISITOR";
        if (upper.matches("\\d{1,9}")) return "VISITOR";
        
        // Numeric IDs (long registration numbers like 2117240030009) are likely students
        if (upper.matches("\\d{10,}")) return "STUDENT";
        
        // If stored type is available, use it
        if (storedType != null && !storedType.isEmpty()) return storedType;
        
        return "UNKNOWN";
    }

    // Scan History Endpoint - Grouped by person with status
    @GetMapping("/scan-history")
    public ResponseEntity<List<java.util.Map<String, Object>>> getScanHistory(
            @RequestParam(required = false, defaultValue = "200") Integer limit) {
        try {
            List<java.util.Map<String, Object>> scanHistory = new java.util.ArrayList<>();

            // ── Part 1: Entry table (RailwayEntry) ───────────────────────────────────
            List<RailwayEntry> allEntries = railwayEntryRepository.findAll();
            for (RailwayEntry entry : allEntries) {
                if (entry.getTimestamp() == null) continue;
                String uid   = entry.getUserId();
                String utype = entry.getUserType() != null ? entry.getUserType().toUpperCase() : "UNKNOWN";
                String name  = entry.getPersonName();

                // For visitors with legacy "null" userId, resolve via QR table passRequestId
                if (("VISITOR".equals(utype) || "VG".equals(utype)) && (uid == null || "null".equals(uid) || uid.isBlank())) {
                    if (entry.getQrId() != null) {
                        try {
                            Optional<QRTable> qrOpt = qrTableRepository.findById(entry.getQrId());
                            if (qrOpt.isPresent() && qrOpt.get().getPassRequestId() != null) {
                                uid = qrOpt.get().getPassRequestId().toString();
                            }
                        } catch (Exception ignored) {}
                    }
                }

                // For visitors: always do a fresh name lookup (stored personName may be stale "Visitor-null")
                if ("VISITOR".equals(utype) || "VG".equals(utype)) {
                    if (uid != null && !"null".equals(uid) && !uid.isBlank()) {
                        try {
                            Long visitorId = Long.parseLong(uid);
                            String freshName = visitorRepository.findById(visitorId).map(v -> v.getName()).orElse(null);
                            if (freshName != null) name = freshName;
                        } catch (Exception ignored) {}
                    }
                }

                if (name == null || name.isBlank()) name = lookupPersonName(uid, utype);

                java.util.Map<String, Object> rec = new java.util.HashMap<>();
                rec.put("id",          uid != null ? uid : "");
                rec.put("name",        name != null ? name : (uid != null && !"null".equals(uid) ? "Visitor-" + uid : "Visitor"));
                rec.put("type",        resolveDisplayType(uid, utype));
                rec.put("entryTime",   entry.getTimestamp().format(java.time.format.DateTimeFormatter.ISO_DATE_TIME));
                rec.put("exitTime",    null);
                rec.put("status",      "ENTERED");
                rec.put("isBulkPass",  false);
                rec.put("purpose",     "Gate Pass Entry");
                rec.put("reason",      "");
                if (entry.getDepartment() != null) rec.put("department", entry.getDepartment());
                scanHistory.add(rec);
            }

            // ── Part 2: Exit_logs table (RailwayExitLog) ─────────────────────────────
            List<RailwayExitLog> allExitLogs = railwayExitLogRepository.findAll();
            for (RailwayExitLog exitLog : allExitLogs) {
                if (exitLog.getExitTime() == null) continue;
                if (Boolean.FALSE.equals(exitLog.getAccessGranted())) continue;

                String uid   = exitLog.getUserId();
                String utype = exitLog.getUserType() != null ? exitLog.getUserType().toUpperCase() : "UNKNOWN";
                String name  = exitLog.getPersonName();

                // For visitors with legacy "null" userId, resolve via QR table passRequestId
                if (("VISITOR".equals(utype) || "VG".equals(utype)) && (uid == null || "null".equals(uid) || uid.isBlank())) {
                    if (exitLog.getQrId() != null) {
                        try {
                            Optional<QRTable> qrOpt = qrTableRepository.findById(exitLog.getQrId());
                            if (!qrOpt.isPresent()) {
                                // QR row deleted after exit — try to find by qrCode string
                                if (exitLog.getQrCode() != null) {
                                    String[] parts = exitLog.getQrCode().split("[|/]");
                                    if (parts.length >= 2 && !"null".equals(parts[1])) {
                                        uid = parts[1];
                                    }
                                }
                            } else {
                                Long passReqId = qrOpt.get().getPassRequestId();
                                if (passReqId != null) uid = passReqId.toString();
                            }
                        } catch (Exception ignored) {}
                    }
                    // Also try extracting from qrCode string directly
                    if ((uid == null || "null".equals(uid)) && exitLog.getQrCode() != null) {
                        String[] parts = exitLog.getQrCode().split("[|/]");
                        if (parts.length >= 2 && !"null".equals(parts[1])) {
                            uid = parts[1];
                        }
                    }
                }

                if (name == null || name.isBlank()) name = lookupPersonName(uid, utype);

                // For visitors: always do a fresh name lookup (stored personName may be stale "Visitor-null")
                if ("VISITOR".equals(utype) || "VG".equals(utype)) {
                    if (uid != null && !"null".equals(uid) && !uid.isBlank()) {
                        try {
                            Long visitorId = Long.parseLong(uid);
                            String freshName = visitorRepository.findById(visitorId).map(v -> v.getName()).orElse(null);
                            if (freshName != null) name = freshName;
                        } catch (Exception ignored) {}
                    }
                }

                // For visitors, also try looking up by passRequestId if name still null
                if ((name == null || name.isBlank()) && ("VISITOR".equals(utype) || "VG".equals(utype))) {
                    if (uid != null && !"null".equals(uid)) {
                        try {
                            Long visitorId = Long.parseLong(uid);
                            name = visitorRepository.findById(visitorId).map(v -> v.getName()).orElse(null);
                        } catch (Exception ignored) {}
                    }
                }

                String exitTimeStr = exitLog.getExitTime().format(java.time.format.DateTimeFormatter.ISO_DATE_TIME);

                // For visitors: find matching entry record to show both entry and exit times
                String entryTimeStr = null;
                if ("VISITOR".equals(utype) || "VG".equals(utype)) {
                    // Look for a matching entry in RailwayEntry by userId or by qrId
                    for (RailwayEntry entry : allEntries) {
                        String entryUid = entry.getUserId();
                        if (uid != null && uid.equals(entryUid)) {
                            entryTimeStr = entry.getTimestamp().format(java.time.format.DateTimeFormatter.ISO_DATE_TIME);
                            break;
                        }
                    }
                    // Also try via Visitor entity entryTime
                    if (entryTimeStr == null && uid != null && !"null".equals(uid)) {
                        try {
                            Long visitorId = Long.parseLong(uid);
                            Optional<Visitor> vOpt = visitorRepository.findById(visitorId);
                            if (vOpt.isPresent() && vOpt.get().getEntryTime() != null) {
                                entryTimeStr = vOpt.get().getEntryTime().format(java.time.format.DateTimeFormatter.ISO_DATE_TIME);
                            }
                        } catch (Exception ignored) {}
                    }
                }

                java.util.Map<String, Object> rec = new java.util.HashMap<>();
                rec.put("id",          uid != null ? uid : "");
                rec.put("name",        name != null ? name : (uid != null ? "Visitor-" + uid : "Visitor"));
                rec.put("type",        resolveDisplayType(uid, utype));
                rec.put("entryTime",   entryTimeStr != null ? entryTimeStr : exitTimeStr);
                rec.put("exitTime",    exitTimeStr);
                rec.put("status",      "EXITED");
                rec.put("isBulkPass",  false);
                rec.put("purpose",     exitLog.getPurpose() != null ? exitLog.getPurpose() : "Gate Pass Exit");
                rec.put("reason",      "");
                if (exitLog.getDepartment() != null) rec.put("department", exitLog.getDepartment());
                if (exitLog.getEmail()      != null) rec.put("email",      exitLog.getEmail());
                if (exitLog.getPhone()      != null) rec.put("phone",      exitLog.getPhone());
                scanHistory.add(rec);
            }

            // ── Deduplicate: for visitors with an exit record, remove the separate entry record ──
            // Build a set of visitor IDs that have an exit record
            java.util.Set<String> exitedVisitorIds = new java.util.HashSet<>();
            for (java.util.Map<String, Object> rec : scanHistory) {
                if ("EXITED".equals(rec.get("status")) && "VISITOR".equals(rec.get("type"))) {
                    String vid = (String) rec.get("id");
                    if (vid != null && !vid.isBlank()) exitedVisitorIds.add(vid);
                }
            }
            // Remove entry-only records for those visitor IDs (they are merged into the exit record)
            scanHistory.removeIf(rec ->
                "ENTERED".equals(rec.get("status")) &&
                "VISITOR".equals(rec.get("type")) &&
                exitedVisitorIds.contains(rec.get("id"))
            );

            // ── Sort newest first ─────────────────────────────────────────────────────
            scanHistory.sort((a, b) -> {
                String ta = (String) a.get("entryTime");
                String tb = (String) b.get("entryTime");
                if (ta == null && tb == null) return 0;
                if (ta == null) return 1;
                if (tb == null) return -1;
                return tb.compareTo(ta);
            });

            if (limit != null && limit > 0 && scanHistory.size() > limit) {
                scanHistory = scanHistory.subList(0, limit);
            }

            System.out.println("✅ scan-history: " + scanHistory.size() + " records (entries + exits)");
            return ResponseEntity.ok(scanHistory);
        } catch (Exception e) {
            System.err.println("Error fetching scan history: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }

    /** Look up a person's display name from student/staff tables by userId + userType */
    private String lookupPersonName(String userId, String userType) {
        if (userId == null || userId.isBlank()) return null;
        try {
            if ("STUDENT".equals(userType) || "ST".equals(userType)) {
                return studentRepository.findByRegNo(userId).map(s -> s.getFullName()).orElse(null);
            } else if ("STAFF".equals(userType) || "SF".equals(userType) || "HOD".equals(userType) || "HD".equals(userType)) {
                return staffRepository.findByStaffCode(userId).map(s -> s.getStaffName()).orElse(null);
            } else if ("VISITOR".equals(userType) || "VG".equals(userType)) {
                try {
                    Long visitorId = Long.parseLong(userId);
                    return visitorRepository.findById(visitorId).map(v -> v.getName()).orElse(null);
                } catch (NumberFormatException e) { /* ignore */ }
            }
        } catch (Exception e) { /* ignore */ }
        return null;
    }

    /** Resolve a clean display type label from userId + raw userType */
    private String resolveDisplayType(String userId, String userType) {
        if (userType == null) return "VISITOR";
        switch (userType.toUpperCase()) {
            case "ST": case "STUDENT": return "STUDENT";
            case "SF": case "STAFF":   return "STAFF";
            case "HD": case "HOD":     return "HOD";
            case "VG": case "VISITOR": return "VISITOR";
            default: return userType;
        }
    }
    
    // Helper method to parse group pass purpose field
    private java.util.Map<String, String> parseGroupPassPurpose(String purpose) {
        java.util.Map<String, String> result = new java.util.HashMap<>();
        
        try {
            // Format: TOKEN:xxx||INCHARGE:staffId:name||TYPE:description||TOTAL:count||STUDENTS:json||STAFF:json
            String[] parts = purpose.split("\\|\\|");
            
            for (String part : parts) {
                if (part.startsWith("INCHARGE:")) {
                    String inchargeData = part.substring(9); // Remove "INCHARGE:"
                    String[] inchargeParts = inchargeData.split(":", 2);
                    if (inchargeParts.length > 1) {
                        result.put("inchargeName", inchargeParts[1]);
                    }
                } else if (part.startsWith("TYPE:")) {
                    String type = part.substring(5); // Remove "TYPE:"
                    result.put("passSubtype", type.contains("Included") ? "SIG" : "SEG");
                } else if (part.startsWith("TOTAL:")) {
                    result.put("totalPersons", part.substring(6)); // Remove "TOTAL:"
                } else if (part.startsWith("STUDENTS:")) {
                    result.put("students", part.substring(9)); // Remove "STUDENTS:"
                } else if (part.startsWith("STAFF:")) {
                    result.put("staff", part.substring(6)); // Remove "STAFF:"
                }
            }
        } catch (Exception e) {
            System.err.println("Error parsing group pass purpose: " + e.getMessage());
        }
        
        return result;
    }
    
    // Helper method to parse group members from JSON string
    private java.util.List<java.util.Map<String, String>> parseGroupMembers(String jsonString, String memberType) {
        java.util.List<java.util.Map<String, String>> members = new java.util.ArrayList<>();
        
        try {
            // Format from GroupPassService: "2117240030007:Anto Jenishia A|2117240030008:Anushiya P|..."
            // This is NOT JSON, it's a pipe-separated list of id:name pairs
            if (jsonString != null && !jsonString.trim().isEmpty()) {
                String[] memberPairs = jsonString.split("\\|");
                
                for (String pair : memberPairs) {
                    String[] parts = pair.split(":", 2);
                    if (parts.length == 2) {
                        java.util.Map<String, String> member = new java.util.HashMap<>();
                        member.put("id", parts[0].trim());
                        member.put("name", parts[1].trim());
                        members.add(member);
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("Error parsing group members: " + e.getMessage());
        }
        
        return members;
    }
    
    // Get Entry/Exit History for Specific User
    @GetMapping("/entry-exit/user/{userId}/history")
    public ResponseEntity<List<java.util.Map<String, Object>>> getUserEntryHistory(@PathVariable String userId) {
        try {
            System.out.println("Fetching entry/exit history for user: " + userId);
            
            // Find all scans for this user (by studentId, facultyId, or regNo)
            List<ScanLog> userScans = scanLogRepository.findAll().stream()
                .filter(scan -> {
                    if (scan.getStudentId() != null && scan.getStudentId().equals(userId)) return true;
                    if (scan.getFacultyId() != null && scan.getFacultyId().equals(userId)) return true;
                    // Also check if the person name matches (for manual entries)
                    return false;
                })
                .filter(scan -> scan.getAccessGranted()) // Only granted access
                .sorted((a, b) -> b.getScanTime().compareTo(a.getScanTime())) // Newest first
                .collect(java.util.stream.Collectors.toList());
            
            List<java.util.Map<String, Object>> history = new java.util.ArrayList<>();
            
            for (ScanLog scan : userScans) {
                java.util.Map<String, Object> entry = new java.util.HashMap<>();
                entry.put("id", scan.getId());
                entry.put("qrCode", scan.getQrCode());
                entry.put("personName", scan.getPersonName());
                entry.put("personType", scan.getPersonType().toString());
                entry.put("purpose", scan.getPurpose() != null ? scan.getPurpose() : "General");
                entry.put("scanTime", scan.getScanTime().format(java.time.format.DateTimeFormatter.ISO_DATE_TIME));
                entry.put("scanLocation", scan.getScanLocation());
                entry.put("scannedBy", scan.getScannedBy());
                entry.put("accessGranted", scan.getAccessGranted());
                entry.put("status", scan.getStatus().toString());
                
                // Determine if entry or exit based on scan location
                String scanType = "ENTRY";
                if (scan.getScanLocation() != null && 
                    scan.getScanLocation().toLowerCase().contains("exit")) {
                    scanType = "EXIT";
                }
                entry.put("scanType", scanType);
                
                // Add user-specific fields
                if (scan.getStudentId() != null) {
                    entry.put("studentId", scan.getStudentId());
                    entry.put("regNo", scan.getStudentId());
                }
                if (scan.getFacultyId() != null) {
                    entry.put("facultyId", scan.getFacultyId());
                    entry.put("staffCode", scan.getFacultyId());
                }
                if (scan.getDepartment() != null) {
                    entry.put("department", scan.getDepartment());
                }
                
                history.add(entry);
            }
            
            System.out.println("Found " + history.size() + " entry/exit records for user: " + userId);
            return ResponseEntity.ok(history);
            
        } catch (Exception e) {
            System.err.println("Error fetching user entry history: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }
    
    // Record Scan Endpoint
    @PostMapping("/record-scan")
    public ResponseEntity<?> recordScan(@RequestBody java.util.Map<String, Object> scanData) {
        try {
            String scanLocation = (String) scanData.get("scanLocation");
            boolean isExit = scanLocation != null && scanLocation.toLowerCase().contains("exit");
            Object savedLog;

            if (isExit) {
                // Exits must be written to Exit_logs (RailwayExitLog).
                RailwayExitLog exitLog = new RailwayExitLog();
                exitLog.setQrCode((String) scanData.get("qrCode"));
                exitLog.setPersonName((String) scanData.get("personName"));
                exitLog.setPurpose((String) scanData.get("purpose"));
                exitLog.setVerifiedBy((String) scanData.get("scannedBy"));
                exitLog.setLocation(scanLocation);
                exitLog.setScanLocation(scanLocation);
                exitLog.setExitTime(LocalDateTime.now());
                exitLog.setAccessGranted("APPROVED".equals(scanData.get("status")));

                // Set required fields
                String userId = (String) scanData.get("userId");
                String rawUserType = (String) scanData.get("userType");
                exitLog.setUserId(userId != null ? userId : "UNKNOWN");

                // Map QR/scanner user types to Exit_logs.user_type values.
                String mappedUserType = rawUserType;
                if ("ST".equalsIgnoreCase(rawUserType) || "STUDENT".equalsIgnoreCase(rawUserType)) {
                    mappedUserType = "STUDENT";
                } else if ("SF".equalsIgnoreCase(rawUserType) || "STAFF".equalsIgnoreCase(rawUserType)) {
                    mappedUserType = "STAFF";
                } else if ("HD".equalsIgnoreCase(rawUserType) || "HOD".equalsIgnoreCase(rawUserType)) {
                    mappedUserType = "HOD";
                } else if ("VG".equalsIgnoreCase(rawUserType) || "VISITOR".equalsIgnoreCase(rawUserType)) {
                    mappedUserType = "VISITOR";
                }
                exitLog.setUserType(mappedUserType != null ? mappedUserType : "VISITOR");

                // Best-effort optional fields
                if (scanData.get("department") != null) {
                    exitLog.setDepartment((String) scanData.get("department"));
                }
                if (scanData.get("email") != null) {
                    exitLog.setEmail((String) scanData.get("email"));
                }
                if (scanData.get("phone") != null) {
                    exitLog.setPhone((String) scanData.get("phone"));
                }

                railwayExitLogRepository.save(exitLog);
                savedLog = exitLog;
                System.out.println("Exit recorded: " + exitLog.getPersonName() + " - " + exitLog.getScanLocation());
            } else {
                // Entry must be stored in Entry table (ScanLog).
                ScanLog scanLog = new ScanLog();
                scanLog.setQrCode((String) scanData.get("qrCode"));
                scanLog.setPersonName((String) scanData.get("personName"));
                scanLog.setPersonType(PersonType.valueOf((String) scanData.get("personType")));
                scanLog.setPurpose((String) scanData.get("purpose"));
                scanLog.setStatus(ApprovalStatus.valueOf((String) scanData.get("status")));
                scanLog.setScanLocation(scanLocation);
                scanLog.setScannedBy((String) scanData.get("scannedBy"));
                scanLog.setAccessGranted("APPROVED".equals(scanData.get("status")));

                // Set required fields
                String userId = (String) scanData.get("userId");
                String userType = (String) scanData.get("userType");
                scanLog.setUserId(userId != null ? userId : "UNKNOWN");
                scanLog.setUserType(userType != null ? userType : "VISITOR");

                // Set optional fields
                if (scanData.get("studentId") != null) {
                    scanLog.setStudentId((String) scanData.get("studentId"));
                }
                if (scanData.get("facultyId") != null) {
                    scanLog.setFacultyId((String) scanData.get("facultyId"));
                }

                ScanLog savedScan = scanLogRepository.save(scanLog);
                savedLog = savedScan;
                System.out.println("Entry recorded: " + savedScan.getPersonName() + " - " + savedScan.getScanLocation());
            }
            
            // Create notification for security personnel
            String securityId = (String) scanData.get("securityId");
            if (securityId != null) {
                String notificationType = (scanLocation != null && scanLocation.toLowerCase().contains("exit")) ? "EXIT" : "ENTRY";
                String message = String.format("%s %s has %s the premises at %s", 
                    scanData.get("personType"), 
                    scanData.get("personName"),
                    notificationType.equals("ENTRY") ? "entered" : "exited",
                    scanLocation);
                
                notificationService.createVisitorNotification(
                    securityId, 
                    notificationType, 
                    message,
                    (String) scanData.get("personName"),
                    (String) scanData.get("personType")
                );
                System.out.println("Notification created for security: " + securityId);
            }
            
            return ResponseEntity.ok(savedLog);
        } catch (Exception e) {
            System.err.println("Error recording scan: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }
    
    // Notification Endpoints
    @GetMapping("/notifications/{securityId}")
    public ResponseEntity<List<Notification>> getNotifications(@PathVariable String securityId) {
        try {
            List<Notification> notifications = notificationService.getNotificationsBySecurityId(securityId);
            System.out.println("Fetched " + notifications.size() + " notifications for security: " + securityId);
            return ResponseEntity.ok(notifications);
        } catch (Exception e) {
            System.err.println("Error fetching notifications: " + e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }
    
    @PostMapping("/notifications/{securityId}/mark-all-read")
    public ResponseEntity<?> markNotificationsAsRead(@PathVariable String securityId) {
        try {
            notificationService.markAllAsRead(securityId);
            System.out.println("Marked all notifications as read for security: " + securityId);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            System.err.println("Error marking notifications as read: " + e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }
    
    @GetMapping("/notifications/{securityId}/unread-count")
    public ResponseEntity<Long> getUnreadCount(@PathVariable String securityId) {
        try {
            long count = notificationService.getUnreadCount(securityId);
            return ResponseEntity.ok(count);
        } catch (Exception e) {
            System.err.println("Error getting unread count: " + e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }
    
    @PostMapping("/notification/{notificationId}/mark-read")
    public ResponseEntity<?> markNotificationAsRead(@PathVariable Long notificationId) {
        try {
            notificationService.markAsRead(notificationId);
            System.out.println("Marked notification as read: " + notificationId);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            System.err.println("Error marking notification as read: " + e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }
    
    // Group Pass QR Generation
    @PostMapping("/generate-group-pass")
    public ResponseEntity<?> generateGroupPass(@RequestBody com.example.visitor.service.GroupPassQRGenerationService.GroupPassRequest request) {
        try {
            System.out.println("Generating Group Pass QR for incharge: " + request.getInchargeStaffId());
            
            java.util.Map<String, Object> result = groupPassQRGenerationService.generateGroupPassQR(request);
            
            if (Boolean.TRUE.equals(result.get("success"))) {
                return ResponseEntity.ok(result);
            } else {
                return ResponseEntity.badRequest().body(result);
            }
            
        } catch (Exception e) {
            System.err.println("Error generating group pass: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError()
                    .body(java.util.Map.of("error", "Failed to generate group pass: " + e.getMessage()));
        }
    }
    
    // Single Pass QR Validation (SF|, ST|, VG|)
    @PostMapping("/validate-single-pass")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> validateSinglePass(@RequestBody java.util.Map<String, String> request) {
        try {
            String qrCode = request.get("qrCode");
            String type = request.get("type");
            String userId = request.get("userId");
            String token = request.get("token");
            String scannedBy = request.get("scannedBy");
            
            if (qrCode == null || qrCode.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(java.util.Map.of(
                    "status", "INVALID",
                    "message", "QR code is required"
                ));
            }
            
            System.out.println("🔍 Validating Single Pass QR: " + qrCode);
            System.out.println("   Type: " + type + ", User ID: " + userId + ", Token: " + token);
            
            // Step 1: Find QR code in qr_table by token (qr_code column stores just the token)
            Optional<QRTable> qrTableOpt = qrTableRepository.findByQrCode(token);
            
            if (!qrTableOpt.isPresent()) {
                System.out.println("❌ QR code not found in qr_table: " + token);
                return ResponseEntity.status(403).body(java.util.Map.of(
                    "status", "INVALID",
                    "message", "QR code not found or already used"
                ));
            }
            
            QRTable qrTable = qrTableOpt.get();
            
            // Step 2: Verify user_type and user_id match
            if (!type.equals(qrTable.getUserType())) {
                System.out.println("❌ User type mismatch: Expected " + qrTable.getUserType() + ", got " + type);
                return ResponseEntity.status(403).body(java.util.Map.of(
                    "status", "INVALID",
                    "message", "QR code user type does not match"
                ));
            }
            
            if (!userId.equals(qrTable.getUserId())) {
                System.out.println("❌ User ID mismatch: Expected " + qrTable.getUserId() + ", got " + userId);
                return ResponseEntity.status(403).body(java.util.Map.of(
                    "status", "INVALID",
                    "message", "QR code user ID does not match"
                ));
            }
            
            // Step 3: Validate based on user type
            boolean shouldSaveEntryLog = false;
            boolean shouldCreateExitLog = false;
            String exitUserType = null; // Exit_logs.user_type
            LocalDateTime exitTime = LocalDateTime.now();
            Long qrIdForExit = null;
            String scanLocation = "Exit Gate";
            
            if ("SF".equals(type) || "ST".equals(type) || "HD".equals(type)) {
                // Staff/Student: Only use exit column, entry should be null
                if (qrTable.getEntry() != null) {
                    System.out.println("❌ Invalid: SF/ST should not have entry value");
                    return ResponseEntity.status(403).body(java.util.Map.of(
                        "status", "INVALID",
                        "message", "Invalid QR configuration for staff/student"
                    ));
                }
                
                // Check if token matches exit column
                if (token != null && token.equals(qrTable.getExit())) {
                    shouldCreateExitLog = true;
                    qrIdForExit = qrTable.getId();
                    exitUserType = "ST".equals(type) ? "STUDENT" : ("SF".equals(type) ? "STAFF" : "HOD");
                    // Delete the row from qr_table
                    qrTableRepository.delete(qrTable);
                    System.out.println("✅ EXIT APPROVED (SF/ST/HD) - Deleted row for token: " + token);
                } else {
                    System.out.println("❌ Token does not match exit column. Expected: " + qrTable.getExit() + ", Got: " + token);
                    return ResponseEntity.status(403).body(java.util.Map.of(
                        "status", "INVALID",
                        "message", "QR code does not match exit record"
                    ));
                }
                
            } else if ("VG".equals(type)) {
                // Visitor: Use entry → exit flow
                if (qrTable.getEntry() != null && qrTable.getExit() == null) {
                    // First scan (Entry)
                    if (token != null && token.equals(qrTable.getEntry())) {
                        shouldSaveEntryLog = true;
                        scanLocation = "Entry Gate";
                        // Move token from entry to exit
                        qrTable.setExit(qrTable.getEntry());
                        qrTable.setEntry(null);
                        qrTableRepository.save(qrTable);
                        System.out.println("✅ VG ENTRY APPROVED - Moved token to exit: " + qrCode);

                        // Backfill visitor entry time for consistency with scanQrCodeInternal.
                        try {
                            Long visitorId = Long.parseLong(userId);
                            Optional<Visitor> visitorOpt = visitorRepository.findById(visitorId);
                            if (visitorOpt.isPresent()) {
                                Visitor v = visitorOpt.get();
                                v.setEntryTime(LocalDateTime.now());
                                v.setScanCount(1);
                                visitorRepository.save(v);
                            }
                        } catch (Exception ignored) {}
                    } else {
                        System.out.println("❌ Token does not match entry column");
                        return ResponseEntity.status(403).body(java.util.Map.of(
                            "status", "INVALID",
                            "message", "QR code does not match entry record"
                        ));
                    }
                } else if (qrTable.getEntry() == null && qrTable.getExit() != null) {
                    // Second scan (Exit)
                    if (token != null && token.equals(qrTable.getExit())) {
                        shouldCreateExitLog = true;
                        qrIdForExit = qrTable.getId();
                        exitUserType = "VISITOR";
                        scanLocation = "Exit Gate";
                        // Delete the row from qr_table
                        // Backfill visitor exit time for consistency with scanQrCodeInternal.
                        try {
                            Long visitorId = Long.parseLong(userId);
                            Optional<Visitor> visitorOpt = visitorRepository.findById(visitorId);
                            if (visitorOpt.isPresent()) {
                                Visitor v = visitorOpt.get();
                                v.setExitTime(LocalDateTime.now());
                                v.setScanCount(2);
                                visitorRepository.save(v);
                            }
                        } catch (Exception ignored) {}

                        qrTableRepository.delete(qrTable);
                        System.out.println("✅ VG EXIT APPROVED - Deleted row: " + qrCode);
                    } else {
                        System.out.println("❌ Token does not match exit column");
                        return ResponseEntity.status(403).body(java.util.Map.of(
                            "status", "INVALID",
                            "message", "QR code does not match exit record"
                        ));
                    }
                } else {
                    System.out.println("❌ Invalid VG state");
                    return ResponseEntity.status(403).body(java.util.Map.of(
                        "status", "INVALID",
                        "message", "Invalid visitor QR state"
                    ));
                }
            }
            
            // Step 3: Fetch user details
            java.util.Map<String, Object> result = new java.util.HashMap<>();
            result.put("status", "VALID");
            result.put("qrCode", qrCode);
            result.put("scanLocation", scanLocation);
            
            String personName = "User ID: " + userId;
            String department = null;
            String email = null;
            String phone = null;
            PersonType personType;
            
            if ("ST".equals(type)) {
                personType = PersonType.STUDENT;
                Optional<Student> student = studentRepository.findByRegNo(userId);
                if (student.isPresent()) {
                    Student s = student.get();
                    personName = s.getFullName();
                    department = s.getDepartment();
                    email = s.getEmail();
                    phone = s.getPhone();
                    result.put("year", s.getYear());
                    result.put("regNo", s.getRegNo());
                }
            } else if ("SF".equals(type)) {
                personType = PersonType.FACULTY;
                Optional<Staff> staff = staffRepository.findByStaffCode(userId);
                if (staff.isPresent()) {
                    Staff st = staff.get();
                    personName = st.getStaffName();
                    department = st.getDepartment();
                    email = st.getEmail();
                    phone = st.getPhone();
                    result.put("staffCode", st.getStaffCode());
                }
            } else if ("HD".equals(type)) {
                personType = PersonType.FACULTY;
                Optional<HOD> hod = hodRepository.findByHodCode(userId);
                if (hod.isPresent()) {
                    HOD h = hod.get();
                    personName = h.getHodName();
                    department = h.getDepartment();
                    email = h.getEmail();
                    phone = h.getPhone();
                    result.put("staffCode", h.getHodCode());
                } else {
                    personName = "HOD - " + userId;
                }
            } else {
                personType = PersonType.VISITOR;
                try {
                    Long visitorId = Long.parseLong(userId);
                    Optional<Visitor> visitorOpt = visitorRepository.findById(visitorId);
                    if (visitorOpt.isPresent()) {
                        Visitor v = visitorOpt.get();
                        personName = v.getName();
                        department = v.getDepartment();
                        email = v.getEmail();
                        phone = v.getPhone();
                    } else {
                        personName = "Visitor - " + userId;
                    }
                } catch (Exception e) {
                    personName = "Visitor - " + userId;
                }
            }
            
            result.put("name", personName);
            result.put("type", personType.toString());
            result.put("department", department);
            result.put("email", email);
            result.put("phone", phone);
            
            // Step 4: Write to the correct history table
            if (shouldSaveEntryLog) {
                // Visitor entry — stored in Entry table (ScanLog) so they appear in active-persons
                ScanLog scanLog = new ScanLog();
                scanLog.setQrCode(qrCode);
                scanLog.setPersonName(personName);
                scanLog.setPersonType(personType);
                scanLog.setStatus(ApprovalStatus.APPROVED);
                scanLog.setAccessGranted(true);
                scanLog.setScannedBy(scannedBy != null ? scannedBy : "Security Guard");
                scanLog.setScanLocation(scanLocation);
                scanLog.setDepartment(department);
                scanLog.setEmail(email);
                scanLog.setPhone(phone);
                scanLog.setUserId(userId);
                scanLog.setUserType(type);
                scanLog.setQrId(qrTable.getId());
                scanLogRepository.save(scanLog);

            } else if (shouldCreateExitLog) {
                // Exit — stored in Exit_logs table (RailwayExitLog) for history
                RailwayExitLog exitLog = new RailwayExitLog();
                exitLog.setQrId(qrIdForExit != null ? qrIdForExit : qrTable.getId());
                exitLog.setUserId(userId);
                exitLog.setUserType(exitUserType);
                exitLog.setExitTime(exitTime);
                exitLog.setVerifiedBy(scannedBy != null ? scannedBy : "Security Guard");
                exitLog.setLocation(scanLocation);
                exitLog.setPersonName(personName);
                exitLog.setDepartment(department);
                exitLog.setEmail(email);
                exitLog.setPhone(phone);
                exitLog.setQrCode(qrCode);
                exitLog.setScanLocation(scanLocation);
                exitLog.setAccessGranted(true);
                railwayExitLogRepository.save(exitLog);

                // For visitors: also write an exit ScanLog row so they are removed from active-persons
                if ("VISITOR".equals(exitUserType)) {
                    ScanLog exitScan = new ScanLog();
                    exitScan.setPersonName(personName);
                    exitScan.setUserType("VISITOR");
                    exitScan.setScanLocation("Exit Gate");
                    exitScan.setScannedBy(scannedBy != null ? scannedBy : "Security Guard");
                    exitScan.setTimestamp(exitTime);
                    exitScan.setUserId(userId);
                    exitScan.setDepartment(department);
                    exitScan.setAccessGranted(true);
                    scanLogRepository.save(exitScan);
                }
            }
            
            System.out.println("✅ Single Pass validated successfully for: " + personName);
            return ResponseEntity.ok(result);
            
        } catch (Exception e) {
            System.err.println("Error validating single pass: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError()
                    .body(java.util.Map.of("error", "Failed to validate single pass: " + e.getMessage()));
        }
    }
    
    // Group Pass QR Scanning
    @PostMapping("/scan-group-pass")
    public ResponseEntity<?> scanGroupPass(@RequestBody java.util.Map<String, String> request) {
        try {
            String qrData = request.get("qrData");
            String scannedBy = request.get("scannedBy");
            
            if (qrData == null || qrData.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(java.util.Map.of("error", "QR data is required"));
            }
            
            System.out.println("Processing Group Pass QR: " + qrData);
            
            java.util.Map<String, Object> result = groupPassService.processGroupPassQR(qrData, scannedBy);
            
            if ("VALID".equals(result.get("status"))) {
                return ResponseEntity.ok(result);
            } else {
                return ResponseEntity.badRequest().body(result);
            }
            
        } catch (Exception e) {
            System.err.println("Error scanning group pass: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError()
                    .body(java.util.Map.of("error", "Failed to process group pass: " + e.getMessage()));
        }
    }
    
    // Delete All Scan History
    @DeleteMapping("/scan-history")
    public ResponseEntity<?> deleteAllScanHistory() {
        try {
            scanLogRepository.deleteAll();
            System.out.println("Deleted all scan history records");
            return ResponseEntity.ok(java.util.Map.of("message", "All scan history deleted successfully"));
        } catch (Exception e) {
            System.err.println("Error deleting scan history: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError()
                    .body(java.util.Map.of("error", "Failed to delete scan history"));
        }
    }
    
    // Delete All Vehicle History
    @DeleteMapping("/vehicles")
    public ResponseEntity<?> deleteAllVehicleHistory() {
        try {
            vehicleRegistrationRepository.deleteAll();
            System.out.println("Deleted all vehicle history records");
            return ResponseEntity.ok(java.util.Map.of("message", "All vehicle history deleted successfully"));
        } catch (Exception e) {
            System.err.println("Error deleting vehicle history: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError()
                    .body(java.util.Map.of("error", "Failed to delete vehicle history"));
        }
    }
    
    // Manual Exit Endpoint - Record exit manually for a visitor (when exit QR scan was missed)
    @PostMapping("/manual-exit")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> recordManualExit(@RequestBody java.util.Map<String, Object> request) {
        try {
            String personName = (String) request.get("personName");
            String scannedBy  = (String) request.get("scannedBy");

            if (personName == null || personName.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(java.util.Map.of(
                    "status", "ERROR",
                    "message", "Person name is required"
                ));
            }

            System.out.println("🚪 Manual exit for visitor: " + personName);

            // ── Step 1: Find the visitor's most recent ScanLog entry ──────────────────
            List<ScanLog> personEntries = scanLogRepository.findAll().stream()
                .filter(s -> personName.equalsIgnoreCase(s.getPersonName()))
                .filter(s -> s.getTimestamp() != null)
                .sorted((a, b) -> b.getTimestamp().compareTo(a.getTimestamp()))
                .collect(java.util.stream.Collectors.toList());

            if (personEntries.isEmpty()) {
                return ResponseEntity.status(404).body(java.util.Map.of(
                    "status", "ERROR",
                    "message", "No entry record found for: " + personName
                ));
            }

            // Check if already exited
            ScanLog lastScan = personEntries.get(0);
            if (lastScan.getScanLocation() != null &&
                lastScan.getScanLocation().toLowerCase().contains("exit")) {
                return ResponseEntity.badRequest().body(java.util.Map.of(
                    "status", "ERROR",
                    "message", personName + " has already exited"
                ));
            }

            java.time.LocalDateTime exitTime = java.time.LocalDateTime.now();
            ScanLog entryScan = personEntries.get(personEntries.size() - 1); // oldest = entry

            // ── Step 2: Write exit ScanLog row so active-persons removes this visitor ──
            ScanLog exitScan = new ScanLog();
            exitScan.setPersonName(personName);
            exitScan.setUserType("VISITOR");
            exitScan.setScanLocation("Exit Gate (Manual)");
            exitScan.setScannedBy(scannedBy != null ? scannedBy : "Security Guard (Manual)");
            exitScan.setTimestamp(exitTime);
            exitScan.setUserId(entryScan.getUserId() != null ? entryScan.getUserId() : personName);
            exitScan.setDepartment(entryScan.getDepartment());
            exitScan.setAccessGranted(true);
            scanLogRepository.save(exitScan);

            // ── Step 3: Write RailwayExitLog so it appears in scan history ────────────
            String visitorUserId = entryScan.getUserId();
            String department    = entryScan.getDepartment();
            String purpose       = "Manual Exit";
            String qrCodeStr     = null;

            // Also update the Visitor entity exit time if found
            try {
                List<Visitor> visitors = visitorRepository.findAll().stream()
                    .filter(v -> v.getName() != null && v.getName().equalsIgnoreCase(personName.trim()))
                    .filter(v -> v.getExitTime() == null)
                    .collect(java.util.stream.Collectors.toList());
                if (!visitors.isEmpty()) {
                    Visitor v = visitors.get(0);
                    v.setExitTime(exitTime);
                    v.setScanCount(2);
                    visitorRepository.save(v);
                    visitorUserId = v.getId().toString();
                    if (v.getDepartment() != null) department = v.getDepartment();
                    if (v.getPurpose()    != null) purpose    = v.getPurpose();
                    qrCodeStr = v.getQrCode();
                    // Clean up QR table entry
                    try {
                        if (qrCodeStr != null) {
                            String[] parts = qrCodeStr.split("\\|");
                            if (parts.length >= 3) {
                                qrTableRepository.findByQrCode(parts[2]).ifPresent(qrTableRepository::delete);
                            }
                        }
                    } catch (Exception ignored) {}
                }
            } catch (Exception e) {
                System.err.println("⚠️ Could not update Visitor entity: " + e.getMessage());
            }

            RailwayExitLog exitLog = new RailwayExitLog();
            exitLog.setUserId(visitorUserId);
            exitLog.setUserType("VISITOR");
            exitLog.setExitTime(exitTime);
            exitLog.setVerifiedBy(scannedBy != null ? scannedBy : "Security Guard (Manual)");
            exitLog.setLocation("Exit Gate (Manual)");
            exitLog.setPersonName(personName);
            exitLog.setDepartment(department);
            exitLog.setPurpose(purpose);
            exitLog.setQrCode(qrCodeStr);
            exitLog.setScanLocation("Exit Gate (Manual)");
            exitLog.setAccessGranted(true);
            railwayExitLogRepository.save(exitLog);
            System.out.println("✅ Manual exit recorded for visitor: " + personName);

            java.util.Map<String, Object> resp = new java.util.HashMap<>();
            resp.put("status", "SUCCESS");
            resp.put("message", "Manual exit recorded successfully");
            resp.put("personName", personName);
            resp.put("exitTime", exitTime.format(java.time.format.DateTimeFormatter.ISO_DATE_TIME));
            return ResponseEntity.ok(resp);

        } catch (Exception e) {
            System.err.println("❌ Error recording manual exit: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(java.util.Map.of(
                "status", "ERROR",
                "message", "Failed to record manual exit: " + e.getMessage()
            ));
        }
    }


    // Dashboard Stats Endpoint — active visitors + today's exits
    @GetMapping("/stats")
    public ResponseEntity<?> getDashboardStats() {
        try {
            // Active = visitors whose last ScanLog is NOT an exit
            List<ScanLog> allScans = scanLogRepository.findAll();
            java.util.Map<String, java.util.List<ScanLog>> byPerson = new java.util.HashMap<>();
            for (ScanLog s : allScans) {
                String key = s.getPersonName();
                if (key == null || key.isBlank()) continue;
                String utype = s.getUserType() != null ? s.getUserType().toUpperCase() : "";
                if (!"VISITOR".equals(utype) && !"VG".equals(utype)) continue;
                if (s.getTimestamp() == null) continue;
                byPerson.computeIfAbsent(key, k -> new java.util.ArrayList<>()).add(s);
            }
            long active = byPerson.values().stream().filter(scans -> {
                scans.sort((a, b) -> a.getTimestamp().compareTo(b.getTimestamp()));
                ScanLog last = scans.get(scans.size() - 1);
                return last.getScanLocation() == null || !last.getScanLocation().toLowerCase().contains("exit");
            }).count();

            // Exited today = RailwayExitLog rows with exitTime today and VISITOR type
            java.time.LocalDate today = java.time.LocalDate.now();
            long exited = railwayExitLogRepository.findAll().stream()
                .filter(e -> e.getExitTime() != null && e.getExitTime().toLocalDate().equals(today))
                .filter(e -> {
                    String ut = e.getUserType() != null ? e.getUserType().toUpperCase() : "";
                    return "VISITOR".equals(ut) || "VG".equals(ut);
                })
                .filter(e -> Boolean.TRUE.equals(e.getAccessGranted()))
                .count();

            // Total today = visitors who entered today (first ScanLog today) + those who exited today
            java.util.Set<String> todayNames = new java.util.HashSet<>();
            for (java.util.List<ScanLog> scans : byPerson.values()) {
                ScanLog first = scans.get(0);
                if (first.getTimestamp().toLocalDate().equals(today)) {
                    todayNames.add(first.getPersonName());
                }
            }
            // Also add exited visitors from today
            railwayExitLogRepository.findAll().stream()
                .filter(e -> e.getExitTime() != null && e.getExitTime().toLocalDate().equals(today))
                .filter(e -> e.getPersonName() != null)
                .forEach(e -> todayNames.add(e.getPersonName()));

            java.util.Map<String, Object> stats = new java.util.HashMap<>();
            stats.put("active", active);
            stats.put("exited", exited);
            stats.put("total", todayNames.size());
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            System.err.println("Error fetching stats: " + e.getMessage());
            return ResponseEntity.internalServerError().body(java.util.Map.of("error", e.getMessage()));
        }
    }

    // ==================== SECURITY PROFILE ENDPOINTS ====================

    // Get Security profile by security ID
    @GetMapping("/{securityId}")
    public ResponseEntity<?> getSecurityProfile(@PathVariable String securityId) {
        try {
            System.out.println("📋 Fetching security profile for: " + securityId);

            Optional<com.example.visitor.entity.SecurityPersonnel> securityOpt =
                securityPersonnelRepository.findBySecurityId(securityId);

            if (!securityOpt.isPresent()) {
                System.err.println("❌ Security personnel not found: " + securityId);
                return ResponseEntity.notFound().build();
            }

            com.example.visitor.entity.SecurityPersonnel security = securityOpt.get();
            java.util.Map<String, Object> securityDTO = new java.util.HashMap<>();
            securityDTO.put("id", security.getId());
            securityDTO.put("securityId", security.getSecurityId());
            securityDTO.put("name", security.getName());
            securityDTO.put("email", security.getEmail());
            securityDTO.put("phone", security.getPhone());
            securityDTO.put("gateAssignment", security.getGateAssignment());
            securityDTO.put("shift", security.getShift());
            securityDTO.put("isActive", security.getIsActive());

            System.out.println("✅ Found security: " + security.getName());
            return ResponseEntity.ok(securityDTO);

        } catch (Exception e) {
            System.err.println("❌ Error fetching security profile: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }

    // Get recent scans (last 50 scans)
    @GetMapping("/recent-scans")
    public ResponseEntity<List<java.util.Map<String, Object>>> getRecentScans(
            @RequestParam(required = false, defaultValue = "50") Integer limit) {
        try {
            List<ScanLog> allScans = scanLogRepository.findAll();

            // Filter valid scans and sort by scan time/timestamp (newest first)
            List<ScanLog> recentScans = allScans.stream()
                .filter(scan -> scan.getAccessGranted() && (scan.getScanTime() != null || scan.getTimestamp() != null))
                .sorted((a, b) -> {
                    LocalDateTime timeA = a.getScanTime() != null ? a.getScanTime() : a.getTimestamp();
                    LocalDateTime timeB = b.getScanTime() != null ? b.getScanTime() : b.getTimestamp();
                    return timeB.compareTo(timeA);
                })
                .limit(limit)
                .collect(Collectors.toList());

            List<java.util.Map<String, Object>> scanList = new java.util.ArrayList<>();

            for (ScanLog scan : recentScans) {
                java.util.Map<String, Object> scanData = new java.util.HashMap<>();
                scanData.put("id", scan.getId());
                scanData.put("qrCode", scan.getQrCode());
                
                String userId = scan.getStudentId() != null ? scan.getStudentId() : 
                               (scan.getFacultyId() != null ? scan.getFacultyId() : scan.getUserId());
                String userType = scan.getPersonType() != null ? scan.getPersonType().toString() : scan.getUserType();
                
                String name = resolvePersonName(userId, userType, scan.getPersonName());
                scanData.put("personName", name);
                
                scanData.put("personType", scan.getPersonType() != null ? scan.getPersonType().toString() : 
                                           (scan.getUserType() != null ? scan.getUserType() : "UNKNOWN"));
                scanData.put("purpose", scan.getPurpose() != null ? scan.getPurpose() : "General");
                
                LocalDateTime scanT = scan.getScanTime() != null ? scan.getScanTime() : scan.getTimestamp();
                scanData.put("scanTime", scanT.format(java.time.format.DateTimeFormatter.ISO_DATE_TIME));
                
                scanData.put("scanLocation", scan.getScanLocation());
                scanData.put("scannedBy", scan.getScannedBy());
                scanData.put("accessGranted", scan.getAccessGranted());
                scanData.put("status", scan.getStatus() != null ? scan.getStatus().toString() : "APPROVED");

                // Determine scan type
                String scanType = "ENTRY";
                if (scan.getScanLocation() != null &&
                    scan.getScanLocation().toLowerCase().contains("exit")) {
                    scanType = "EXIT";
                }
                scanData.put("scanType", scanType);

                // Add detailed info
                if (scan.getDepartment() != null) {
                    scanData.put("department", scan.getDepartment());
                }
                if (scan.getEmail() != null) {
                    scanData.put("email", scan.getEmail());
                }
                if (scan.getPhone() != null) {
                    scanData.put("phone", scan.getPhone());
                }
                if (scan.getStudentId() != null) {
                    scanData.put("studentId", scan.getStudentId());
                    scanData.put("regNo", scan.getStudentId());
                }
                if (scan.getFacultyId() != null) {
                    scanData.put("facultyId", scan.getFacultyId());
                    scanData.put("staffCode", scan.getFacultyId());
                }

                scanList.add(scanData);
            }

            System.out.println("Fetched " + scanList.size() + " recent scans (limit: " + limit + ")");
            return ResponseEntity.ok(scanList);

        } catch (Exception e) {
            System.err.println("Error fetching recent scans: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }

    // ==================== ESCALATED VISITOR REQUESTS ====================
    
    /**
     * Get all escalated visitor requests.
     * Also auto-escalates any PENDING visitors that have been waiting 5+ minutes
     * (in case the scheduler hasn't fired yet).
     */
    // ── Dev helper: force-escalate specific visitors immediately ─────────────
    @PostMapping("/dev/force-escalate/{visitorId}")
    public ResponseEntity<?> forceEscalate(@PathVariable Long visitorId) {
        try {
            Optional<Visitor> opt = visitorRepository.findById(visitorId);
            if (opt.isEmpty()) return ResponseEntity.badRequest().body("Visitor not found");
            Visitor v = opt.get();
            v.setNotificationSentAt(java.time.LocalDateTime.now().minusMinutes(10));
            visitorRepository.save(v);
            return ResponseEntity.ok("Force-escalated visitor: " + v.getName());
        } catch (Exception e) { return ResponseEntity.internalServerError().body(e.getMessage()); }
    }

    @GetMapping("/escalated-visitors")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> getEscalatedVisitors() {
        try {
            java.time.LocalDateTime fiveMinutesAgo = java.time.LocalDateTime.now().minusMinutes(5);

            // Auto-escalate any pending visitors that have timed out but weren't marked yet
            // Use notificationSentAt if set, otherwise fall back to createdAt
            List<Visitor> toEscalate = visitorRepository.findAll().stream()
                .filter(v -> "PENDING".equals(v.getStatus()))
                .filter(v -> {
                    java.time.LocalDateTime ref = v.getNotificationSentAt() != null
                        ? v.getNotificationSentAt()
                        : v.getCreatedAt();
                    return ref != null && ref.isBefore(fiveMinutesAgo);
                })
                .filter(v -> v.getEscalatedToSecurity() == null || !v.getEscalatedToSecurity())
                .collect(Collectors.toList());

            for (Visitor v : toEscalate) {
                v.setEscalatedToSecurity(true);
                v.setEscalationTime(java.time.LocalDateTime.now());
                visitorRepository.save(v);
                System.out.println("✅ On-demand escalated visitor: " + v.getName());
                // Notify the security who registered this visitor that it has been escalated
                try {
                    String registeredBy = v.getRegisteredBy();
                    if (registeredBy != null && !registeredBy.isBlank()) {
                        notificationService.createUserNotification(
                            registeredBy,
                            "Visitor Request Escalated",
                            "Visitor " + v.getName() + " was not approved by staff. Please review and take action.",
                            "GATE_PASS",
                            "HIGH"
                        );
                    }
                } catch (Exception notifEx) {
                    System.err.println("⚠️ Escalation notification failed (non-fatal): " + notifEx.getMessage());
                }
            }

            // Now return all escalated PENDING visitors
            List<Visitor> escalatedVisitors = visitorRepository.findAll().stream()
                .filter(v -> "PENDING".equals(v.getStatus()))
                .filter(v -> Boolean.TRUE.equals(v.getEscalatedToSecurity()))
                .collect(Collectors.toList());

            System.out.println("Found " + escalatedVisitors.size() + " escalated visitor requests");
            return ResponseEntity.ok(escalatedVisitors);
        } catch (Exception e) {
            System.err.println("Error fetching escalated visitors: " + e.getMessage());
            return ResponseEntity.internalServerError().body("Error fetching escalated visitors");
        }
    }
    
    /**
     * Security approves an escalated visitor request
     */
    @PostMapping("/escalated-visitors/{visitorId}/approve")
    public ResponseEntity<?> approveEscalatedVisitor(
            @PathVariable Long visitorId,
            @RequestBody(required = false) java.util.Map<String, String> body,
            @RequestParam(required = false) String securityId) {
        // Accept securityId from either request body or query param
        String resolvedSecurityId = (body != null && body.get("securityId") != null)
            ? body.get("securityId")
            : (securityId != null ? securityId : "SECURITY");
        try {
            Optional<Visitor> visitorOpt = visitorRepository.findById(visitorId);
            if (visitorOpt.isEmpty()) {
                return ResponseEntity.badRequest().body("Visitor not found");
            }
            
            Visitor visitor = visitorOpt.get();
            
            if (!"PENDING".equals(visitor.getStatus())) {
                return ResponseEntity.badRequest().body("Visitor request is not pending");
            }
            
            // Auto-escalate if not already marked (handles edge case)
            if (!Boolean.TRUE.equals(visitor.getEscalatedToSecurity())) {
                visitor.setEscalatedToSecurity(true);
                visitor.setEscalationTime(LocalDateTime.now());
            }
            
            // Generate QR code and manual code
            String token = generateRandomToken(8);
            String qrCode = "VG|" + visitorId + "|" + token;
            String manualCode = generateManualCode();
            
            // Ensure manual code is unique
            while (visitorRepository.findByManualCode(manualCode).isPresent()) {
                manualCode = generateManualCode();
            }
            
            // Insert into qr_table
            QRTable qrTable = new QRTable();
            qrTable.setQrCode(token);
            qrTable.setUserType("VG");
            qrTable.setUserId(String.valueOf(visitorId));
            qrTable.setPassRequestId(visitorId);
            qrTable.setEntry(token);
            qrTable.setExit(null);
            qrTable.setCreatedAt(LocalDateTime.now());
            qrTable.setQrString(qrCode);
            qrTable.setManualEntryCode(manualCode);
            qrTable.setRequestedByStaffCode(resolvedSecurityId);
            qrTable.setPassType("VISITOR");
            qrTable.setStudentCount(visitor.getNumberOfPeople());
            qrTable.setStatus("ACTIVE");
            
            qrTableRepository.save(qrTable);
            
            // Update visitor
            visitor.setStatus("APPROVED");
            visitor.setQrCode(qrCode);
            visitor.setManualCode(manualCode);
            visitor.setApprovedAt(LocalDateTime.now());
            visitor.setApprovedBy("SECURITY-" + resolvedSecurityId);
            visitor.setEmailStatus("PENDING");
            visitor.setScanCount(0);
            
            visitorRepository.save(visitor);
            
            System.out.println("✅ Security approved escalated visitor: " + visitor.getName());
            
            return ResponseEntity.ok(visitor);
        } catch (Exception e) {
            System.err.println("Error approving escalated visitor: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError().body("Error approving visitor");
        }
    }
    
    /**
     * Security rejects an escalated visitor request
     */
    @PostMapping("/escalated-visitors/{visitorId}/reject")
    public ResponseEntity<?> rejectEscalatedVisitor(
            @PathVariable Long visitorId,
            @RequestBody java.util.Map<String, String> request) {
        try {
            Optional<Visitor> visitorOpt = visitorRepository.findById(visitorId);
            if (visitorOpt.isEmpty()) {
                return ResponseEntity.badRequest().body("Visitor not found");
            }
            
            Visitor visitor = visitorOpt.get();
            
            if (!"PENDING".equals(visitor.getStatus())) {
                return ResponseEntity.badRequest().body("Visitor request is not pending");
            }
            
            String rejectionReason = request.getOrDefault("reason", "Rejected by security");
            
            visitor.setStatus("REJECTED");
            visitor.setRejectedAt(LocalDateTime.now());
            visitor.setRejectionReason(rejectionReason);
            
            visitorRepository.save(visitor);
            
            System.out.println("✅ Security rejected escalated visitor: " + visitor.getName());
            
            return ResponseEntity.ok(visitor);
        } catch (Exception e) {
            System.err.println("Error rejecting escalated visitor: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError().body("Error rejecting visitor");
        }
    }
    
    /**
     * Register visitor on behalf of visitor (security-assisted registration)
     * Phase 2: Security registers visitor who doesn't have a phone
     */
    @PostMapping("/register-visitor")
    public ResponseEntity<?> registerVisitorForSecurity(@RequestBody java.util.Map<String, Object> request) {
        try {
            System.out.println("🔐 Security registering visitor on behalf");
            System.out.println("📦 Request payload: " + request);
            
            String securityId = (String) request.get("securityId");
            String visitorName = (String) request.get("name");
            String visitorEmail = (String) request.get("email");
            String visitorPhone = (String) request.get("phone");
            String departmentId = (String) request.get("departmentId");
            String staffCode = (String) request.get("staffCode");
            String purpose = (String) request.get("purpose");
            String vehicleNumber = (String) request.get("vehicleNumber");
            Integer numberOfPeople = request.get("numberOfPeople") != null ? 
                Integer.parseInt(request.get("numberOfPeople").toString()) : 1;
            
            System.out.println("  securityId=" + securityId + " name=" + visitorName + 
                " email=" + visitorEmail + " phone=" + visitorPhone +
                " dept=" + departmentId + " staff=" + staffCode + " purpose=" + purpose);
            
            // Validate required fields (null or blank)
            if (isBlank(visitorName) || isBlank(visitorEmail) || isBlank(visitorPhone) ||
                isBlank(departmentId) || isBlank(staffCode) || isBlank(purpose) || isBlank(securityId)) {
                String missing = "";
                if (isBlank(visitorName)) missing += "name ";
                if (isBlank(visitorEmail)) missing += "email ";
                if (isBlank(visitorPhone)) missing += "phone ";
                if (isBlank(departmentId)) missing += "departmentId ";
                if (isBlank(staffCode)) missing += "staffCode ";
                if (isBlank(purpose)) missing += "purpose ";
                if (isBlank(securityId)) missing += "securityId ";
                System.out.println("❌ Missing fields: " + missing);
                return ResponseEntity.badRequest().body(java.util.Map.of(
                    "success", false,
                    "message", "Missing required fields: " + missing.trim()
                ));
            }
            
            // Persist visitor requests in Visitor table (not Gatepass).
            Optional<Staff> staffOpt = staffRepository.findByStaffCode(staffCode);
            if (staffOpt.isEmpty()) {
                return ResponseEntity.badRequest().body(java.util.Map.of(
                    "success", false,
                    "message", "Staff member not found"
                ));
            }
            
            Staff staff = staffOpt.get();

            Visitor visitor = new Visitor();
            visitor.setName(visitorName);
            visitor.setEmail(visitorEmail);
            visitor.setPhone(visitorPhone);
            visitor.setDepartment(staff.getDepartment() != null ? staff.getDepartment() : departmentId);
            visitor.setStaffCode(staffCode);
            visitor.setPersonToMeet(staff.getStaffName() != null ? staff.getStaffName() : staffCode);
            visitor.setPurpose(purpose);
            visitor.setNumberOfPeople(numberOfPeople);
            visitor.setVehicleNumber(vehicleNumber);
            visitor.setRegisteredBy(securityId);
            visitor.setStatus("PENDING");

            Visitor savedVisitor = visitorRepository.save(visitor);
            visitorRepository.flush();
            
            // Notify and email the assigned staff member
            try {
                notificationService.createUserNotification(
                    staffCode,
                    "New Visitor Request",
                    "New visitor request from " + visitorName + " registered by security. Please review and approve.",
                    "GATE_PASS",
                    "HIGH"
                );
                emailService.sendApprovalRequestEmail(
                    staff.getEmail(),
                    staff.getStaffName(),
                    visitorName,
                    visitorEmail,
                    visitorPhone,
                    purpose,
                    numberOfPeople,
                    departmentId,
                    savedVisitor.getId()
                );
                // Mark notification sent — required for 5-min escalation timer
                savedVisitor.setNotificationSentAt(java.time.LocalDateTime.now());
                visitorRepository.save(savedVisitor);
            } catch (Exception notifError) {
                System.err.println("⚠️ Staff notification failed (non-fatal): " + notifError.getMessage());
                // Still set notificationSentAt so escalation timer starts
                savedVisitor.setNotificationSentAt(java.time.LocalDateTime.now());
                visitorRepository.save(savedVisitor);
            }
            
            System.out.println("✅ Visitor registered by security: " + savedVisitor.getName() + 
                             " (ID: " + savedVisitor.getId() + ", Registered by: " + securityId + ")");
            
            return ResponseEntity.ok(java.util.Map.of(
                "success", true,
                "message", "Visitor registered successfully. Pending approval by staff member",
                "data", java.util.Map.of(
                    "id", savedVisitor.getId(),
                    "name", savedVisitor.getName(),
                    "status", savedVisitor.getStatus(),
                    "registeredBy", securityId
                )
            ));
            
        } catch (Exception e) {
            System.err.println("❌ Error registering visitor: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(500).body(java.util.Map.of(
                "success", false,
                "message", "Error registering visitor: " + e.getMessage()
            ));
        }
    }
    
    /**
     * Get visitor requests registered by this security personnel
     * Phase 2: Returns visitors with their QR codes and manual codes
     */
    @GetMapping("/my-visitor-requests")
    public ResponseEntity<?> getMyVisitorRequests(@RequestParam String securityId) {
        try {
            System.out.println("📋 Fetching visitor requests for security: " + securityId);
            
            // Visitor requests are persisted in legacy Visitor table.
            List<java.util.Map<String, Object>> visitorData = new java.util.ArrayList<>();
            
            // 1. Fetch from legacy Visitor table
            List<Visitor> legacyVisitors = visitorRepository.findAll().stream()
                .filter(v -> securityId.equals(v.getRegisteredBy()))
                .collect(java.util.stream.Collectors.toList());
            
            for (Visitor v : legacyVisitors) {
                // Backfill manual code if needed
                if ("APPROVED".equals(v.getStatus()) && (v.getManualCode() == null || v.getManualCode().isEmpty())) {
                    String manualCode = String.format("%06d", new java.util.Random().nextInt(999999));
                    v.setManualCode(manualCode);
                    visitorRepository.save(v);
                    // Also backfill into QR table if a matching row exists
                    if (v.getQrCode() != null) {
                        qrTableRepository.findByQrString(v.getQrCode()).ifPresent(qr -> {
                            qr.setManualEntryCode(manualCode);
                            qrTableRepository.save(qr);
                        });
                    }
                }
                // Backfill QR table manual_entry_code if it's missing
                if ("APPROVED".equals(v.getStatus()) && v.getManualCode() != null && v.getQrCode() != null) {
                    qrTableRepository.findByQrString(v.getQrCode()).ifPresent(qr -> {
                        if (qr.getManualEntryCode() == null || qr.getManualEntryCode().isEmpty()) {
                            qr.setManualEntryCode(v.getManualCode());
                            qrTableRepository.save(qr);
                        }
                        // Also fix legacy "VG|null|token" QR strings to use actual visitor ID
                        if (qr.getQrString() != null && qr.getQrString().startsWith("VG|null|")) {
                            String fixedQrString = "VG|" + v.getId() + "|" + qr.getQrString().substring(8);
                            qr.setQrString(fixedQrString);
                            qr.setUserId(String.valueOf(v.getId()));
                            qr.setPassRequestId(v.getId());
                            qrTableRepository.save(qr);
                            v.setQrCode(fixedQrString);
                            visitorRepository.save(v);
                        }
                    });
                }
                
                java.util.Map<String, Object> data = new java.util.HashMap<>();
                data.put("id", v.getId());
                data.put("name", v.getName());
                data.put("email", v.getEmail());
                data.put("phone", v.getPhone());
                data.put("department", v.getDepartment());
                data.put("personToMeet", v.getPersonToMeet());
                data.put("purpose", v.getPurpose());
                data.put("numberOfPeople", v.getNumberOfPeople());
                data.put("vehicleNumber", v.getVehicleNumber());
                data.put("status", v.getStatus());
                data.put("qrCode", v.getQrCode());
                data.put("manualCode", v.getManualCode());
                data.put("qrCollected", v.getQrCollected());
                data.put("createdAt", v.getCreatedAt());
                data.put("approvedAt", v.getApprovedAt());
                data.put("rejectedAt", v.getRejectedAt());
                data.put("rejectionReason", v.getRejectionReason());
                data.put("source", "LEGACY");
                visitorData.add(data);
            }
            
            // Sort merged list by Date (newest first)
            visitorData.sort((d1, d2) -> {
                LocalDateTime t1 = (LocalDateTime) d1.get("createdAt");
                LocalDateTime t2 = (LocalDateTime) d2.get("createdAt");
                if (t1 == null && t2 == null) return 0;
                if (t1 == null) return 1;
                if (t2 == null) return -1;
                return t2.compareTo(t1);
            });
            
            System.out.println("✅ Found " + visitorData.size() + " visitor requests for security: " + securityId);
            
            return ResponseEntity.ok(java.util.Map.of(
                "success", true,
                "data", visitorData,
                "count", visitorData.size()
            ));
        } catch (Exception e) {
            System.err.println("❌ Error fetching visitor requests: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(500).body(java.util.Map.of(
                "success", false,
                "message", "Error fetching visitor requests"
            ));
        }
    }
    
    /**
     * Mark visitor QR code as collected
     * Phase 2: Security marks QR as collected after showing to visitor
     */
    @PostMapping("/visitor-qr-collected/{visitorId}")
    public ResponseEntity<?> markQRCollected(@PathVariable Long visitorId, @RequestParam String securityId) {
        try {
            Optional<Visitor> visitorOpt = visitorRepository.findById(visitorId);
            if (!visitorOpt.isPresent()) {
                return ResponseEntity.notFound().build();
            }
            
            Visitor visitor = visitorOpt.get();
            
            // Verify this security personnel registered this visitor
            if (!securityId.equals(visitor.getRegisteredBy())) {
                return ResponseEntity.status(403).body(java.util.Map.of(
                    "success", false,
                    "message", "You can only mark QR codes as collected for visitors you registered"
                ));
            }
            
            visitor.setQrCollected(true);
            visitor.setQrCollectedAt(LocalDateTime.now());
            visitorRepository.save(visitor);
            
            System.out.println("✅ QR code marked as collected for visitor: " + visitor.getName());
            
            return ResponseEntity.ok(java.util.Map.of(
                "success", true,
                "message", "QR code marked as collected"
            ));
        } catch (Exception e) {
            System.err.println("❌ Error marking QR as collected: " + e.getMessage());
            return ResponseEntity.status(500).body(java.util.Map.of(
                "success", false,
                "message", "Error marking QR as collected"
            ));
        }
    }
    
    // Helper methods for visitor approval
    private String generateRandomToken(int length) {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        StringBuilder token = new StringBuilder();
        java.util.Random random = new java.util.Random();
        for (int i = 0; i < length; i++) {
            token.append(chars.charAt(random.nextInt(chars.length())));
        }
        return token.toString();
    }
    
    private String generateManualCode() {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        StringBuilder code = new StringBuilder("VIS-");
        java.util.Random random = new java.util.Random();
        for (int i = 0; i < 6; i++) {
            code.append(chars.charAt(random.nextInt(chars.length())));
        }
        return code.toString();
    }

    private boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }
}
