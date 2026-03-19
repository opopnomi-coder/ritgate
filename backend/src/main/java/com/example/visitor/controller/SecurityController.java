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
                            // Try GatePassRequest table (modern visitors)
                            Optional<GatePassRequest> gpVisOpt = gatePassRequestRepository.findById(visitorId);
                            if (gpVisOpt.isPresent()) {
                                GatePassRequest gp = gpVisOpt.get();
                                personName = gp.getStudentName(); // Visitor name is stored here
                                department = gp.getDepartment();
                                
                                detailedInfo.put("name", personName);
                                detailedInfo.put("department", department);
                                detailedInfo.put("purpose", gp.getPurpose());
                                // Note: Email/Phone/StaffToMeet are not currently in GatePassRequest entity
                                
                                System.out.println("📋 Modern Visitor details: " + personName + " from GatePassRequest");
                            } else {
                                personName = "Visitor - " + userId;
                                detailedInfo.put("name", personName);
                            }
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
                // Determine if incharge is HOD or Staff
                if (incharge.startsWith("ADHOD")) {
                    participants.add("HOD:" + incharge);
                } else {
                    participants.add("SF:" + incharge);
                }
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
            
            // Create scan log for the bulk pass with detailed information
            ScanLog scanLog = new ScanLog();
            scanLog.setQrCode(qrCode);
            scanLog.setPersonName("Bulk Pass - " + incharge + " (" + participants.size() + " participants)");
            scanLog.setPersonType(PersonType.VISITOR); // Use VISITOR type for bulk passes
            scanLog.setStatus(ApprovalStatus.APPROVED);
            scanLog.setAccessGranted(true);
            scanLog.setScannedBy("Security Guard");
            scanLog.setScanLocation("Exit Gate");
            scanLog.setUserId(incharge);
            scanLog.setUserType("BULK_PASS");
            scanLog.setQrId(qrTable.getId());
            
            // Store bulk pass details in purpose field for scan history
            // Format: BULK_PASS|incharge:code|subtype:SEG/SIG|count:X|purpose:text|reason:text|participants:json
            StringBuilder purposeBuilder = new StringBuilder();
            purposeBuilder.append("BULK_PASS|");
            purposeBuilder.append("INCHARGE:").append(incharge).append("|");
            purposeBuilder.append("SUBTYPE:").append(subtype).append("|");
            purposeBuilder.append("COUNT:").append(participants.size()).append("|");
            purposeBuilder.append("PURPOSE:").append(purpose).append("|");
            purposeBuilder.append("REASON:").append(reason).append("|");
            purposeBuilder.append("PARTICIPANTS:");
            
            // Add participants as JSON-like string
            for (int i = 0; i < participantDetails.size(); i++) {
                java.util.Map<String, String> p = participantDetails.get(i);
                if (i > 0) purposeBuilder.append(";");
                purposeBuilder.append(p.get("id")).append(":").append(p.get("name"))
                            .append(":").append(p.get("type"))
                            .append(":").append(p.get("department") != null ? p.get("department") : "");
            }
            
            scanLog.setPurpose(purposeBuilder.toString());
            scanLogRepository.save(scanLog);
            
            // Build response
            java.util.Map<String, Object> response = new java.util.HashMap<>();
            response.put("qrCode", qrCode);
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
    
    // Get vehicles by status
    @GetMapping("/vehicles/status/{status}")
    public ResponseEntity<List<VehicleRegistration>> getVehiclesByStatus(@PathVariable ApprovalStatus status) {
        try {
            List<VehicleRegistration> vehicles = vehicleRegistrationRepository.findByStatus(status);
            return ResponseEntity.ok(vehicles);
        } catch (Exception e) {
            System.err.println("Error fetching vehicles by status: " + e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }
    
    // Update vehicle status
    @PutMapping("/vehicles/{id}/status")
    public ResponseEntity<VehicleRegistration> updateVehicleStatus(@PathVariable Long id, @RequestBody ApprovalStatus status) {
        try {
            Optional<VehicleRegistration> vehicleOpt = vehicleRegistrationRepository.findById(id);
            if (vehicleOpt.isPresent()) {
                VehicleRegistration vehicle = vehicleOpt.get();
                vehicle.setStatus(status);
                VehicleRegistration updatedVehicle = vehicleRegistrationRepository.save(vehicle);
                System.out.println("Vehicle status updated: " + vehicle.getLicensePlate() + " - " + status);
                return ResponseEntity.ok(updatedVehicle);
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (Exception e) {
            System.err.println("Error updating vehicle status: " + e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }
    
    // HOD Contact Directory Endpoints
    @GetMapping("/hods")
    public ResponseEntity<List<HODDTO>> getAllHODs() {
        try {
            List<HOD> hods = hodRepository.findAll();
            List<HODDTO> hodDTOs = hods.stream()
                .map(hod -> new HODDTO(
                    hod.getHodCode(),
                    hod.getHodCode(),
                    hod.getHodName(),
                    hod.getEmail(),
                    hod.getPhone(),
                    hod.getDepartment()
                ))
                .collect(Collectors.toList());
            
            System.out.println("Fetched " + hodDTOs.size() + " active HODs");
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
            
            // Fetch staff members from staff table using department code
            List<Staff> staffList = staffRepository.findByDepartment(deptCode);
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
            
            // Fetch HODs from hods table using full department name
            List<HOD> hodList = hodRepository.findByDepartment(deptFullName);
            for (HOD hod : hodList) {
                if (hod.getIsActive()) {
                    people.add(new PersonToMeetDTO(
                        String.valueOf(hod.getId()),
                        hod.getHodName(),
                        "Head of Department",
                        hod.getEmail(),
                        hod.getPhone(),
                        hod.getDepartment(),
                        "HOD"
                    ));
                }
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
            
            // Group scans by person name only (not QR code, since manual exits may have different QR codes)
            java.util.Map<String, java.util.List<ScanLog>> scansByPerson = new java.util.HashMap<>();
            
            for (ScanLog scan : allScans) {
                String key = scan.getPersonName();
                scansByPerson.computeIfAbsent(key, k -> new java.util.ArrayList<>()).add(scan);
            }
            
            // Build active persons list - ONLY PENDING (inside campus)
            List<java.util.Map<String, Object>> activePersons = new java.util.ArrayList<>();
            int id = 1;
            
            for (java.util.List<ScanLog> personScans : scansByPerson.values()) {
                if (personScans.isEmpty()) continue;
                
                // Filter out scans with null scanTime
                personScans.removeIf(scan -> scan.getScanTime() == null);
                if (personScans.isEmpty()) continue;
                
                // Sort by scan time
                personScans.sort((a, b) -> a.getScanTime().compareTo(b.getScanTime()));
                
                ScanLog firstScan = personScans.get(0);
                ScanLog lastScan = personScans.get(personScans.size() - 1);
                
                // Only include if status is PENDING (last scan was at entry)
                if (lastScan.getScanLocation() != null && 
                    !lastScan.getScanLocation().toLowerCase().contains("exit")) {
                    
                    java.util.Map<String, Object> person = new java.util.HashMap<>();
                    person.put("id", id++);
                    person.put("name", firstScan.getPersonName());
                    person.put("type", firstScan.getPersonType() != null ? firstScan.getPersonType().toString() : "UNKNOWN");
                    person.put("purpose", firstScan.getPurpose() != null ? firstScan.getPurpose() : "General");
                    person.put("status", "PENDING");
                    person.put("inTime", firstScan.getScanTime().toString());
                    person.put("outTime", null);
                    
                    activePersons.add(person);
                }
            }
            
            System.out.println("Fetched " + activePersons.size() + " active persons (PENDING only)");
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
                    
                    // Check modern GatePassRequest table
                    Optional<GatePassRequest> gpVisOpt = gatePassRequestRepository.findById(numericId);
                    if (gpVisOpt.isPresent()) return gpVisOpt.get().getStudentName(); // Visitor name is stored here
                } catch(NumberFormatException nfe) {
                    // ID wasn't numeric, ignore
                }
            }
            
            // Fallback: try ALL repositories if primary lookup failed
            try {
                Long numericId = Long.parseLong(userId);
                Optional<Visitor> vOpt = visitorRepository.findById(numericId);
                if (vOpt.isPresent()) return vOpt.get().getName();
                
                Optional<GatePassRequest> qpOpt = gatePassRequestRepository.findById(numericId);
                if (qpOpt.isPresent() && "VISITOR".equals(qpOpt.get().getUserType())) return qpOpt.get().getStudentName();
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
            @RequestParam(required = false, defaultValue = "100") Integer limit) {
        try {
            List<ScanLog> allScans = scanLogRepository.findAll();
            
            // Filter out invalid/rejected scans
            List<ScanLog> validScans = allScans.stream()
                .filter(scan -> scan.getAccessGranted())
                .collect(java.util.stream.Collectors.toList());
            
            // Build a unified list of history records from both Entry (ScanLog) and Exit_logs tables
            List<java.util.Map<String, Object>> scanHistory = new java.util.ArrayList<>();
            
            // --- Part 1: Process Entry table records (late entries, visitor entries) ---
            // Group entry scans by person
            java.util.Map<String, java.util.List<ScanLog>> scansByPerson = new java.util.HashMap<>();
            
            for (ScanLog scan : validScans) {
                String uId = scan.getStudentId() != null ? scan.getStudentId() : 
                               (scan.getFacultyId() != null ? scan.getFacultyId() : scan.getUserId());
                String uType = scan.getPersonType() != null ? scan.getPersonType().toString() : scan.getUserType();
                
                // Fallback for visitors with null/missing IDs in scan logs
                if ("VISITOR".equals(uType) && ("null".equals(uId) || uId == null || uId.isEmpty()) && scan.getQrId() != null) {
                    Optional<QRTable> qt = qrTableRepository.findById(scan.getQrId());
                    if (qt.isPresent() && qt.get().getPassRequestId() != null) {
                        uId = qt.get().getPassRequestId().toString();
                    }
                }
                
                String resolvedName = resolvePersonName(uId, uType, scan.getPersonName());
                scan.setPersonName(resolvedName);
                
                String key = resolvedName + "_" + uId;
                scansByPerson.computeIfAbsent(key, k -> new java.util.ArrayList<>()).add(scan);
            }
            
            // --- Part 2: Also read from Exit_logs table and add as separate EXIT records ---
            List<RailwayExitLog> allExitLogs = railwayExitLogRepository.findAll();
            for (RailwayExitLog exitLog : allExitLogs) {
                if (exitLog.getAccessGranted() == null || !exitLog.getAccessGranted()) continue;
                if (exitLog.getExitTime() == null) continue;
                
                String exitUserId = exitLog.getUserId();
                String exitUserType = exitLog.getUserType();
                String exitName = resolvePersonName(exitUserId, exitUserType, exitLog.getPersonName());
                
                // Use detectUserType to correct misclassified records (e.g., HOD stored as STUDENT)
                String displayType = detectUserType(exitUserId, exitUserType);
                
                java.util.Map<String, Object> exitData = new java.util.HashMap<>();
                exitData.put("id", exitUserId != null ? exitUserId : exitLog.getId());
                exitData.put("name", exitName);
                exitData.put("type", displayType);
                exitData.put("role", resolvePersonRole(exitUserId, exitUserType));
                exitData.put("entryTime", exitLog.getExitTime().format(java.time.format.DateTimeFormatter.ISO_DATE_TIME));
                exitData.put("exitTime", exitLog.getExitTime().format(java.time.format.DateTimeFormatter.ISO_DATE_TIME));
                exitData.put("status", "EXITED");
                exitData.put("accessGranted", true);
                exitData.put("entryLocation", exitLog.getScanLocation() != null ? exitLog.getScanLocation() : "Exit Gate");
                exitData.put("exitLocation", exitLog.getScanLocation() != null ? exitLog.getScanLocation() : "Exit Gate");
                exitData.put("isBulkPass", false);
                exitData.put("purpose", exitLog.getPurpose() != null ? exitLog.getPurpose() : "Gate Pass Exit");
                exitData.put("reason", "");
                
                // Fetch purpose from GatePassRequest if it's a visitor
                if ("VISITOR".equals(displayType)) {
                    try {
                        Long numericId = Long.parseLong(exitUserId);
                        Optional<GatePassRequest> gpOpt = gatePassRequestRepository.findById(numericId);
                        if (gpOpt.isPresent()) {
                            exitData.put("purpose", gpOpt.get().getPurpose());
                        }
                    } catch (Exception ignored) {}
                }
                
                if (exitLog.getDepartment() != null) exitData.put("department", exitLog.getDepartment());
                if (exitLog.getEmail() != null) exitData.put("email", exitLog.getEmail());
                if (exitLog.getPhone() != null) exitData.put("phone", exitLog.getPhone());
                
                scanHistory.add(exitData);
            }
            
            for (java.util.List<ScanLog> personScans : scansByPerson.values()) {
                if (personScans.isEmpty()) continue;
                
                // Filter out scans with no time at all
                personScans.removeIf(scan -> scan.getScanTime() == null && scan.getTimestamp() == null);
                if (personScans.isEmpty()) continue;
                
                // Sort by scan time (fallback to timestamp)
                personScans.sort((a, b) -> {
                    LocalDateTime timeA = a.getScanTime() != null ? a.getScanTime() : a.getTimestamp();
                    LocalDateTime timeB = b.getScanTime() != null ? b.getScanTime() : b.getTimestamp();
                    return timeA.compareTo(timeB);
                });
                
                ScanLog firstScan = personScans.get(0);
                ScanLog lastScan = personScans.get(personScans.size() - 1);
                
                // Determine status based on last scan location
                String status = "ENTRY PENDING";
                String outTime = null;
                boolean accessGranted = firstScan.getAccessGranted();
                
                if (lastScan.getScanLocation() != null && 
                    lastScan.getScanLocation().toLowerCase().contains("exit")) {
                    status = "EXITED";
                    LocalDateTime exitT = lastScan.getScanTime() != null ? lastScan.getScanTime() : lastScan.getTimestamp();
                    outTime = exitT.format(java.time.format.DateTimeFormatter.ISO_DATE_TIME);
                    accessGranted = lastScan.getAccessGranted();
                }
                
                java.util.Map<String, Object> scanData = new java.util.HashMap<>();
                scanData.put("id", firstScan.getStudentId() != null ? firstScan.getStudentId() : 
                                   (firstScan.getFacultyId() != null ? firstScan.getFacultyId() : 
                                   (firstScan.getUserId() != null ? firstScan.getUserId() : firstScan.getId())));
                
                // Resolve name properly
                String name = firstScan.getPersonName();
                scanData.put("name", name != null ? name : "User " + scanData.get("id"));
                
                // Use detectUserType to correct misclassified entry records too
                String entryUserId = (String) scanData.get("id");
                String rawEntryType = firstScan.getPersonType() != null ? firstScan.getPersonType().toString() : 
                                     (firstScan.getUserType() != null ? firstScan.getUserType() : "UNKNOWN");
                scanData.put("type", detectUserType(entryUserId != null ? entryUserId.toString() : null, rawEntryType));
                
                LocalDateTime entryT = firstScan.getScanTime() != null ? firstScan.getScanTime() : firstScan.getTimestamp();
                scanData.put("entryTime", entryT.format(java.time.format.DateTimeFormatter.ISO_DATE_TIME));
                scanData.put("exitTime", outTime);
                scanData.put("status", status);
                scanData.put("accessGranted", accessGranted);
                scanData.put("entryLocation", firstScan.getScanLocation());
                scanData.put("exitLocation", lastScan.getScanLocation());
                
                // Check if this is a bulk pass
                boolean isBulkPass = firstScan.getUserType() != null && firstScan.getUserType().equals("BULK_PASS");
                scanData.put("isBulkPass", isBulkPass);
                
                if (isBulkPass && firstScan.getPurpose() != null && firstScan.getPurpose().startsWith("BULK_PASS|")) {
                    // Parse bulk pass details
                    // Format: BULK_PASS|INCHARGE:code|SUBTYPE:SEG/SIG|COUNT:X|PURPOSE:text|REASON:text|PARTICIPANTS:id:name:type:dept;...
                    String purposeData = firstScan.getPurpose();
                    String[] parts = purposeData.split("\\|");
                    
                    String incharge = "";
                    String subtype = "";
                    String count = "";
                    String purpose = "";
                    String reason = "";
                    java.util.List<java.util.Map<String, String>> participants = new java.util.ArrayList<>();
                    
                    for (String part : parts) {
                        if (part.startsWith("INCHARGE:")) {
                            incharge = part.substring(9);
                        } else if (part.startsWith("SUBTYPE:")) {
                            subtype = part.substring(8);
                        } else if (part.startsWith("COUNT:")) {
                            count = part.substring(6);
                        } else if (part.startsWith("PURPOSE:")) {
                            purpose = part.substring(8);
                        } else if (part.startsWith("REASON:")) {
                            reason = part.substring(7);
                        } else if (part.startsWith("PARTICIPANTS:")) {
                            String participantsStr = part.substring(13);
                            if (!participantsStr.isEmpty()) {
                                String[] participantList = participantsStr.split(";");
                                for (String p : participantList) {
                                    String[] pParts = p.split(":", 4);
                                    if (pParts.length >= 3) {
                                        java.util.Map<String, String> participant = new java.util.HashMap<>();
                                        participant.put("id", pParts[0]);
                                        participant.put("name", pParts[1]);
                                        participant.put("type", pParts[2]);
                                        participant.put("department", pParts.length > 3 ? pParts[3] : "");
                                        participants.add(participant);
                                    }
                                }
                            }
                        }
                    }
                    
                    scanData.put("incharge", incharge);
                    scanData.put("subtype", subtype);
                    scanData.put("participantCount", count);
                    scanData.put("purpose", purpose);
                    scanData.put("reason", reason);
                    scanData.put("participants", participants);
                } else {
                    // Single pass - add purpose and reason
                    scanData.put("purpose", firstScan.getPurpose() != null ? firstScan.getPurpose() : "General");
                    scanData.put("reason", ""); // Single passes don't have reason in scan log
                    
                    // Add detailed information for single pass
                    if (firstScan.getDepartment() != null) {
                        scanData.put("department", firstScan.getDepartment());
                    }
                    if (firstScan.getEmail() != null) {
                        scanData.put("email", firstScan.getEmail());
                    }
                    if (firstScan.getPhone() != null) {
                        scanData.put("phone", firstScan.getPhone());
                    }
                    if (firstScan.getStudentId() != null) {
                        scanData.put("studentId", firstScan.getStudentId());
                        scanData.put("regNo", firstScan.getStudentId());
                    }
                    if (firstScan.getFacultyId() != null) {
                        scanData.put("facultyId", firstScan.getFacultyId());
                        scanData.put("staffCode", firstScan.getFacultyId());
                    }
                    if (firstScan.getDesignation() != null) {
                        scanData.put("role", firstScan.getDesignation());
                    }
                }
                
                scanHistory.add(scanData);
            }
            
            // Sort by entry time (newest first)
            scanHistory.sort((a, b) -> {
                String timeA = (String) a.get("entryTime");
                String timeB = (String) b.get("entryTime");
                return timeB.compareTo(timeA);
            });
            
            // Apply limit
            if (limit != null && limit > 0 && scanHistory.size() > limit) {
                scanHistory = scanHistory.subList(0, limit);
            }
            
            System.out.println("Fetched " + scanHistory.size() + " scan history records (grouped by person, limit: " + limit + ")");
            return ResponseEntity.ok(scanHistory);
        } catch (Exception e) {
            System.err.println("Error fetching scan history: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
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
            ScanLog scanLog = new ScanLog();
            scanLog.setQrCode((String) scanData.get("qrCode"));
            scanLog.setPersonName((String) scanData.get("personName"));
            scanLog.setPersonType(PersonType.valueOf((String) scanData.get("personType")));
            scanLog.setPurpose((String) scanData.get("purpose"));
            scanLog.setStatus(ApprovalStatus.valueOf((String) scanData.get("status")));
            scanLog.setScanLocation((String) scanData.get("scanLocation"));
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
            System.out.println("Scan recorded: " + savedScan.getPersonName() + " - " + savedScan.getScanLocation());
            
            // Create notification for security personnel
            String securityId = (String) scanData.get("securityId");
            if (securityId != null) {
                String scanLocation = (String) scanData.get("scanLocation");
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
            
            return ResponseEntity.ok(savedScan);
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
            boolean isValid = false;
            String scanLocation = "Exit Gate";
            
            if ("SF".equals(type) || "ST".equals(type)) {
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
                    isValid = true;
                    // Delete the row from qr_table
                    qrTableRepository.delete(qrTable);
                    System.out.println("✅ SF/ST EXIT APPROVED - Deleted row for token: " + token);
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
                        isValid = true;
                        scanLocation = "Entry Gate";
                        // Move token from entry to exit
                        qrTable.setExit(qrTable.getEntry());
                        qrTable.setEntry(null);
                        qrTableRepository.save(qrTable);
                        System.out.println("✅ VG ENTRY APPROVED - Moved token to exit: " + qrCode);
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
                        isValid = true;
                        scanLocation = "Exit Gate";
                        // Delete the row from qr_table
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
            } else {
                personType = PersonType.VISITOR;
                personName = "Visitor - " + userId;
            }
            
            result.put("name", personName);
            result.put("type", personType.toString());
            result.put("department", department);
            result.put("email", email);
            result.put("phone", phone);
            
            // Step 4: Create scan log
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
            
            if ("ST".equals(type)) {
                scanLog.setStudentId(userId);
            } else if ("SF".equals(type)) {
                scanLog.setFacultyId(userId);
            }
            
            scanLogRepository.save(scanLog);
            
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
    
    // Manual Exit Endpoint - Record exit manually for visitors
    @PostMapping("/manual-exit")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> recordManualExit(@RequestBody java.util.Map<String, Object> request) {
        try {
            String personName = (String) request.get("personName");
            Object visitorIdObj = request.get("visitorId");
            String scannedBy = (String) request.get("scannedBy");
            
            if (personName == null || personName.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(java.util.Map.of(
                    "status", "ERROR",
                    "message", "Person name is required"
                ));
            }
            
            System.out.println("🚪 Recording manual exit for: " + personName);
            
            // Try to find visitor by ID or name
            Visitor visitor = null;
            
            if (visitorIdObj != null) {
                try {
                    Long visitorId = null;
                    if (visitorIdObj instanceof Integer) {
                        visitorId = ((Integer) visitorIdObj).longValue();
                    } else if (visitorIdObj instanceof Long) {
                        visitorId = (Long) visitorIdObj;
                    } else if (visitorIdObj instanceof String) {
                        visitorId = Long.parseLong((String) visitorIdObj);
                    }
                    
                    if (visitorId != null) {
                        Optional<Visitor> visitorOpt = visitorRepository.findById(visitorId);
                        if (visitorOpt.isPresent()) {
                            visitor = visitorOpt.get();
                            System.out.println("✅ Found visitor by ID: " + visitorId);
                        }
                    }
                } catch (Exception e) {
                    System.err.println("⚠️ Could not parse visitor ID: " + e.getMessage());
                }
            }
            
            // If not found by ID, try to find by name
            if (visitor == null) {
                List<Visitor> visitors = visitorRepository.findAll().stream()
                    .filter(v -> v.getName().equalsIgnoreCase(personName.trim()))
                    .filter(v -> "APPROVED".equals(v.getStatus()))
                    .filter(v -> v.getExitTime() == null) // Not yet exited
                    .collect(java.util.stream.Collectors.toList());
                
                if (!visitors.isEmpty()) {
                    visitor = visitors.get(0); // Take the first match
                    System.out.println("✅ Found visitor by name: " + personName);
                }
            }
            
            if (visitor == null) {
                System.out.println("❌ Visitor not found or already exited: " + personName);
                return ResponseEntity.status(404).body(java.util.Map.of(
                    "status", "ERROR",
                    "message", "Visitor not found or already exited"
                ));
            }
            
            // Record exit time
            java.time.LocalDateTime exitTime = java.time.LocalDateTime.now();
            visitor.setExitTime(exitTime);
            visitor.setScanCount(2); // Mark as completed (entry + exit)
            visitorRepository.save(visitor);
            
            System.out.println("✅ Exit time recorded for visitor: " + visitor.getName() + " at " + exitTime);
            
            // Create scan log for manual exit
            ScanLog scanLog = new ScanLog();
            scanLog.setQrCode("MANUAL-EXIT-" + visitor.getId());
            scanLog.setPersonName(visitor.getName());
            scanLog.setPersonType(PersonType.VISITOR);
            scanLog.setStatus(ApprovalStatus.APPROVED);
            scanLog.setAccessGranted(true);
            scanLog.setScannedBy(scannedBy != null ? scannedBy : "Security Guard (Manual)");
            scanLog.setScanLocation("Exit Gate (Manual)");
            scanLog.setDepartment(visitor.getDepartment());
            scanLog.setEmail(visitor.getEmail());
            scanLog.setPhone(visitor.getPhone());
            scanLog.setPurpose(visitor.getPurpose());
            scanLog.setUserId(visitor.getId().toString());
            scanLog.setUserType("VG");
            
            scanLogRepository.save(scanLog);
            
            System.out.println("✅ Manual exit scan log created for: " + visitor.getName());
            
            // Delete QR code from qr_table if exists
            try {
                if (visitor.getQrCode() != null) {
                    String[] parts = visitor.getQrCode().split("\\|");
                    if (parts.length >= 3) {
                        String token = parts[2];
                        Optional<QRTable> qrTableOpt = qrTableRepository.findByQrCode(token);
                        if (qrTableOpt.isPresent()) {
                            qrTableRepository.delete(qrTableOpt.get());
                            System.out.println("✅ Deleted QR table entry for visitor: " + visitor.getName());
                        }
                    }
                }
            } catch (Exception e) {
                System.err.println("⚠️ Could not delete QR table entry: " + e.getMessage());
            }
            
            // Return success response
            java.util.Map<String, Object> response = new java.util.HashMap<>();
            response.put("status", "SUCCESS");
            response.put("message", "Manual exit recorded successfully");
            response.put("visitorId", visitor.getId());
            response.put("visitorName", visitor.getName());
            response.put("exitTime", exitTime.format(java.time.format.DateTimeFormatter.ISO_DATE_TIME));
            response.put("entryTime", visitor.getEntryTime() != null ? visitor.getEntryTime().format(java.time.format.DateTimeFormatter.ISO_DATE_TIME) : null);
            response.put("scanCount", visitor.getScanCount());
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            System.err.println("❌ Error recording manual exit: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(java.util.Map.of(
                "status", "ERROR",
                "message", "Failed to record manual exit: " + e.getMessage()
            ));
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
     * Get all escalated visitor requests (pending requests that timed out)
     */
    @GetMapping("/escalated-visitors")
    public ResponseEntity<?> getEscalatedVisitors() {
        try {
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
            @RequestParam String securityId) {
        try {
            Optional<Visitor> visitorOpt = visitorRepository.findById(visitorId);
            if (visitorOpt.isEmpty()) {
                return ResponseEntity.badRequest().body("Visitor not found");
            }
            
            Visitor visitor = visitorOpt.get();
            
            if (!"PENDING".equals(visitor.getStatus())) {
                return ResponseEntity.badRequest().body("Visitor request is not pending");
            }
            
            if (!Boolean.TRUE.equals(visitor.getEscalatedToSecurity())) {
                return ResponseEntity.badRequest().body("Visitor request was not escalated to security");
            }
            
            // Generate QR code and manual code
            String qrCode = "VG|null|" + generateRandomToken(8);
            String manualCode = generateManualCode();
            
            // Ensure manual code is unique
            while (visitorRepository.findByManualCode(manualCode).isPresent()) {
                manualCode = generateManualCode();
            }
            
            // Extract token from QR code
            String[] parts = qrCode.split("\\|");
            String token = parts.length >= 3 ? parts[2] : generateRandomToken(8);
            
            // Insert into qr_table
            QRTable qrTable = new QRTable();
            qrTable.setQrCode(token);
            qrTable.setUserType("VG");
            qrTable.setUserId(String.valueOf(visitorId));
            qrTable.setEntry(token);
            qrTable.setExit(null);
            qrTable.setCreatedAt(LocalDateTime.now());
            qrTable.setQrString(qrCode);
            qrTable.setRequestedByStaffCode(securityId);
            qrTable.setPassType("VISITOR");
            qrTable.setStudentCount(visitor.getNumberOfPeople());
            qrTable.setStatus("ACTIVE");
            
            qrTableRepository.save(qrTable);
            
            // Update visitor
            visitor.setStatus("APPROVED");
            visitor.setQrCode(qrCode);
            visitor.setManualCode(manualCode);
            visitor.setApprovedAt(LocalDateTime.now());
            visitor.setApprovedBy("SECURITY-" + securityId);
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
            
            if (!Boolean.TRUE.equals(visitor.getEscalatedToSecurity())) {
                return ResponseEntity.badRequest().body("Visitor request was not escalated to security");
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
            
            // Validate required fields
            if (visitorName == null || visitorEmail == null || visitorPhone == null ||
                departmentId == null || staffCode == null || purpose == null || securityId == null) {
                return ResponseEntity.badRequest().body(java.util.Map.of(
                    "success", false,
                    "message", "Missing required fields"
                ));
            }
            
            // Use UnifiedVisitorService to create visitor request in Gatepass table
            // This ensures QR code with manual code is generated upon approval
            GatePassRequest gatePassRequest = unifiedVisitorService.createVisitorRequestBySecurity(
                securityId,
                visitorName,
                visitorEmail,
                visitorPhone,
                departmentId,
                staffCode,
                purpose,
                numberOfPeople,
                vehicleNumber
            );
            
            System.out.println("✅ Visitor registered by security: " + gatePassRequest.getStudentName() + 
                             " (ID: " + gatePassRequest.getId() + ", Registered by: " + securityId + ")");
            
            return ResponseEntity.ok(java.util.Map.of(
                "success", true,
                "message", "Visitor registered successfully. Approval request sent to staff member",
                "data", java.util.Map.of(
                    "id", gatePassRequest.getId(),
                    "name", gatePassRequest.getStudentName(),
                    "status", gatePassRequest.getStatus().toString(),
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
            
            // Merge legacy visitors and new GatePassRequest visitors
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
            
            // 2. Fetch from new GatePassRequest table
            String searchReason = "Registered by Security: " + securityId;
            List<GatePassRequest> modernVisitors = gatePassRequestRepository.findAll().stream()
                .filter(r -> "VISITOR".equals(r.getUserType()) && r.getReason() != null && r.getReason().contains(searchReason))
                .collect(java.util.stream.Collectors.toList());
                
            for (GatePassRequest r : modernVisitors) {
                java.util.Map<String, Object> data = new java.util.HashMap<>();
                data.put("id", r.getId() + 1000000); // Offset ID to avoid conflict with legacy IDs in UI
                data.put("realId", r.getId());
                data.put("name", r.getStudentName()); // Visitor name mapped to studentName
                data.put("email", r.getRegNo()); // Email mapped to regNo
                data.put("phone", ""); // Phone typically not in core GatePass tracking directly, but mapped inside reason sometimes
                data.put("department", r.getDepartment());
                
                // Get staff name to meet
                String personToMeet = r.getAssignedStaffCode();
                try {
                    Optional<Staff> staff = staffRepository.findByStaffCode(r.getAssignedStaffCode());
                    if (staff.isPresent()) personToMeet = staff.get().getStaffName();
                } catch(Exception ignored) {}
                
                data.put("personToMeet", personToMeet);
                data.put("purpose", r.getPurpose());
                data.put("numberOfPeople", r.getStudentCount());
                data.put("vehicleNumber", "");
                
                // Map status exactly to UI expectations
                String status = "PENDING";
                if (r.getStatus() == GatePassRequest.RequestStatus.APPROVED || r.getStaffApproval() == GatePassRequest.ApprovalStatus.APPROVED) {
                    status = "APPROVED";
                } else if (r.getStatus() == GatePassRequest.RequestStatus.REJECTED || r.getStaffApproval() == GatePassRequest.ApprovalStatus.REJECTED) {
                    status = "REJECTED";
                }
                data.put("status", status);
                data.put("qrCode", r.getQrCode());
                data.put("manualCode", r.getManualCode());
                data.put("qrCollected", r.getQrUsed());
                data.put("createdAt", r.getCreatedAt() != null ? r.getCreatedAt() : r.getRequestDate());
                data.put("approvedAt", r.getStaffApprovalDate());
                data.put("rejectedAt", r.getRejectedAt());
                data.put("rejectionReason", r.getRejectionReason() != null ? r.getRejectionReason() : r.getStaffRemark());
                data.put("source", "MODERN");
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
}
