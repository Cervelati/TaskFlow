package com.taskflow.notification.controller;

import com.taskflow.notification.model.Notification;
import com.taskflow.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @PostMapping
    public ResponseEntity<Notification> create(@RequestBody Map<String, Object> body) {
        Long userId = Long.valueOf(body.get("userId").toString());
        Long taskId = Long.valueOf(body.get("taskId").toString());
        String type = body.get("type").toString();
        String message = body.get("message").toString();

        Notification notification = notificationService.create(userId, taskId, type, message);
        return ResponseEntity.ok(notification);
    }

    @PostMapping("/process")
    public ResponseEntity<String> process() {
        notificationService.processPending();
        return ResponseEntity.ok("Notificações processadas!");
    }
}