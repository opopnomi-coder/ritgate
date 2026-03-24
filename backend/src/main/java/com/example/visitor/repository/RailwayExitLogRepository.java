package com.example.visitor.repository;

import com.example.visitor.entity.RailwayExitLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.time.LocalDateTime;

@Repository
public interface RailwayExitLogRepository extends JpaRepository<RailwayExitLog, Long> {
    
    List<RailwayExitLog> findByUserIdOrderByExitTimeDesc(String userId);
    
    @Query("SELECT e FROM RailwayExitLog e WHERE DATE(e.exitTime) = CURRENT_DATE ORDER BY e.exitTime DESC")
    List<RailwayExitLog> findTodaysExits();
    
    @Query("SELECT COUNT(e) FROM RailwayExitLog e WHERE DATE(e.exitTime) = CURRENT_DATE")
    Long countTodaysExits();
    
    @Query("SELECT CASE WHEN COUNT(e) > 0 THEN true ELSE false END FROM RailwayExitLog e WHERE e.userId = :userId AND DATE(e.exitTime) = CURRENT_DATE")
    boolean existsByUserIdToday(@org.springframework.data.repository.query.Param("userId") String userId);

    @Query("SELECT e FROM RailwayExitLog e WHERE e.exitTime >= :from AND e.exitTime <= :to ORDER BY e.exitTime DESC")
    List<RailwayExitLog> findByExitTimeBetweenOrderByExitTimeDesc(
        @org.springframework.data.repository.query.Param("from") LocalDateTime from,
        @org.springframework.data.repository.query.Param("to") LocalDateTime to
    );
}
