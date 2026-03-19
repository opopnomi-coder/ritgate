package com.example.visitor.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

// Maps to Exit_logs table (same as RailwayExitLog)
@Entity
@Table(name = "Exit_logs")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GatePassScanLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Maps to Exit_logs.qr_id
    @Column(name = "qr_id")
    private Long passId;

    @Enumerated(EnumType.STRING)
    @Transient
    private ScanType scanType; // ENTRY, EXIT - not stored, Exit_logs is exit-only

    @Column(name = "verified_by")
    private String scannedBy;

    @Column(name = "location")
    private String gateId;

    @Column(name = "device_id")
    private String deviceId;

    @Column(name = "exit_time", nullable = false)
    private LocalDateTime scannedAt;

    @Column(name = "user_id", nullable = false, length = 50)
    private String userId = "UNKNOWN";

    @Column(name = "user_type", nullable = false, length = 20)
    private String userType = "STAFF";

    @PrePersist
    protected void onCreate() {
        if (scannedAt == null) {
            scannedAt = LocalDateTime.now();
        }
    }

    public enum ScanType {
        ENTRY,
        EXIT
    }

    public GatePassScanLog(Long passId, ScanType scanType, String scannedBy,
                           String gateId, String deviceId) {
        this.passId = passId;
        this.scanType = scanType;
        this.scannedBy = scannedBy;
        this.gateId = gateId;
        this.deviceId = deviceId;
    }
}
