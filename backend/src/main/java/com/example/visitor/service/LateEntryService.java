package com.example.visitor.service;

import com.example.visitor.entity.*;
import com.example.visitor.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class LateEntryService {
    
    private final RailwayEntryRepository railwayEntryRepository;
    private final StudentRepository studentRepository;
    private final StaffRepository staffRepository;
    private final StaffMemberRepository staffMemberRepository;
    private final HODRepository hodRepository;
    private final NotificationService notificationService;
    private final com.example.visitor.repository.HRRepository hrRepository;
    
    /**
     * Record student late entry and notify class incharge
     */
    @Transactional
    public LateEntryResponse recordStudentLateEntry(String regNo, String securityId) {
        log.info("Recording student late entry: {}", regNo);
        
        // Fetch student details
        Optional<Student> studentOpt = studentRepository.findByRegNo(regNo);
        if (studentOpt.isEmpty()) {
            throw new RuntimeException("Student not found with registration number: " + regNo);
        }
        
        Student student = studentOpt.get();
        
        // Check if already recorded today
        if (railwayEntryRepository.existsByUserIdToday(regNo)) {
            return LateEntryResponse.builder()
                .success(false)
                .message("Late entry already recorded for today")
                .userType("STUDENT")
                .userId(regNo)
                .userName(student.getFullName())
                .build();
        }
        
        // Create Entry table record
        RailwayEntry entry = new RailwayEntry();
        entry.setUserType("STUDENT");
        entry.setUserId(regNo);
        entry.setPersonName(student.getFullName());  // Add student name
        entry.setDepartment(student.getDepartment());  // Add department
        entry.setScannedBy(securityId);
        entry.setScanLocation("Entry Gate - Late Arrival");
        entry.setTimestamp(LocalDateTime.now());
        
        RailwayEntry saved = railwayEntryRepository.save(entry);
        log.info("Student late entry recorded: {} at {}", regNo, saved.getTimestamp());
        
        // Determine notification recipient (class incharge)
        String notifiedTo = "No class incharge assigned";
        if (student.getClassIncharge() != null && !student.getClassIncharge().isEmpty()) {
            // Fetch class incharge details
            Optional<Staff> inchargeOpt = staffRepository.findByStaffCode(student.getClassIncharge());
            if (inchargeOpt.isPresent()) {
                Staff incharge = inchargeOpt.get();
                
                // Send notification to class incharge
                String message = String.format(
                    "%s (%s) from %s - Year %s arrived late at %s",
                    student.getFullName(),
                    student.getRegNo(),
                    student.getDepartment(),
                    student.getYear(),
                    saved.getTimestamp().toString()
                );
                
                notificationService.createUserNotification(
                    student.getClassIncharge(),
                    "STAFF",
                    "Late Entry Alert - Student",
                    message,
                    "INFO"
                );
                
                notifiedTo = incharge.getStaffName() + " (Class Incharge)";
                log.info("Notification sent to class incharge: {}", student.getClassIncharge());
            }
        }
        
        // Build response
        return LateEntryResponse.builder()
            .success(true)
            .message("Late entry recorded for " + student.getFullName())
            .userType("STUDENT")
            .userId(regNo)
            .userName(student.getFullName())
            .department(student.getDepartment())
            .year(student.getYear())
            .entryTime(saved.getTimestamp())
            .notifiedTo(notifiedTo)
            .build();
    }
    
    /**
     * Record staff late entry and notify HOD
     */
    @Transactional
    public LateEntryResponse recordStaffLateEntry(String staffCode, String securityId) {
        log.info("Recording staff late entry: {}", staffCode);
        
        // Try Staff table first
        Optional<Staff> staffOpt = staffRepository.findByStaffCode(staffCode);
        if (staffOpt.isPresent()) {
            return recordStaffLateEntryInternal(staffOpt.get(), securityId);
        }
        
        // Try StaffMember table
        Optional<StaffMember> staffMemberOpt = staffMemberRepository.findByStaffCode(staffCode);
        if (staffMemberOpt.isPresent()) {
            return recordStaffMemberLateEntryInternal(staffMemberOpt.get(), securityId);
        }
        
        throw new RuntimeException("Staff not found with code: " + staffCode);
    }
    
    private LateEntryResponse recordStaffLateEntryInternal(Staff staff, String securityId) {
        // Check if already recorded today
        if (railwayEntryRepository.existsByUserIdToday(staff.getStaffCode())) {
            return LateEntryResponse.builder()
                .success(false)
                .message("Late entry already recorded for today")
                .userType("STAFF")
                .userId(staff.getStaffCode())
                .userName(staff.getStaffName())
                .build();
        }
        
        // Create Entry table record
        RailwayEntry entry = new RailwayEntry();
        entry.setUserType("STAFF");
        entry.setUserId(staff.getStaffCode());
        entry.setPersonName(staff.getStaffName());  // Add staff name
        entry.setDepartment(staff.getDepartment());  // Add department
        entry.setScannedBy(securityId);
        entry.setScanLocation("Entry Gate - Late Arrival");
        entry.setTimestamp(LocalDateTime.now());
        
        RailwayEntry saved = railwayEntryRepository.save(entry);
        log.info("Staff late entry recorded: {} at {}", staff.getStaffCode(), saved.getTimestamp());
        
        // Notify HOD of the department
        String notifiedTo = "No HOD assigned";
        if (staff.getDepartment() != null && !staff.getDepartment().isEmpty()) {
            // Find HOD by department
            Optional<HOD> hodOpt = hodRepository.findByDepartment(staff.getDepartment())
                .stream()
                .filter(HOD::getIsActive)
                .findFirst();
            
            if (hodOpt.isPresent()) {
                HOD hod = hodOpt.get();
                
                // Send notification to HOD
                String message = String.format(
                    "%s (%s) from %s department arrived late at %s",
                    staff.getStaffName(),
                    staff.getStaffCode(),
                    staff.getDepartment(),
                    saved.getTimestamp().toString()
                );
                
                notificationService.createUserNotification(
                    hod.getHodCode(),
                    "HOD",
                    "Late Entry Alert - Staff",
                    message,
                    "INFO"
                );
                
                notifiedTo = hod.getHodName() + " (HOD)";
                log.info("Notification sent to HOD: {}", hod.getHodCode());
            }
        }
        
        return LateEntryResponse.builder()
            .success(true)
            .message("Late entry recorded for " + staff.getStaffName())
            .userType("STAFF")
            .userId(staff.getStaffCode())
            .userName(staff.getStaffName())
            .department(staff.getDepartment())
            .entryTime(saved.getTimestamp())
            .notifiedTo(notifiedTo)
            .build();
    }
    
    private LateEntryResponse recordStaffMemberLateEntryInternal(StaffMember staff, String securityId) {
        String staffName = staff.getStaffName() != null ? staff.getStaffName() : staff.getName();

        // Check if already recorded today
        if (railwayEntryRepository.existsByUserIdToday(staff.getStaffCode())) {
            return LateEntryResponse.builder()
                .success(false)
                .message("Late entry already recorded for today")
                .userType("STAFF")
                .userId(staff.getStaffCode())
                .userName(staffName)
                .build();
        }
        
        // Create Entry table record
        RailwayEntry entry = new RailwayEntry();
        entry.setUserType("STAFF");
        entry.setUserId(staff.getStaffCode());
        entry.setPersonName(staffName);  // Add staff name
        entry.setDepartment(staff.getDepartment());  // Add department
        entry.setScannedBy(securityId);
        entry.setScanLocation("Entry Gate - Late Arrival");
        entry.setTimestamp(LocalDateTime.now());
        
        RailwayEntry saved = railwayEntryRepository.save(entry);
        log.info("Staff late entry recorded: {} at {}", staff.getStaffCode(), saved.getTimestamp());
        
        // Notify HOD of the department
        String notifiedTo = "No HOD assigned";
        if (staff.getDepartment() != null && !staff.getDepartment().isEmpty()) {
            // Find HOD by department
            Optional<HOD> hodOpt = hodRepository.findByDepartment(staff.getDepartment())
                .stream()
                .filter(HOD::getIsActive)
                .findFirst();
            
            if (hodOpt.isPresent()) {
                HOD hod = hodOpt.get();
                
                // Send notification to HOD
                String message = String.format(
                    "%s (%s) from %s department arrived late at %s",
                    staffName,
                    staff.getStaffCode(),
                    staff.getDepartment(),
                    saved.getTimestamp().toString()
                );
                
                notificationService.createUserNotification(
                    hod.getHodCode(),
                    "HOD",
                    "Late Entry Alert - Staff",
                    message,
                    "INFO"
                );
                
                notifiedTo = hod.getHodName() + " (HOD)";
                log.info("Notification sent to HOD: {}", hod.getHodCode());
            }
        }
        
        return LateEntryResponse.builder()
            .success(true)
            .message("Late entry recorded for " + (staff.getStaffName() != null ? staff.getStaffName() : staff.getName()))
            .userType("STAFF")
            .userId(staff.getStaffCode())
            .userName(staff.getStaffName() != null ? staff.getStaffName() : staff.getName())
            .department(staff.getDepartment())
            .entryTime(saved.getTimestamp())
            .notifiedTo(notifiedTo)
            .build();
    }
    
    /**
     * Record HOD late entry and notify HR
     */
    @Transactional
    public LateEntryResponse recordHODLateEntry(String hodCode, String securityId) {
        log.info("Recording HOD late entry: {}", hodCode);
        
        // Fetch HOD details
        Optional<HOD> hodOpt = hodRepository.findByHodCode(hodCode);
        if (hodOpt.isEmpty()) {
            throw new RuntimeException("HOD not found with code: " + hodCode);
        }
        
        HOD hod = hodOpt.get();
        
        // Check if already recorded today
        if (railwayEntryRepository.existsByUserIdToday(hodCode)) {
            return LateEntryResponse.builder()
                .success(false)
                .message("Late entry already recorded for today")
                .userType("HOD")
                .userId(hodCode)
                .userName(hod.getHodName())
                .build();
        }
        
        // Create Entry table record
        RailwayEntry entry = new RailwayEntry();
        entry.setUserType("HOD");
        entry.setUserId(hodCode);
        entry.setPersonName(hod.getHodName());  // Add HOD name
        entry.setDepartment(hod.getDepartment());  // Add department
        entry.setScannedBy(securityId);
        entry.setScanLocation("Entry Gate - Late Arrival");
        entry.setTimestamp(LocalDateTime.now());
        
        RailwayEntry saved = railwayEntryRepository.save(entry);
        log.info("HOD late entry recorded: {} at {}", hodCode, saved.getTimestamp());
        
        // Notify all active HR personnel
        String notifiedTo = "HR Department";
        try {
            java.util.List<com.example.visitor.entity.HR> hrList = hrRepository.findAll();
            
            for (com.example.visitor.entity.HR hr : hrList) {
                String message = String.format(
                    "HOD %s (%s) from %s department arrived late at %s",
                    hod.getHodName(),
                    hod.getHodCode(),
                    hod.getDepartment(),
                    saved.getTimestamp().toString()
                );
                
                notificationService.createUserNotification(
                    hr.getHrCode(),
                    "HR",
                    "Late Entry Alert - HOD",
                    message,
                    "INFO"
                );
            }
            
            log.info("Notifications sent to {} HR personnel", hrList.size());
        } catch (Exception e) {
            log.error("Error sending notifications to HR: {}", e.getMessage());
        }
        
        return LateEntryResponse.builder()
            .success(true)
            .message("Late entry recorded for " + hod.getHodName())
            .userType("HOD")
            .userId(hodCode)
            .userName(hod.getHodName())
            .department(hod.getDepartment())
            .entryTime(saved.getTimestamp())
            .notifiedTo(notifiedTo)
            .build();
    }
    
    /**
     * Response DTO for late entry recording
     */
    @lombok.Data
    @lombok.Builder
    public static class LateEntryResponse {
        private boolean success;
        private String message;
        private String userType;
        private String userId;
        private String userName;
        private String department;
        private String year;
        private LocalDateTime entryTime;
        private String notifiedTo;
    }
}
