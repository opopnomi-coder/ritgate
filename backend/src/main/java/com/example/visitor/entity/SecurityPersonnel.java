package com.example.visitor.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "security")
public class SecurityPersonnel {
    @Id
    @Column(name = "staff_code", nullable = false, unique = true, length = 100)
    private String securityId;

    @Column(name = "name", length = 255)
    private String name;

    @Column(name = "email", length = 255)
    private String email;

    @Column(name = "contact_no", length = 50)
    private String phone;

    @Column(name = "department", length = 100)
    private String department;

    @Column(name = "role", length = 100)
    private String role;

    @Transient private String qrCode;
    @Transient private String gateAssignment;
    @Transient private String shift;
    @Transient private boolean isActive = true;

    public SecurityPersonnel() {}

    public String getId() { return securityId; }
    public void setId(String id) { this.securityId = id; }
    public String getSecurityId() { return securityId; }
    public void setSecurityId(String securityId) { this.securityId = securityId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public String getQrCode() { return qrCode; }
    public void setQrCode(String qrCode) { this.qrCode = qrCode; }
    public String getGateAssignment() { return gateAssignment != null ? gateAssignment : department; }
    public void setGateAssignment(String gateAssignment) { this.gateAssignment = gateAssignment; }
    public String getShift() { return shift; }
    public void setShift(String shift) { this.shift = shift; }
    public boolean getIsActive() { return true; }
    public void setIsActive(boolean isActive) { this.isActive = isActive; }
}
