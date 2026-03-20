package com.example.visitor.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class UserResponseDTO {
    private Long id;
    private String userId; // regNo, staffCode, hodCode, or securityId
    private String regNo;      // For student support
    private String staffCode;  // For staff support
    private String hodCode;    // For HOD support
    private String hrCode;     // For HR support
    private String securityId; // For security support
    private String name;
    private String firstName; // Added for student support
    private String lastName;  // Added for student support
    private String staffName; // Added for staff support
    private String hodName;   // Added for HOD support
    private String hrName;    // Added for HR support
    private String email;
    private String phone;
    private String department;
    
    @JsonProperty("isActive")
    private boolean isActive; // Explicitly boolean, not Boolean
    
    // Constructors
    public UserResponseDTO() {}
    
    public UserResponseDTO(Long id, String userId, String name, String email, String phone, String department, boolean isActive) {
        this.id = id;
        this.userId = userId;
        this.name = name;
        this.email = email;
        this.phone = phone;
        this.department = department;
        this.isActive = isActive;
        
        // Parse name into firstName and lastName if possible
        if (name != null && name.contains(" ")) {
            String[] parts = name.split(" ", 2);
            this.firstName = parts[0];
            this.lastName = parts[1];
        } else {
            this.firstName = name;
            this.lastName = "";
        }
    }
    
    // Constructor with firstName and lastName
    public UserResponseDTO(Long id, String userId, String firstName, String lastName, String email, String phone, String department, boolean isActive) {
        this.id = id;
        this.userId = userId;
        this.firstName = firstName;
        this.lastName = lastName;
        this.name = lastName != null && !lastName.isEmpty() ? firstName + " " + lastName : firstName;
        this.email = email;
        this.phone = phone;
        this.department = department;
        this.isActive = isActive;
    }
    
    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    
    public String getRegNo() { return regNo; }
    public void setRegNo(String regNo) { 
        this.regNo = regNo;
        this.userId = regNo; // Also set userId for backward compatibility
    }
    
    public String getStaffCode() { return staffCode; }
    public void setStaffCode(String staffCode) {
        this.staffCode = staffCode;
        this.userId = staffCode;
    }

    public String getHodCode() { return hodCode; }
    public void setHodCode(String hodCode) {
        this.hodCode = hodCode;
        this.userId = hodCode;
    }

    public String getHrCode() { return hrCode; }
    public void setHrCode(String hrCode) {
        this.hrCode = hrCode;
        this.userId = hrCode;
    }

    public String getSecurityId() { return securityId; }
    public void setSecurityId(String securityId) {
        this.securityId = securityId;
        this.userId = securityId;
    }
    
    public String getName() { return name; }
    public void setName(String name) { 
        this.name = name;
        // Parse name into firstName and lastName if possible
        if (name != null && name.contains(" ")) {
            String[] parts = name.split(" ", 2);
            this.firstName = parts[0];
            this.lastName = parts[1];
        } else {
            this.firstName = name;
            this.lastName = "";
        }
    }
    
    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { 
        this.firstName = firstName;
        updateFullName();
    }
    
    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { 
        this.lastName = lastName;
        updateFullName();
    }
    
    public String getStaffName() { return staffName; }
    public void setStaffName(String staffName) { 
        this.staffName = staffName;
        this.name = staffName; // Also set name for backward compatibility
    }
    
    public String getHodName() { return hodName; }
    public void setHodName(String hodName) { 
        this.hodName = hodName;
        this.name = hodName; // Also set name for backward compatibility
    }
    
    public String getHrName() { return hrName; }
    public void setHrName(String hrName) { 
        this.hrName = hrName;
        this.name = hrName; // Also set name for backward compatibility
    }
    
    private void updateFullName() {
        this.name = lastName != null && !lastName.isEmpty() ? firstName + " " + lastName : firstName;
    }
    
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    
    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }
    
    @JsonProperty("isActive")
    public boolean isActive() { return isActive; }
    
    @JsonProperty("isActive")
    public void setActive(boolean isActive) { this.isActive = isActive; }
}
