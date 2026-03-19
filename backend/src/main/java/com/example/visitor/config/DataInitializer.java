package com.example.visitor.config;

import com.example.visitor.entity.Department;
import com.example.visitor.entity.Staff;
import com.example.visitor.entity.Person;
import com.example.visitor.entity.VehicleRegistration;
import com.example.visitor.entity.SecurityPersonnel;
import com.example.visitor.entity.PersonType;
import com.example.visitor.entity.ApprovalStatus;
import com.example.visitor.repository.DepartmentRepository;
import com.example.visitor.repository.StaffRepository;
import com.example.visitor.repository.PersonRepository;
import com.example.visitor.repository.VehicleRegistrationRepository;
import com.example.visitor.repository.SecurityPersonnelRepository;
import com.example.visitor.repository.VisitRepository;
import com.example.visitor.repository.ScanLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

// @Component - Disabled: Using existing remote database
public class DataInitializer implements CommandLineRunner {
    
    @Autowired
    private DepartmentRepository departmentRepository;
    
    @Autowired
    private StaffRepository staffRepository;
    
    @Autowired
    private PersonRepository personRepository;
    
    @Autowired
    private VehicleRegistrationRepository vehicleRegistrationRepository;
    
    @Autowired
    private VisitRepository visitRepository;
    
    @Autowired
    private ScanLogRepository scanLogRepository;
    
    @Autowired
    private SecurityPersonnelRepository securityPersonnelRepository;
    
