package com.example.visitor.repository;

import com.example.visitor.entity.Visitor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List;

@Repository
public interface VisitorRepository extends JpaRepository<Visitor, Long> {
    Optional<Visitor> findByQrCode(String qrCode);
    Optional<Visitor> findByManualCode(String manualCode);
    List<Visitor> findByStaffCode(String staffCode);
    List<Visitor> findByStaffCodeAndStatus(String staffCode, String status);
    List<Visitor> findByRegisteredByOrderByCreatedAtDesc(String registeredBy);
}
