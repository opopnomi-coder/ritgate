package com.example.visitor.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "Entry")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class EntryExit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_type", nullable = false)
    private String userType; // STUDENT, STAFF, VISITOR

    @Column(name = "user_id", nullable = false)
    private String userId; // regNo, staffCode, or visitor ID

    @Column(name = "person_name")
    private String userName;

    @Column(name = "department")
    private String userEmail;

    @Column(name = "scanned_by")
    private String action; // ENTRY, EXIT

    @Column(name = "scan_location")
    private String location; // Main Gate, Side Gate, etc.

    @Column(name = "qr_id")
    private Long gatePassId;

    @Column(name = "timestamp", nullable = false)
    private LocalDateTime timestamp;

    @PrePersist
    protected void onCreate() {
        if (timestamp == null) {
            timestamp = LocalDateTime.now();
        }
    }
}
