package com.example.visitor.repository;

import com.example.visitor.entity.Staff;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StaffRepository extends JpaRepository<Staff, String> {
    Optional<Staff> findByStaffCode(String staffCode);
    List<Staff> findByStaffCodeIn(List<String> staffCodes);
    Optional<Staff> findByEmail(String email);
    List<Staff> findByDepartment(String department);
    Optional<Staff> findByStaffName(String staffName);
    List<Staff> findByRoleContainingIgnoreCase(String role);
    List<Staff> findByStaffNameContainingIgnoreCase(String name);
}
