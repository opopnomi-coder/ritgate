package com.example.visitor.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "students")
public class Student {
    @Id
    @Column(name = "sno")
    private Long id;

    @Column(name = "register_number", nullable = false, unique = true, length = 50)
    private String regNo;

    @Column(name = "name", nullable = false, length = 200)
    private String firstName;

    @Column(name = "email", nullable = false, length = 255)
    private String email;

    @Column(name = "contact_no", length = 20)
    private String phone;

    @Column(name = "department", length = 100)
    private String department;

    @Column(name = "year", length = 20)
    private String year;

    @Column(name = "section", length = 10)
    private String section;

    @Column(name = "class_incharge", length = 100)
    private String classIncharge;

    @Column(name = "hod", length = 100)
    private String hod;

    @Transient private String lastName;
    @Transient private boolean isActive = true;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getRegNo() { return regNo; }
    public void setRegNo(String regNo) { this.regNo = regNo; }
    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }
    public String getLastName() { return ""; }
    public void setLastName(String lastName) { this.lastName = lastName; }
    public String getFullName() { return firstName; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }
    public String getYear() { return year; }
    public void setYear(String year) { this.year = year; }
    public String getSection() { return section; }
    public void setSection(String section) { this.section = section; }
    public String getClassIncharge() { return classIncharge; }
    public void setClassIncharge(String classIncharge) { this.classIncharge = classIncharge; }
    public String getHod() { return hod; }
    public void setHod(String hod) { this.hod = hod; }
    public boolean getIsActive() { return true; }
    public void setIsActive(boolean isActive) { this.isActive = isActive; }
}
