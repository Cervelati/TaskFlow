package com.taskflow.notification.scheduler;

import com.taskflow.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@EnableScheduling
@RequiredArgsConstructor
public class NotificationScheduler {

    private final NotificationService notificationService;

    // Roda a cada 5 minutos
    @Scheduled(fixedDelay = 300000)
    public void processNotifications() {
        log.info("Scheduler rodando — verificando notificações pendentes...");
        notificationService.processPending();
    }
}