package com.taskflow.notification.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "notifications")
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;
    private Long taskId;
    private String type;
    private String message;
    private boolean sent;

    // ── NOVO: controle de leitura no front
    @Column(nullable = false)
    private boolean read = false;

    private LocalDateTime createdAt = LocalDateTime.now();
    private LocalDateTime sentAt;
    private LocalDateTime readAt;
}