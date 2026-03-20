package com.example.visitor.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "hod")
public class HOD {
    @Id
    @Column(name = "staff_code", nullable = false, unique = true, length = 50)
    private String hodCode;

    @Column(name = "name", length = 200)
    private String hodName;

    @Column(name = "email", length = 100)
    private String email;

    @Column(name = "contact_no", length = 20)
    private String phone;

    @Column(name = "department", length = 100)
    private String department;

    @Column(name = "role", length = 100)
    private String role;

    @Transient private boolean isActive = true;

    public String getId() { return hodCode; }
    public void setId(String id) { this.hodCode = id; }
    public String getHodCode() { return hodCode; }
    public void setHodCode(String hodCode) { this.hodCode = hodCode; }
    public String getHodName() { return hodName; }
    public void setHodName(String hodName) { this.hodName = hodName; }
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
}
