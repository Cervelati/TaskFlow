package com.taskflow.notification.repository;

import com.taskflow.notification.model.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findBySentFalse();
    List<Notification> findByUserIdAndSentFalse(Long userId);
}