package com.taskflow.notification.controller;

import com.taskflow.notification.model.Notification;
import com.taskflow.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
@CrossOrigin(origins = "*") // ajuste para seu domínio em produção
public class NotificationController {

    private final NotificationService notificationService;

    // ── POST /api/notifications — cria notificação
    @PostMapping
    public ResponseEntity<Notification> create(@RequestBody Map<String, Object> body) {
        Long userId  = Long.valueOf(body.get("userId").toString());
        Long taskId  = Long.valueOf(body.get("taskId").toString());
        String type    = body.get("type").toString();
        String message = body.get("message").toString();

        Notification notification = notificationService.create(userId, taskId, type, message);
        return ResponseEntity.ok(notification);
    }

    // ── GET /api/notifications/{userId} — lista notificações do usuário
    @GetMapping("/{userId}")
    public ResponseEntity<List<Notification>> getByUser(@PathVariable Long userId) {
        return ResponseEntity.ok(notificationService.getByUser(userId));
    }

    // ── GET /api/notifications/{userId}/unread-count — total não lidas
    @GetMapping("/{userId}/unread-count")
    public ResponseEntity<Map<String, Long>> unreadCount(@PathVariable Long userId) {
        long count = notificationService.countUnread(userId);
        return ResponseEntity.ok(Map.of("count", count));
    }

    // ── PATCH /api/notifications/{id}/read — marca uma como lida
    @PatchMapping("/{id}/read")
    public ResponseEntity<Notification> markAsRead(@PathVariable Long id) {
        return ResponseEntity.ok(notificationService.markAsRead(id));
    }

    // ── PATCH /api/notifications/{userId}/read-all — marca todas como lidas
    @PatchMapping("/{userId}/read-all")
    public ResponseEntity<String> markAllAsRead(@PathVariable Long userId) {
        notificationService.markAllAsRead(userId);
        return ResponseEntity.ok("Todas marcadas como lidas.");
    }

    // ── POST /api/notifications/process — dispara o processamento manual
    @PostMapping("/process")
    public ResponseEntity<String> process() {
        notificationService.processPending();
        return ResponseEntity.ok("Notificações processadas!");
    }
}