package com.example.visitor.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "staff")
public class StaffMember {
    @Id
    @Column(name = "staff_code", nullable = false, unique = true, length = 50)
    private String staffCode;

    @Column(name = "name", nullable = false, length = 200)
    private String staffName;

    @Column(name = "email", length = 100)
    private String email;

    @Column(name = "contact_no", length = 20)
    private String phone;

    @Column(name = "department", length = 100)
    private String department;

    @Column(name = "role", length = 100)
    private String role;

    @Transient private boolean isActive = true;
    @Transient private String password;

    public String getId() { return staffCode; }
    public void setId(String id) { this.staffCode = id; }
    public String getStaffCode() { return staffCode; }
    public void setStaffCode(String staffCode) { this.staffCode = staffCode; }
    public String getStaffName() { return staffName; }
    public void setStaffName(String staffName) { this.staffName = staffName; }
    public String getName() { return staffName; }
    public void setName(String name) { this.staffName = name; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public boolean getIsActive() { return true; }
    public void setIsActive(boolean isActive) { this.isActive = isActive; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
}
