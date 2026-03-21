package com.example.visitor.service;

import com.example.visitor.repository.UserPushTokenRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Service
@Slf4j
public class PushNotificationService {

    private static final String EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

    private final UserPushTokenRepository pushTokenRepository;
    private final HttpClient httpClient;

    public PushNotificationService(UserPushTokenRepository pushTokenRepository) {
        this.pushTokenRepository = pushTokenRepository;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    /**
     * Send a push notification to all devices registered for a user.
     * Non-fatal — any failure is logged and swallowed.
     *
     * @param userId     the user's ID (regNo / staffCode / hodCode / hrCode)
     * @param title      notification title
     * @param body       notification body text
     * @param actionRoute optional screen route to navigate to when tapped (e.g. "/student/my-requests")
     */
    public void sendToUser(String userId, String title, String body, String actionRoute) {
        try {
            var tokens = pushTokenRepository.findByUserId(userId);
            if (tokens.isEmpty()) return;

            for (var tokenEntity : tokens) {
                String token = tokenEntity.getPushToken();
                if (token == null || !token.startsWith("ExponentPushToken[")) continue;
                sendExpoPush(token, title, body, actionRoute);
            }
        } catch (Exception e) {
            log.warn("⚠️ Push notification failed for user {}: {}", userId, e.getMessage());
        }
    }

    /** Convenience overload without actionRoute */
    public void sendToUser(String userId, String title, String body) {
        sendToUser(userId, title, body, null);
    }

    private void sendExpoPush(String expoPushToken, String title, String body, String actionRoute) {
        try {
            // Build data payload for tap-to-navigate
            String dataJson = actionRoute != null && !actionRoute.isEmpty()
                ? String.format(",\"data\":{\"actionRoute\":\"%s\"}", escapeJson(actionRoute))
                : "";

            String json = String.format(
                "{\"to\":\"%s\",\"title\":\"%s\",\"body\":\"%s\"" +
                ",\"sound\":\"default\",\"priority\":\"high\"" +
                ",\"channelId\":\"gate-pass\"%s}",
                expoPushToken,
                escapeJson(title),
                escapeJson(body),
                dataJson
            );

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(EXPO_PUSH_URL))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json))
                    .timeout(Duration.ofSeconds(10))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            log.info("📲 Push sent to {} — HTTP {}", expoPushToken, response.statusCode());
        } catch (Exception e) {
            log.warn("⚠️ Failed to send push to {}: {}", expoPushToken, e.getMessage());
        }
    }

    private String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r");
    }
}
