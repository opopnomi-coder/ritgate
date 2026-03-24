package com.example.visitor.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "Visitor")
public class Visitor {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = true, unique = true, name = "qr_code")
    private String qrCode;
    
    @Column(nullable = false, name = "visitor_name")
    private String name;
    
    @Column(nullable = false, name = "visitor_email")
    private String email;
    
    @Column(nullable = false, name = "visitor_phone")
    private String phone;
    
    @Column(nullable = true)
    private String type;

    @Column(nullable = true, name = "role")
    private String role;
    
    @Column(nullable = false, name = "department")
    private String department;
    
    @Column(nullable = false, name = "person_to_meet")
    private String personToMeet;
    
    @Column(nullable = false, columnDefinition = "TEXT")
    private String purpose;
    
    @Column(nullable = false, name = "number_of_people")
    private Integer numberOfPeople;
    
    @Column(nullable = true, name = "vehicle_number")
    private String vehicleNumber;
    
    @Column(nullable = true, name = "staff_code")
    private String staffCode;
    
    @Column(nullable = true, name = "manual_code")
    private String manualCode;
    
    @Column(nullable = true, name = "visit_date")
    private java.time.LocalDate visitDate;
    
    @Column(nullable = true, name = "visit_time")
    private java.time.LocalTime visitTime;
    
    @Column(nullable = true, name = "rejected_at")
    private LocalDateTime rejectedAt;
    
    @Column(nullable = true, name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;
    @Column(nullable = true, name = "entry_time")
    private LocalDateTime entryTime;

    @Column(nullable = true, name = "exit_time")
    private LocalDateTime exitTime;

    @Column(nullable = false, name = "scan_count")
    private Integer scanCount;
    
    @Column(nullable = true, name = "email_status")
    private String emailStatus;
    
    @Column(nullable = false)
    private String status; // PENDING, APPROVED, REJECTED
    
    @Column(nullable = true, name = "approved_at")
    private LocalDateTime approvedAt;
    
    @Column(nullable = true, name = "approved_by")
    private String approvedBy;
    
    @Column(nullable = true, name = "escalated_to_security")
    private Boolean escalatedToSecurity;
    
    @Column(nullable = true, name = "escalation_time")
    private LocalDateTime escalationTime;
    
    @Column(nullable = true, name = "notification_sent_at")
    private LocalDateTime notificationSentAt;
    
    @Column(nullable = true, name = "registered_by")
    private String registeredBy;
    
    @Column(nullable = true, name = "qr_collected")
    private Boolean qrCollected;
    
    @Column(nullable = true, name = "qr_collected_at")
    private LocalDateTime qrCollectedAt;
    
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
    
    // Constructors
    public Visitor() {
        this.createdAt = LocalDateTime.now();
        this.status = "PENDING";
        this.scanCount = 0;
        this.role = "VISITOR";
    }
    
    public Visitor(String qrCode, String name, String email, String phone, String department, 
                   String personToMeet, String purpose, Integer numberOfPeople) {
        this();
        this.qrCode = qrCode;
        this.name = name;
        this.email = email;
        this.phone = phone;
        this.department = department;
        this.personToMeet = personToMeet;
        this.purpose = purpose;
        this.numberOfPeople = numberOfPeople;
    }
    
    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    
    public String getQrCode() { return qrCode; }
    public void setQrCode(String qrCode) { this.qrCode = qrCode; }
    
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    
    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }
    
    public String getPersonToMeet() { return personToMeet; }
    public void setPersonToMeet(String personToMeet) { this.personToMeet = personToMeet; }
    
    public String getPurpose() { return purpose; }
    public void setPurpose(String purpose) { this.purpose = purpose; }
    
    public Integer getNumberOfPeople() { return numberOfPeople; }
    public void setNumberOfPeople(Integer numberOfPeople) { this.numberOfPeople = numberOfPeople; }
    
    public String getVehicleNumber() { return vehicleNumber; }
    public void setVehicleNumber(String vehicleNumber) { this.vehicleNumber = vehicleNumber; }
    
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    
    // Backward compatibility methods
    public String getApprovalStatus() { return status; }
    public void setApprovalStatus(String approvalStatus) { this.status = approvalStatus; }
    
    public LocalDateTime getApprovedAt() { return approvedAt; }
    public void setApprovedAt(LocalDateTime approvedAt) { this.approvedAt = approvedAt; }
    
    public String getApprovedBy() { return approvedBy; }
    public void setApprovedBy(String approvedBy) { this.approvedBy = approvedBy; }
    
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    
    public String getStaffCode() { return staffCode; }
    public void setStaffCode(String staffCode) { this.staffCode = staffCode; }
    
    public String getManualCode() { return manualCode; }
    public void setManualCode(String manualCode) { this.manualCode = manualCode; }
    
    public java.time.LocalDate getVisitDate() { return visitDate; }
    public void setVisitDate(java.time.LocalDate visitDate) { this.visitDate = visitDate; }
    
    public java.time.LocalTime getVisitTime() { return visitTime; }
    public void setVisitTime(java.time.LocalTime visitTime) { this.visitTime = visitTime; }
    
    public LocalDateTime getRejectedAt() { return rejectedAt; }
    public void setRejectedAt(LocalDateTime rejectedAt) { this.rejectedAt = rejectedAt; }
    
    public String getRejectionReason() { return rejectionReason; }
    public void setRejectionReason(String rejectionReason) { this.rejectionReason = rejectionReason; }
    
    public String getEmailStatus() { return emailStatus; }
    public void setEmailStatus(String emailStatus) { this.emailStatus = emailStatus; }

    public LocalDateTime getEntryTime() { return entryTime; }
    public void setEntryTime(LocalDateTime entryTime) { this.entryTime = entryTime; }

    public LocalDateTime getExitTime() { return exitTime; }
    public void setExitTime(LocalDateTime exitTime) { this.exitTime = exitTime; }

    public Integer getScanCount() { return scanCount; }
    public void setScanCount(Integer scanCount) { this.scanCount = scanCount; }
    
    public Boolean getEscalatedToSecurity() { return escalatedToSecurity; }
    public void setEscalatedToSecurity(Boolean escalatedToSecurity) { this.escalatedToSecurity = escalatedToSecurity; }
    
    public LocalDateTime getEscalationTime() { return escalationTime; }
    public void setEscalationTime(LocalDateTime escalationTime) { this.escalationTime = escalationTime; }
    
    public LocalDateTime getNotificationSentAt() { return notificationSentAt; }
    public void setNotificationSentAt(LocalDateTime notificationSentAt) { this.notificationSentAt = notificationSentAt; }
    
    public String getRegisteredBy() { return registeredBy; }
    public void setRegisteredBy(String registeredBy) { this.registeredBy = registeredBy; }
    
    public Boolean getQrCollected() { return qrCollected; }
    public void setQrCollected(Boolean qrCollected) { this.qrCollected = qrCollected; }
    
    public LocalDateTime getQrCollectedAt() { return qrCollectedAt; }
    public void setQrCollectedAt(LocalDateTime qrCollectedAt) { this.qrCollectedAt = qrCollectedAt; }
}
