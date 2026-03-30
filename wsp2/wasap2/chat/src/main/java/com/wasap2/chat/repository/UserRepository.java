package com.wasap2.chat.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.wasap2.chat.model.User;

public interface UserRepository extends JpaRepository<User, Long> {
}