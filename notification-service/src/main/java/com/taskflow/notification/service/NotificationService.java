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

    private final NotificationRepository notificationRepository;
    private final EmailService emailService;

    // ── Cria uma nova notificação
    public Notification create(Long userId, Long taskId, String type, String message) {
        Notification notification = new Notification();
        notification.setUserId(userId);
        notification.setTaskId(taskId);
        notification.setType(type);
        notification.setMessage(message);
        notification.setSent(false);
        notification.setRead(false);
        notification.setCreatedAt(LocalDateTime.now());
        return notificationRepository.save(notification);
    }

    // ── NOVO: Lista todas as notificações de um usuário (mais recentes primeiro)
    public List<Notification> getByUser(Long userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    // ── NOVO: Conta notificações não lidas de um usuário
    public long countUnread(Long userId) {
        return notificationRepository.countByUserIdAndReadFalse(userId);
    }

    // ── NOVO: Marca uma notificação como lida
    public Notification markAsRead(Long id) {
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Notificação não encontrada: " + id));
        notification.setRead(true);
        notification.setReadAt(LocalDateTime.now());
        return notificationRepository.save(notification);
    }

    // ── NOVO: Marca todas as notificações de um usuário como lidas
    public void markAllAsRead(Long userId) {
        List<Notification> unread = notificationRepository.findByUserIdAndReadFalse(userId);
        unread.forEach(n -> {
            n.setRead(true);
            n.setReadAt(LocalDateTime.now());
        });
        notificationRepository.saveAll(unread);
    }

    // ── Processa e envia e-mails para notificações pendentes
    public void processPending() {
        List<Notification> pending = notificationRepository.findBySentFalse();
        log.info("Processando {} notificações pendentes...", pending.size());

        for (Notification n : pending) {
            try {
                String subject = buildSubject(n.getType());
                emailService.sendEmail(
                    resolveUserEmail(n.getUserId()),
                    subject,
                    n.getMessage()
                );
                n.setSent(true);
                n.setSentAt(LocalDateTime.now());
                notificationRepository.save(n);
            } catch (Exception e) {
                log.error("Erro ao processar notificação {}: {}", n.getId(), e.getMessage());
            }
        }
    }

    private String buildSubject(String type) {
        return switch (type) {
            case "TASK_CREATED"  -> "[TaskFlow] Nova tarefa criada";
            case "TASK_UPDATED"  -> "[TaskFlow] Tarefa atualizada";
            case "TASK_DONE"     -> "[TaskFlow] Tarefa concluída";
            case "TASK_DEADLINE" -> "[TaskFlow] Prazo se aproximando";
            default              -> "[TaskFlow] Notificação";
        };
    }

    // Substitua por uma busca real ao seu UserRepository
    private String resolveUserEmail(Long userId) {
        return "usuario@exemplo.com";
    }

    public void delete(Long id) {
    notificationRepository.deleteById(id);
    }
}