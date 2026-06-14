package com.taskflow.notification.controller;

import com.taskflow.notification.model.Notification;
import com.taskflow.notification.service.EmailService;
import com.taskflow.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class NotificationController {

    private final NotificationService notificationService;
    private final EmailService emailService;

    // ── POST /api/notifications — cria notificação
    @PostMapping("/api/notifications")
    public ResponseEntity<Notification> create(@RequestBody Map<String, Object> body) {
        Long userId    = Long.valueOf(body.get("userId").toString());
        Long taskId    = Long.valueOf(body.get("taskId").toString());
        String type    = body.get("type").toString();
        String message = body.get("message").toString();

        Notification notification = notificationService.create(userId, taskId, type, message);
        return ResponseEntity.ok(notification);
    }

    // ── GET /api/notifications/{userId} — lista notificações do usuário
    @GetMapping("/api/notifications/{userId}")
    public ResponseEntity<List<Notification>> getByUser(@PathVariable Long userId) {
        return ResponseEntity.ok(notificationService.getByUser(userId));
    }

    // ── GET /api/notifications/{userId}/unread-count
    @GetMapping("/api/notifications/{userId}/unread-count")
    public ResponseEntity<Map<String, Long>> unreadCount(@PathVariable Long userId) {
        long count = notificationService.countUnread(userId);
        return ResponseEntity.ok(Map.of("count", count));
    }

    // ── PATCH /api/notifications/{id}/read
    @PatchMapping("/api/notifications/{id}/read")
    public ResponseEntity<Notification> markAsRead(@PathVariable Long id) {
        return ResponseEntity.ok(notificationService.markAsRead(id));
    }

    // ── PATCH /api/notifications/{userId}/read-all
    @PatchMapping("/api/notifications/{userId}/read-all")
    public ResponseEntity<String> markAllAsRead(@PathVariable Long userId) {
        notificationService.markAllAsRead(userId);
        return ResponseEntity.ok("Todas marcadas como lidas.");
    }

    // ── POST /api/notifications/process
    @PostMapping("/api/notifications/process")
    public ResponseEntity<String> process() {
        notificationService.processPending();
        return ResponseEntity.ok("Notificações processadas!");
    }

    // ── POST /notify/email — envia e-mail direto (usado pelo backend .NET)
    @PostMapping("/notify/email")
    public ResponseEntity<String> sendEmail(@RequestBody Map<String, Object> body) {
        String to      = body.get("to").toString();
        String subject = body.get("subject").toString();
        String text    = body.get("body").toString();

        emailService.sendEmail(to, subject, text);
        return ResponseEntity.ok("E-mail enviado.");
    }
}