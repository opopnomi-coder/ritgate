package com.example.visitor.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Email service using Brevo HTTP API (port 443 — never blocked by Render).
 * Replaces JavaMailSender which uses SMTP (ports 587/465 — blocked on Render free tier).
 */
@Service
public class EmailService {

    @Value("${backend.base.url:http://localhost:8080}")
    private String backendBaseUrl;

    @Value("${brevo.api.key:}")
    private String brevoApiKey;

    @Value("${brevo.sender.email:uixydhvbxdjk850@gmail.com}")
    private String senderEmail;

    @Value("${brevo.sender.name:RIT Gate}")
    private String senderName;

    private static final String BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

    private final RestTemplate restTemplate = new RestTemplate();

    // ─── core send ────────────────────────────────────────────────────────────

    private void sendEmail(String toEmail, String toName, String subject, String textBody) {
        if (brevoApiKey == null || brevoApiKey.isBlank()) {
            System.err.println("❌ BREVO_API_KEY not configured — cannot send email to " + toEmail);
            throw new RuntimeException("BREVO_API_KEY is not configured");
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("sender", Map.of("name", senderName, "email", senderEmail));
        payload.put("to", List.of(Map.of("email", toEmail, "name", toName != null ? toName : toEmail)));
        payload.put("subject", subject);
        payload.put("textContent", textBody);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("api-key", brevoApiKey);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(BREVO_API_URL, entity, String.class);
            if (response.getStatusCode().is2xxSuccessful()) {
                System.out.println("✅ Email sent via Brevo API to: " + toEmail);
            } else {
                System.err.println("❌ Brevo API returned " + response.getStatusCode() + ": " + response.getBody());
                throw new RuntimeException("Brevo API error: " + response.getStatusCode());
            }
        } catch (Exception e) {
            System.err.println("❌ Brevo HTTP error sending to " + toEmail + ": " + e.getMessage());
            throw new RuntimeException("Failed to send email: " + e.getMessage(), e);
        }
    }

    // ─── public methods ───────────────────────────────────────────────────────

    public void sendOTP(String email, String otp, String userName) {
        String subject = "Your OTP for Login - RIT Gate";
        String body =
            "Dear " + userName + ",\n\n" +
            "Your One-Time Password (OTP) for login is:\n\n" +
            ">>> " + otp + " <<<\n\n" +
            "This OTP is valid for 5 minutes.\n" +
            "Please do not share this OTP with anyone.\n\n" +
            "If you did not request this OTP, please ignore this email.\n\n" +
            "Best regards,\nRIT Gate Visitor Management System";
        sendEmail(email, userName, subject, body);
    }

    public void sendApprovalRequestEmail(String staffEmail, String staffName, String visitorName,
                                         String visitorEmail, String visitorPhone, String purpose,
                                         Integer numberOfPeople, String department, Long visitorId) {
        String subject = "Visitor Approval Request - " + visitorName;
        String body =
            "Dear " + staffName + ",\n\n" +
            "You have a new visitor approval request:\n\n" +
            "Visitor Details:\n" +
            "Name: " + visitorName + "\nEmail: " + visitorEmail + "\nPhone: " + visitorPhone +
            "\nNumber of People: " + numberOfPeople + "\nDepartment: " + department +
            "\nPurpose: " + purpose + "\n\n" +
            "Approve: " + backendBaseUrl + "/api/visitors/" + visitorId + "/approve\n" +
            "Reject: " + backendBaseUrl + "/api/visitors/" + visitorId + "/reject\n\n" +
            "Best regards,\nRIT Gate Visitor Management System";
        sendEmail(staffEmail, staffName, subject, body);
    }

    public void sendQRCodeEmail(String visitorEmail, String visitorName, String qrCode,
                                String personToMeet, String department) {
        String subject = "Your Visitor Pass - RIT Gate";
        String body =
            "Dear " + visitorName + ",\n\n" +
            "Your visit request has been approved by " + personToMeet + "!\n\n" +
            "QR Code: " + qrCode + "\nPerson to Meet: " + personToMeet +
            "\nDepartment: " + department + "\n\n" +
            "Please show this QR code at the gate for entry.\n\n" +
            "Best regards,\nRIT Gate Visitor Management System";
        sendEmail(visitorEmail, visitorName, subject, body);
    }

    public void sendRejectionEmail(String visitorEmail, String visitorName, String personToMeet) {
        String subject = "Visit Request Update - RIT Gate";
        String body =
            "Dear " + visitorName + ",\n\n" +
            "We regret to inform you that your visit request to meet " + personToMeet +
            " has been declined.\n\n" +
            "Please contact " + personToMeet + " directly for more information.\n\n" +
            "Best regards,\nRIT Gate Visitor Management System";
        sendEmail(visitorEmail, visitorName, subject, body);
    }

    public void sendVisitorPassEmail(String visitorEmail, String visitorName, String qrCode,
                                     String manualCode, String personToMeet, String department,
                                     String visitDate, String visitTime) {
        String subject = "Your Visitor Gate Pass – Approved";
        String body =
            "Dear " + visitorName + ",\n\n" +
            "Your visit request has been APPROVED!\n\n" +
            "Visitor Name: " + visitorName + "\nPerson to Meet: " + personToMeet +
            "\nDepartment: " + department + "\nVisit Date: " + visitDate +
            "\nVisit Time: " + visitTime + "\n\n" +
            "QR CODE: " + qrCode + "\n\n" +
            "MANUAL ENTRY CODE: " + manualCode + "\n\n" +
            "Show this email at the security gate.\n\n" +
            "Best regards,\nRIT Gate Visitor Management System";
        sendEmail(visitorEmail, visitorName, subject, body);
    }

    public void sendGatePassStatusEmail(String toEmail, String toName, String statusLabel,
                                        String purpose, String detailMessage) {
        String subject = "Gate Pass Update: " + statusLabel + " — RIT Gate";
        String body =
            "Dear " + toName + ",\n\n" +
            detailMessage + "\n\n" +
            "Purpose: " + (purpose != null ? purpose : "N/A") + "\n\n" +
            "Open the RIT Gate app to view your request status.\n\n" +
            "Best regards,\nRIT Gate Visitor Management System";
        sendEmail(toEmail, toName, subject, body);
    }
}
