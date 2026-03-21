package com.example.visitor.controller;

import com.example.visitor.entity.Notification;
import com.example.visitor.entity.UserPushToken;
import com.example.visitor.repository.NotificationRepository;
import com.example.visitor.repository.UserPushTokenRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.HashMap;

@RestController
@RequestMapping("/api/notifications")
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class NotificationController {
    
    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private UserPushTokenRepository pushTokenRepository;
    
    // Get notifications for student
    @GetMapping("/student/{regNo}")
    public ResponseEntity<?> getStudentNotifications(@PathVariable String regNo) {
        try {
            System.out.println("📋 Fetching notifications for student: " + regNo);
            
            List<Notification> notifications = notificationRepository.findByUserIdOrderByCreatedAtDesc(regNo);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("notifications", notifications);
            response.put("count", notifications.size());
            response.put("unreadCount", notifications.stream().filter(n -> !n.getIsRead()).count());
            
            System.out.println("✅ Found " + notifications.size() + " notifications for student: " + regNo);
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            System.err.println("❌ Error fetching student notifications: " + e.getMessage());
            e.printStackTrace();
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", "Error fetching notifications: " + e.getMessage());
            return ResponseEntity.internalServerError().body(errorResponse);
        }
    }
    
    // Get notifications for staff
    @GetMapping("/staff/{staffCode}")
    public ResponseEntity<?> getStaffNotifications(@PathVariable String staffCode) {
        try {
            System.out.println("📋 Fetching notifications for staff: " + staffCode);
            
            List<Notification> notifications = notificationRepository.findByUserIdOrderByCreatedAtDesc(staffCode);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("notifications", notifications);
            response.put("count", notifications.size());
            response.put("unreadCount", notifications.stream().filter(n -> !n.getIsRead()).count());
            
            System.out.println("✅ Found " + notifications.size() + " notifications for staff: " + staffCode);
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            System.err.println("❌ Error fetching staff notifications: " + e.getMessage());
            e.printStackTrace();
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", "Error fetching notifications: " + e.getMessage());
            return ResponseEntity.internalServerError().body(errorResponse);
        }
    }
    
    // Get notifications for HOD
    @GetMapping("/hod/{hodCode}")
    public ResponseEntity<?> getHODNotifications(@PathVariable String hodCode) {
        try {
            System.out.println("📋 Fetching notifications for HOD: " + hodCode);
            
            List<Notification> notifications = notificationRepository.findByUserIdOrderByCreatedAtDesc(hodCode);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("notifications", notifications);
            response.put("count", notifications.size());
            response.put("unreadCount", notifications.stream().filter(n -> !n.getIsRead()).count());
            
            System.out.println("✅ Found " + notifications.size() + " notifications for HOD: " + hodCode);
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            System.err.println("❌ Error fetching HOD notifications: " + e.getMessage());
            e.printStackTrace();
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", "Error fetching notifications: " + e.getMessage());
            return ResponseEntity.internalServerError().body(errorResponse);
        }
    }
    
    // Get notifications for HR
    @GetMapping("/hr/{hrCode}")
    public ResponseEntity<?> getHRNotifications(@PathVariable String hrCode) {
        try {
            System.out.println("📋 Fetching notifications for HR: " + hrCode);
            
            List<Notification> notifications = notificationRepository.findByUserIdOrderByCreatedAtDesc(hrCode);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("notifications", notifications);
            response.put("count", notifications.size());
            response.put("unreadCount", notifications.stream().filter(n -> !n.getIsRead()).count());
            
            System.out.println("✅ Found " + notifications.size() + " notifications for HR: " + hrCode);
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            System.err.println("❌ Error fetching HR notifications: " + e.getMessage());
            e.printStackTrace();
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", "Error fetching notifications: " + e.getMessage());
            return ResponseEntity.internalServerError().body(errorResponse);
        }
    }
    
    // Get notifications for security
    @GetMapping("/security/{securityId}")
    public ResponseEntity<?> getSecurityNotifications(@PathVariable String securityId) {
        try {
            System.out.println("📋 Fetching notifications for security: " + securityId);
            
            List<Notification> notifications = notificationRepository.findByUserIdOrderByCreatedAtDesc(securityId);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("notifications", notifications);
            response.put("count", notifications.size());
            response.put("unreadCount", notifications.stream().filter(n -> !n.getIsRead()).count());
            
            System.out.println("✅ Found " + notifications.size() + " notifications for security: " + securityId);
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            System.err.println("❌ Error fetching security notifications: " + e.getMessage());
            e.printStackTrace();
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", "Error fetching notifications: " + e.getMessage());
            return ResponseEntity.internalServerError().body(errorResponse);
        }
    }
    
    // Mark notification as read
    @PutMapping("/{id}/read")
    public ResponseEntity<?> markAsRead(@PathVariable Long id) {
        try {
            Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Notification not found"));
            
            notification.setIsRead(true);
            notificationRepository.save(notification);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Notification marked as read");
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            System.err.println("❌ Error marking notification as read: " + e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", "Error marking notification as read: " + e.getMessage());
            return ResponseEntity.internalServerError().body(errorResponse);
        }
    }
    
    // Mark all notifications as read for a user
    @PutMapping("/user/{userId}/read-all")
    public ResponseEntity<?> markAllAsRead(@PathVariable String userId) {
        try {
            List<Notification> notifications = notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
            
            for (Notification notification : notifications) {
                if (!notification.getIsRead()) {
                    notification.setIsRead(true);
                    notificationRepository.save(notification);
                }
            }
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "All notifications marked as read");
            response.put("count", notifications.size());
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            System.err.println("❌ Error marking all notifications as read: " + e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", "Error marking all notifications as read: " + e.getMessage());
            return ResponseEntity.internalServerError().body(errorResponse);
        }
    }

    // Register push token
    @PostMapping("/push-token")
    public ResponseEntity<?> registerPushToken(@RequestBody Map<String, String> body) {
        try {
            String userId = body.get("userId");
            String pushToken = body.get("pushToken");
            String deviceType = body.getOrDefault("deviceType", "ANDROID");

            if (userId == null || pushToken == null) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "userId and pushToken required"));
            }

            pushTokenRepository.findByPushToken(pushToken).ifPresentOrElse(
                existing -> {
                    existing.setUserId(userId);
                    existing.setDeviceType(deviceType);
                    pushTokenRepository.save(existing);
                },
                () -> pushTokenRepository.save(new UserPushToken(userId, pushToken, deviceType))
            );

            return ResponseEntity.ok(Map.of("success", true, "message", "Push token registered"));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    // Unregister push token (on logout)
    @DeleteMapping("/push-token")
    public ResponseEntity<?> unregisterPushToken(@RequestBody Map<String, String> body) {
        try {
            String pushToken = body.get("pushToken");
            if (pushToken != null) {
                pushTokenRepository.deleteByPushToken(pushToken);
            }
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

}
