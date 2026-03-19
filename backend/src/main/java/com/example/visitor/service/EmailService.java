package com.example.visitor.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailService {
    
    @org.springframework.beans.factory.annotation.Value("${backend.base.url:http://localhost:8080}")
    private String backendBaseUrl;
    
    @Autowired
    private JavaMailSender mailSender;
    
    public void sendApprovalRequestEmail(String staffEmail, String staffName, String visitorName, 
                                        String visitorEmail, String visitorPhone, String purpose, 
                                        Integer numberOfPeople, String department, Long visitorId) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(staffEmail);
            message.setSubject("Visitor Approval Request - " + visitorName);
            message.setText(
                "Dear " + staffName + ",\n\n" +
                "You have a new visitor approval request:\n\n" +
                "Visitor Details:\n" +
                "Name: " + visitorName + "\n" +
                "Email: " + visitorEmail + "\n" +
                "Phone: " + visitorPhone + "\n" +
                "Number of People: " + numberOfPeople + "\n" +
                "Department: " + department + "\n" +
                "Purpose: " + purpose + "\n\n" +
                "To approve or reject this request, please click the links below:\n" +
                "Approve: " + backendBaseUrl + "/api/visitors/" + visitorId + "/approve\n" +
                "Reject: " + backendBaseUrl + "/api/visitors/" + visitorId + "/reject\n\n" +
                "Best regards,\n" +
                "RIT Gate Visitor Management System"
            );
            
            mailSender.send(message);
            System.out.println("Approval request email sent to: " + staffEmail);
        } catch (Exception e) {
            System.err.println("Error sending approval request email: " + e.getMessage());
            e.printStackTrace();
        }
    }
    
    public void sendQRCodeEmail(String visitorEmail, String visitorName, String qrCode, 
                               String personToMeet, String department) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(visitorEmail);
            message.setSubject("Your Visitor Pass - RIT Gate");
            message.setText(
                "Dear " + visitorName + ",\n\n" +
                "Your visit request has been approved by " + personToMeet + "!\n\n" +
                "Your Visitor Details:\n" +
                "QR Code: " + qrCode + "\n" +
                "Person to Meet: " + personToMeet + "\n" +
                "Department: " + department + "\n\n" +
                "Please show this QR code at the gate for entry.\n" +
                "You can also save this email for reference.\n\n" +
                "Best regards,\n" +
                "RIT Gate Visitor Management System"
            );
            
            mailSender.send(message);
            System.out.println("QR code email sent to: " + visitorEmail);
        } catch (Exception e) {
            System.err.println("Error sending QR code email: " + e.getMessage());
            e.printStackTrace();
        }
    }
    
    public void sendRejectionEmail(String visitorEmail, String visitorName, String personToMeet) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(visitorEmail);
            message.setSubject("Visit Request Update - RIT Gate");
            message.setText(
                "Dear " + visitorName + ",\n\n" +
                "We regret to inform you that your visit request to meet " + personToMeet + 
                " has been declined.\n\n" +
                "Please contact " + personToMeet + " directly for more information or to reschedule.\n\n" +
                "Best regards,\n" +
                "RIT Gate Visitor Management System"
            );
            
            mailSender.send(message);
            System.out.println("Rejection email sent to: " + visitorEmail);
        } catch (Exception e) {
            System.err.println("Error sending rejection email: " + e.getMessage());
            e.printStackTrace();
        }
    }
    
    /**
     * Send visitor pass email with QR code and manual code
     */
    public void sendVisitorPassEmail(String visitorEmail, String visitorName, String qrCode,
                                    String manualCode, String personToMeet, String department,
                                    String visitDate, String visitTime) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(visitorEmail);
            message.setSubject("Your Visitor Gate Pass – Approved");
            message.setText(
                "Dear " + visitorName + ",\n\n" +
                "✅ Your visit request has been APPROVED!\n\n" +
                "═══════════════════════════════════════\n" +
                "VISITOR PASS DETAILS\n" +
                "═══════════════════════════════════════\n\n" +
                "Visitor Name: " + visitorName + "\n" +
                "Person to Meet: " + personToMeet + "\n" +
                "Department: " + department + "\n" +
                "Visit Date: " + visitDate + "\n" +
                "Visit Time: " + visitTime + "\n\n" +
                "═══════════════════════════════════════\n" +
                "ENTRY METHODS\n" +
                "═══════════════════════════════════════\n\n" +
                "📱 QR CODE (Recommended):\n" +
                qrCode + "\n\n" +
                "🔢 MANUAL ENTRY CODE:\n" +
                ">>> " + manualCode + " <<<\n\n" +
                "═══════════════════════════════════════\n" +
                "INSTRUCTIONS\n" +
                "═══════════════════════════════════════\n\n" +
                "1. Show this email at the security gate\n" +
                "2. Security will scan your QR code OR\n" +
                "3. Provide the manual code: " + manualCode + "\n" +
                "4. You will be granted entry after verification\n\n" +
                "⚠️ IMPORTANT:\n" +
                "- Keep this email safe\n" +
                "- Do not share your codes with others\n" +
                "- Valid only for the specified date and time\n\n" +
                "If you have any questions, please contact " + personToMeet + ".\n\n" +
                "Best regards,\n" +
                "RIT Gate Visitor Management System"
            );
            
            mailSender.send(message);
            System.out.println("✅ Visitor pass email sent to: " + visitorEmail + " (QR: " + qrCode + ", Manual: " + manualCode + ")");
        } catch (Exception e) {
            System.err.println("❌ Error sending visitor pass email: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("Failed to send visitor pass email", e);
        }
    }


    /**
     * Send OTP email for authentication
     */
    public void sendOTP(String email, String otp, String userName) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(email);
            message.setSubject("Your OTP for Login - RIT Gate");
            message.setText(
                "Dear " + userName + ",\n\n" +
                "Your One-Time Password (OTP) for login is:\n\n" +
                ">>> " + otp + " <<<\n\n" +
                "This OTP is valid for 5 minutes.\n" +
                "Please do not share this OTP with anyone.\n\n" +
                "If you did not request this OTP, please ignore this email.\n\n" +
                "Best regards,\n" +
                "RIT Gate Visitor Management System"
            );

            mailSender.send(message);
            System.out.println("✅ OTP email sent to: " + email);
        } catch (Exception e) {
            System.err.println("❌ SMTP ERROR sending OTP to " + email + ": " + e.getMessage());
            System.err.println("❌ SMTP cause: " + (e.getCause() != null ? e.getCause().getMessage() : "null"));
            e.printStackTrace();
            // Re-throw so the controller returns a real error instead of false success
            throw new RuntimeException("Failed to send OTP email: " + e.getMessage(), e);
        }
    }

}
