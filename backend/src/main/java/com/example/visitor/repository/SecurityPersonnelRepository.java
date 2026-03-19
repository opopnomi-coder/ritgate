package com.example.visitor.repository;

import com.example.visitor.entity.SecurityPersonnel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SecurityPersonnelRepository extends JpaRepository<SecurityPersonnel, String> {

    // securityId maps to staff_code column
    Optional<SecurityPersonnel> findBySecurityId(String securityId);

    @Query("SELECT s FROM SecurityPersonnel s WHERE LOWER(s.securityId) = LOWER(:securityId)")
    Optional<SecurityPersonnel> findBySecurityIdIgnoreCase(@Param("securityId") String securityId);

    // qrCode is transient — not queryable from DB; kept for compat
    default Optional<SecurityPersonnel> findByQrCode(String qrCode) {
        return Optional.empty();
    }

    Optional<SecurityPersonnel> findByEmail(String email);
}