    @Override
    public void run(String... args) throws Exception {
        // Clear existing data and reinitialize
        if (departmentRepository.count() > 0) {
            scanLogRepository.deleteAll();
            vehicleRegistrationRepository.deleteAll();
            personRepository.deleteAll();
            // Delete visits first due to foreign key constraints
            visitRepository.deleteAll();
            staffRepository.deleteAll();
            departmentRepository.deleteAll();
            securityPersonnelRepository.deleteAll();
        }
        
        // Departments already exist in Railway database - no need to initialize
        // Fetch existing departments by name (which is now the primary key)
        Department cse = departmentRepository.findById("CSE").orElse(null);
        Department ece = departmentRepository.findById("ECE").orElse(null);
        Department mech = departmentRepository.findById("MECH").orElse(null);
        Department civil = departmentRepository.findById("CIVIL").orElse(null);
        Department eee = departmentRepository.findById("EEE").orElse(null);
        
        // If departments don't exist, create them
        if (cse == null) cse = departmentRepository.save(new Department("CSE"));
        if (ece == null) ece = departmentRepository.save(new Department("ECE"));
        if (mech == null) mech = departmentRepository.save(new Department("MECH"));
        if (civil == null) civil = departmentRepository.save(new Department("CIVIL"));
        if (eee == null) eee = departmentRepository.save(new Department("EEE"));
        
        // Staff data already exists in Railway database - no need to initialize
        
        // Initialize sample persons for QR code scanning
        
        // Students
        Person student1 = new Person("STU001QR", "Arjun Kumar", "arjun.kumar@college.edu", "9876543210", PersonType.STUDENT, ApprovalStatus.APPROVED);
        student1.setStudentId("STU001");
        student1.setDepartment("Computer Science");
        student1.setValidFrom("2024-01-01");
        student1.setValidTo("2024-12-31");
        personRepository.save(student1);
        
        Person student2 = new Person("STU002QR", "Priya Sharma", "priya.sharma@college.edu", "9876543211", PersonType.STUDENT, ApprovalStatus.APPROVED);
        student2.setStudentId("STU002");
        student2.setDepartment("Electronics");
        student2.setValidFrom("2024-01-01");
        student2.setValidTo("2024-12-31");
        personRepository.save(student2);
        
        Person student3 = new Person("STU003QR", "Vikram Singh", "vikram.singh@college.edu", "9876543212", PersonType.STUDENT, ApprovalStatus.REJECTED);
        student3.setStudentId("STU003");
        student3.setDepartment("Mechanical");
        student3.setValidFrom("2024-01-01");
        student3.setValidTo("2024-12-31");
        personRepository.save(student3);
        
        // Faculty
        Person faculty1 = new Person("FAC001QR", "Dr. Rajesh Gupta", "rajesh.gupta@college.edu", "9876543220", PersonType.FACULTY, ApprovalStatus.APPROVED);
        faculty1.setFacultyId("FAC001");
        faculty1.setDepartment("Computer Science");
        faculty1.setDesignation("Professor");
        faculty1.setValidFrom("2024-01-01");
        faculty1.setValidTo("2024-12-31");
        personRepository.save(faculty1);
        
        Person faculty2 = new Person("FAC002QR", "Dr. Sunita Patel", "sunita.patel@college.edu", "9876543221", PersonType.FACULTY, ApprovalStatus.APPROVED);
        faculty2.setFacultyId("FAC002");
        faculty2.setDepartment("Electronics");
        faculty2.setDesignation("Associate Professor");
        faculty2.setValidFrom("2024-01-01");
        faculty2.setValidTo("2024-12-31");
        personRepository.save(faculty2);
        
        // Visitors
        Person visitor1 = new Person("VIS001QR", "Amit Verma", "amit.verma@company.com", "9876543230", PersonType.VISITOR, ApprovalStatus.APPROVED);
        visitor1.setPurpose("Technical Interview");
        visitor1.setValidFrom("2024-02-05");
        visitor1.setValidTo("2024-02-05");
        personRepository.save(visitor1);
        
        Person visitor2 = new Person("VIS002QR", "Kavya Nair", "kavya.nair@vendor.com", "9876543231", PersonType.VISITOR, ApprovalStatus.PENDING);
        visitor2.setPurpose("Equipment Delivery");
        visitor2.setValidFrom("2024-02-05");
        visitor2.setValidTo("2024-02-05");
        personRepository.save(visitor2);
        
        Person visitor3 = new Person("VIS003QR", "Rohit Joshi", "rohit.joshi@contractor.com", "9876543232", PersonType.VISITOR, ApprovalStatus.REJECTED);
        visitor3.setPurpose("Maintenance Work");
        visitor3.setValidFrom("2024-02-05");
        visitor3.setValidTo("2024-02-05");
        personRepository.save(visitor3);
        
        // Initialize sample vehicle registrations
        VehicleRegistration vehicle1 = new VehicleRegistration("KA01AB1234", "Arjun Kumar", "9876543210", PersonType.STUDENT);
        vehicle1.setVehicleType("Bike");
        vehicle1.setVehicleModel("Honda Activa");
        vehicle1.setVehicleColor("Black");
        vehicle1.setStatus(ApprovalStatus.APPROVED);
        vehicle1.setRegisteredBy("Security Guard 1");
        vehicleRegistrationRepository.save(vehicle1);
        
        VehicleRegistration vehicle2 = new VehicleRegistration("KA02CD5678", "Dr. Rajesh Gupta", "9876543220", PersonType.FACULTY);
        vehicle2.setVehicleType("Car");
        vehicle2.setVehicleModel("Maruti Swift");
        vehicle2.setVehicleColor("White");
        vehicle2.setStatus(ApprovalStatus.APPROVED);
        vehicle2.setRegisteredBy("Security Guard 1");
        vehicleRegistrationRepository.save(vehicle2);
        
        VehicleRegistration vehicle3 = new VehicleRegistration("KA03EF9012", "Amit Verma", "9876543230", PersonType.VISITOR);
        vehicle3.setVehicleType("Car");
        vehicle3.setVehicleModel("Toyota Innova");
        vehicle3.setVehicleColor("Silver");
        vehicle3.setStatus(ApprovalStatus.PENDING);
        vehicle3.setRegisteredBy("Security Guard 2");
        vehicleRegistrationRepository.save(vehicle3);
        
        // Security personnel live in the staff table — no separate initialization needed
        
        System.out.println("Database initialized with updated data:");
        System.out.println("- Departments: " + departmentRepository.count());
        System.out.println("- Staff members: " + staffRepository.count());
        System.out.println("- Persons (Students/Faculty/Visitors): " + personRepository.count());
        System.out.println("- Vehicle registrations: " + vehicleRegistrationRepository.count());
        System.out.println("- Security personnel: " + securityPersonnelRepository.count());
        System.out.println("- Scan logs: " + scanLogRepository.count());
    }
}