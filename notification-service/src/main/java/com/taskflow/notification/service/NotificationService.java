package com.taskflow.notification.service;

import com.taskflow.notification.model.Notification;
import com.taskflow.notification.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository repository;
    private final EmailService emailService;

    public Notification create(Long userId, Long taskId, String type, String message) {
        Notification notification = new Notification();
        notification.setUserId(userId);
        notification.setTaskId(taskId);
        notification.setType(type);
        notification.setMessage(message);
        notification.setSent(false);
        return repository.save(notification);
    }

    public void processPending() {
        List<Notification> pending = repository.findBySentFalse();
        log.info("Processando {} notificações pendentes", pending.size());

        for (Notification notification : pending) {
            try {
                emailService.sendEmail(
                    "user@taskflow.com",
                    "[TaskFlow] " + notification.getType(),
                    notification.getMessage()
                );
                notification.setSent(true);
                notification.setSentAt(LocalDateTime.now());
                repository.save(notification);
            } catch (Exception e) {
                log.error("Erro ao processar notificação {}: {}", notification.getId(), e.getMessage());
            }
        }
    }
}