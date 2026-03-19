package com.example.visitor.repository;

import com.example.visitor.entity.HOD;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface HODRepository extends JpaRepository<HOD, String> {

    // hodCode maps to staff_code column
    Optional<HOD> findByHodCode(String hodCode);

    // Find by department
    List<HOD> findByDepartment(String department);

    // Filter by role containing HOD keyword
    @Query("SELECT h FROM HOD h WHERE LOWER(h.role) LIKE LOWER(CONCAT('%', :role, '%'))")
    List<HOD> findByRoleContaining(@Param("role") String role);

    // isActive is transient — not queryable from DB
    // List<HOD> findByIsActive(Boolean isActive); // removed
}
