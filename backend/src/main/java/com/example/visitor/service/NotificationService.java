package com.example.visitor.service;

import com.example.visitor.entity.GatePassRequest;
import com.example.visitor.entity.Notification;
import com.example.visitor.repository.NotificationRepository;
import com.example.visitor.repository.StudentRepository;
import com.example.visitor.repository.StaffRepository;
import com.example.visitor.repository.HODRepository;
import com.example.visitor.repository.HRRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Slf4j
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final StudentRepository studentRepository;
    private final StaffRepository staffRepository;
    private final HODRepository hodRepository;
    private final HRRepository hrRepository;
    private final PushNotificationService pushNotificationService;

    public NotificationService(
            NotificationRepository notificationRepository,
            StudentRepository studentRepository,
            StaffRepository staffRepository,
            HODRepository hodRepository,
            HRRepository hrRepository,
            PushNotificationService pushNotificationService) {
        this.notificationRepository = notificationRepository;
        this.studentRepository = studentRepository;
        this.staffRepository = staffRepository;
        this.hodRepository = hodRepository;
        this.hrRepository = hrRepository;
        this.pushNotificationService = pushNotificationService;
    }

    // ==================== STUDENT GATE PASS NOTIFICATIONS ====================

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyStaffOfNewStudentRequest(GatePassRequest request) {
        try {
            String title = "New Gate Pass Request";
            String message = String.format("New Gate Pass Request from %s. Please review.", request.getStudentName());
            save(request.getAssignedStaffCode(), title, message,
                Notification.NotificationType.GATE_PASS, Notification.NotificationPriority.HIGH,
                "/staff/pending-approvals");
        } catch (Exception e) {
            log.error("Error notifying staff of new student request", e);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyStudentOfStaffApproval(GatePassRequest request) {
        try {
            save(request.getRegNo(),
                "Request Approved by Staff",
                "Your Gate Pass Request has been approved by Staff and is waiting for HOD approval.",
                Notification.NotificationType.APPROVAL, Notification.NotificationPriority.NORMAL,
                "/student/my-requests");
        } catch (Exception e) {
            log.error("Error notifying student of staff approval", e);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyHODOfStaffApproval(GatePassRequest request) {
        try {
            String message = String.format("A Gate Pass Request from %s approved by Staff is waiting for your approval.", request.getStudentName());
            save(request.getAssignedHodCode(),
                "Request Awaiting Your Approval", message,
                Notification.NotificationType.GATE_PASS, Notification.NotificationPriority.HIGH,
                "/hod/pending-approvals");
        } catch (Exception e) {
            log.error("Error notifying HOD of staff approval", e);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyStudentOfStaffRejection(GatePassRequest request) {
        try {
            String remark = request.getRejectionReason();
            String message = (remark != null && !remark.isBlank())
                ? "Your Gate Pass Request was rejected by Staff. Remark: " + remark
                : "Your Gate Pass Request was rejected by Staff.";
            save(request.getRegNo(), "Request Rejected by Staff", message,
                Notification.NotificationType.REJECTION, Notification.NotificationPriority.HIGH,
                "/student/my-requests");
        } catch (Exception e) {
            log.error("Error notifying student of staff rejection", e);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyStudentOfHODApproval(GatePassRequest request) {
        try {
            save(request.getRegNo(),
                "Gate Pass Approved!",
                "Your Gate Pass Request has been approved by HOD. Your QR Gate Pass is ready.",
                Notification.NotificationType.APPROVAL, Notification.NotificationPriority.URGENT,
                "/student/my-requests");
        } catch (Exception e) {
            log.error("Error notifying student of HOD approval", e);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyStudentOfHODRejection(GatePassRequest request) {
        try {
            String remark = request.getRejectionReason();
            String message = (remark != null && !remark.isBlank())
                ? "Your Gate Pass Request was rejected by HOD. Remark: " + remark
                : "Your Gate Pass Request was rejected by HOD.";
            save(request.getRegNo(), "Request Rejected by HOD", message,
                Notification.NotificationType.REJECTION, Notification.NotificationPriority.HIGH,
                "/student/my-requests");
        } catch (Exception e) {
            log.error("Error notifying student of HOD rejection", e);
        }
    }

    // ==================== STAFF GATE PASS NOTIFICATIONS ====================

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyHODOfNewStaffRequest(GatePassRequest request) {
        try {
            String passType = "BULK".equals(request.getPassType()) ? "Bulk Gate Pass" : "Gate Pass";
            String message = String.format("New %s Request from Staff %s. Please review.", passType, request.getStudentName());
            save(request.getAssignedHodCode(), "New Staff Request", message,
                Notification.NotificationType.GATE_PASS, Notification.NotificationPriority.HIGH,
                "/hod/pending-approvals");
        } catch (Exception e) {
            log.error("Error notifying HOD of new staff request", e);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyStaffOfHODApproval(GatePassRequest request) {
        try {
            String passType = "BULK".equals(request.getPassType()) ? "Bulk Gate Pass" : "Gate Pass";
            save(request.getRegNo(),
                passType + " Approved!",
                String.format("Your %s Request has been approved by HOD. Your QR pass is ready.", passType),
                Notification.NotificationType.APPROVAL, Notification.NotificationPriority.URGENT,
                "/staff/my-requests");
        } catch (Exception e) {
            log.error("Error notifying staff of HOD approval", e);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyStaffOfHODRejection(GatePassRequest request) {
        try {
            String passType = "BULK".equals(request.getPassType()) ? "Bulk Gate Pass" : "Gate Pass";
            String remark = request.getRejectionReason();
            String message = (remark != null && !remark.isBlank())
                ? String.format("Your %s Request was rejected by HOD. Remark: %s", passType, remark)
                : String.format("Your %s Request was rejected by HOD.", passType);
            save(request.getRegNo(), "Request Rejected", message,
                Notification.NotificationType.REJECTION, Notification.NotificationPriority.HIGH,
                "/staff/my-requests");
        } catch (Exception e) {
            log.error("Error notifying staff of HOD rejection", e);
        }
    }

    // ==================== BULK PASS RECEIVER NOTIFICATIONS ====================

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyBulkPassReceivers(GatePassRequest request, List<String> receiverIds) {
        try {
            String message = String.format("A Gate Pass QR has been issued to you by %s.", request.getStudentName());
            for (String receiverId : receiverIds) {
                save(receiverId, "Bulk Gate Pass Issued", message,
                    Notification.NotificationType.BULK_PASS, Notification.NotificationPriority.URGENT,
                    "/my-requests");
            }
        } catch (Exception e) {
            log.error("Error notifying bulk pass receivers", e);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyBulkPassReceiver(GatePassRequest request) {
        try {
            String receiverId = request.getQrOwnerId();
            if (receiverId == null || receiverId.isEmpty()) return;
            String message = String.format("A Gate Pass QR has been issued to you by %s.", request.getStudentName());
            save(receiverId, "Bulk Gate Pass Issued", message,
                Notification.NotificationType.BULK_PASS, Notification.NotificationPriority.URGENT,
                "/my-requests");
        } catch (Exception e) {
            log.error("Error notifying bulk pass receiver", e);
        }
    }

    // ==================== HOD GATE PASS NOTIFICATIONS ====================

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyHROfNewHODRequest(GatePassRequest request) {
        try {
            String message = String.format("HOD %s has requested a Gate Pass. Please review.", request.getStudentName());
            save(request.getAssignedHrCode(), "New HOD Request", message,
                Notification.NotificationType.GATE_PASS, Notification.NotificationPriority.HIGH,
                "/hr/pending-approvals");
        } catch (Exception e) {
            log.error("Error notifying HR of new HOD request", e);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyHODOfHRApproval(GatePassRequest request) {
        try {
            save(request.getRegNo(),
                "Gate Pass Approved!",
                "Your Gate Pass Request has been approved by HR. Your QR pass is ready.",
                Notification.NotificationType.APPROVAL, Notification.NotificationPriority.URGENT,
                "/hod/my-requests");
        } catch (Exception e) {
            log.error("Error notifying HOD of HR approval", e);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyHODOfHRRejection(GatePassRequest request) {
        try {
            save(request.getRegNo(),
                "Request Rejected",
                "Your Gate Pass Request was rejected by HR. Please check remarks.",
                Notification.NotificationType.REJECTION, Notification.NotificationPriority.HIGH,
                "/hod/my-requests");
        } catch (Exception e) {
            log.error("Error notifying HOD of HR rejection", e);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyStaffOfHRApproval(GatePassRequest request) {
        try {
            save(request.getRegNo(),
                "Gate Pass Approved!",
                "Your Gate Pass Request has been approved by HR. Your QR pass is ready.",
                Notification.NotificationType.APPROVAL, Notification.NotificationPriority.URGENT,
                "/staff/my-requests");
        } catch (Exception e) {
            log.error("Error notifying staff of HR approval", e);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyStaffOfHRRejection(GatePassRequest request) {
        try {
            save(request.getRegNo(),
                "Request Rejected",
                "Your Gate Pass Request was rejected by HR. Please check remarks.",
                Notification.NotificationType.REJECTION, Notification.NotificationPriority.HIGH,
                "/staff/my-requests");
        } catch (Exception e) {
            log.error("Error notifying staff of HR rejection", e);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyHODBulkPassReceivers(GatePassRequest request, List<String> receiverIds) {
        try {
            String message = String.format("A Gate Pass QR has been issued to you by HOD %s.", request.getStudentName());
            for (String receiverId : receiverIds) {
                save(receiverId, "Bulk Gate Pass Issued", message,
                    Notification.NotificationType.BULK_PASS, Notification.NotificationPriority.URGENT,
                    "/my-requests");
            }
        } catch (Exception e) {
            log.error("Error notifying HOD bulk pass receivers", e);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyBulkParticipants(GatePassRequest request) {
        try {
            String requesterName = request.getRequestedByStaffName() != null ? 
                                  request.getRequestedByStaffName() : request.getStudentName();
            String qrOwnerId = request.getQrOwnerId();
            
            // 1. Notify the QR Owner (Receiver) - Special message with QR info
            if (qrOwnerId != null && !qrOwnerId.isEmpty()) {
                String receiverMsg = String.format("Gate Pass approved! You are the designated QR holder for the group. Issued by %s.", requesterName);
                save(qrOwnerId, "Bulk Pass QR Assigned", receiverMsg,
                    Notification.NotificationType.BULK_PASS, Notification.NotificationPriority.URGENT,
                    "/my-requests");
            }

            // 2. Notify all other Students
            if (request.getStudentList() != null && !request.getStudentList().isEmpty()) {
                String[] students = request.getStudentList().split(",");
                for (String regNo : students) {
                    String id = regNo.trim();
                    if (id.equals(qrOwnerId)) continue; // Already notified as owner
                    
                    String msg = String.format("You are included in a bulk gate pass issued by %s. The QR code is held by the designated receiver.", requesterName);
                    save(id, "Bulk Pass Issued", msg,
                        Notification.NotificationType.GATE_PASS, Notification.NotificationPriority.NORMAL,
                        "/my-requests");
                }
            }

            // 3. Notify all other Staff
            if (request.getStaffList() != null && !request.getStaffList().isEmpty()) {
                String[] staff = request.getStaffList().split(",");
                for (String code : staff) {
                    String id = code.trim();
                    if (id.equals(qrOwnerId)) continue; // Already notified as owner
                    
                    String msg = String.format("You are included in a bulk gate pass issued by %s. The QR code is held by the designated receiver.", requesterName);
                    save(id, "Bulk Pass Issued", msg,
                        Notification.NotificationType.GATE_PASS, Notification.NotificationPriority.NORMAL,
                        "/my-requests");
                }
            }
            
        } catch (Exception e) {
            log.error("Error notifying bulk participants", e);
        }
    }

    // ==================== UTILITY METHODS ====================

    public List<Notification> getNotificationsForUser(String userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public long getUnreadCount(String userId) {
        return notificationRepository.countByUserIdAndIsReadFalse(userId);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markAsRead(Long notificationId) {
        notificationRepository.findById(notificationId).ifPresent(n -> {
            n.setIsRead(true);
            notificationRepository.save(n);
        });
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markAllAsRead(String userId) {
        notificationRepository.findByUserIdOrderByCreatedAtDesc(userId).forEach(n -> {
            n.setIsRead(true);
            notificationRepository.save(n);
        });
    }

    // ==================== LEGACY METHODS ====================

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void createVisitorNotification(String securityId, String type, String message,
                                         String visitorName, String visitorType) {
        try {
            notificationRepository.save(new Notification(securityId, type, message, visitorName, visitorType));
        } catch (Exception e) {
            log.error("Error creating visitor notification", e);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void createUserNotification(String userId, String title, String message,
                                      String notificationType, String priority) {
        try {
            Notification.NotificationType type = Notification.NotificationType.valueOf(notificationType);
            Notification.NotificationPriority priorityEnum = Notification.NotificationPriority.valueOf(priority);
            save(userId, title, message, type, priorityEnum, null);
        } catch (Exception e) {
            log.error("Error creating user notification", e);
        }
    }

    public List<Notification> getNotificationsBySecurityId(String securityId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(securityId);
    }

    // ==================== PRIVATE HELPER ====================

    private void save(String userId, String title, String message,
                      Notification.NotificationType type, Notification.NotificationPriority priority,
                      String actionUrl) {
        Notification n = new Notification(userId, title, message, type, priority, actionUrl);
        notificationRepository.save(n);
        log.info("📧 Notification saved for {} — {}", userId, title);
        // Fire push notification (non-fatal) — includes actionRoute so tapping opens the right screen
        pushNotificationService.sendToUser(userId, title, message, actionUrl);
    }
}
