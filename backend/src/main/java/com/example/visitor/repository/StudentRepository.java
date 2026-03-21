package com.example.visitor.repository;

import com.example.visitor.entity.Student;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StudentRepository extends JpaRepository<Student, Long> {

    // regNo field maps to register_number column
    Optional<Student> findByRegNo(String regNo);

    @Query("SELECT s FROM Student s WHERE s.regNo IN :regNos")
    List<Student> findByRegNoIn(@Param("regNos") List<String> regNos);

    List<Student> findByDepartment(String department);

    // Students assigned to a specific class incharge (exact name match)
    List<Student> findByClassIncharge(String classIncharge);

    // Case-insensitive contains match for class incharge name
    @Query("SELECT s FROM Student s WHERE LOWER(s.classIncharge) LIKE LOWER(CONCAT('%', :name, '%')) AND s.department = :department")
    List<Student> findByClassInchargeContainingAndDepartment(@Param("name") String name, @Param("department") String department);

    // Fallback: students by department and section
    List<Student> findByDepartmentAndSection(String department, String section);

    // Get the HOD name for a department (hod column stores the HOD's name)
    @Query("SELECT DISTINCT s.hod FROM Student s WHERE s.department = :department AND s.hod IS NOT NULL")
    List<String> findHodNamesByDepartment(@Param("department") String department);

    // Get all distinct HOD names across all departments
    @Query("SELECT DISTINCT s.hod FROM Student s WHERE s.hod IS NOT NULL AND s.hod <> ''")
    List<String> findAllDistinctHodNames();
}
