package com.wasap2.chat.websocket;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.fasterxml.jackson.databind.ObjectMapper;

@Component
public class ChatWebSocketHandler extends TextWebSocketHandler {

    private static final Map<String, WebSocketSession> sessions = new HashMap<>();
    private static final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String userId = extractUserId(session);
        if (userId != null) {
            sessions.put(userId, session);
            System.out.println("✓ Usuario " + userId + " conectado. Sesiones activas: " + sessions.keySet());
        } else {
            System.out.println("❌ No se pudo extraer userId de la sesión");
        }
    }

    @Override
    public void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        try {
            System.out.println("📨 Mensaje recibido: " + message.getPayload());
            ChatMessage chatMessage = objectMapper.readValue(message.getPayload(), ChatMessage.class);
            
            // Extraer receiverId - puede estar directamente o dentro del objeto receiver anidado
            Long receiverId = chatMessage.getReceiverId();
            if (receiverId == null && chatMessage.receiver != null) {
                // Si receiverId es null, intentar extraerlo del objeto receiver
                Map<String, Object> receiverObj = objectMapper.convertValue(chatMessage.receiver, Map.class);
                Object id = receiverObj.get("id");
                if (id != null) {
                    receiverId = Long.valueOf(id.toString());
                }
            }
            
            WebSocketSession receiverSession = sessions.get(String.valueOf(receiverId));
            
            System.out.println("Intentando enviar a usuario: " + receiverId + " (sesiones activas: " + sessions.keySet() + ")");
            
            if (receiverSession != null && receiverSession.isOpen()) {
                String messageJson = objectMapper.writeValueAsString(chatMessage);
                receiverSession.sendMessage(new TextMessage(messageJson));
                System.out.println("✓ Mensaje enviado a usuario " + receiverId);
            } else {
                System.out.println("⚠️ Usuario " + receiverId + " no está conectado");
            }
        } catch (Exception e) {
            System.err.println("❌ Error procesando mensaje: " + e.getMessage());
            e.printStackTrace();
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        String userId = extractUserId(session);
        if (userId != null) {
            sessions.remove(userId);
            System.out.println("✓ Usuario " + userId + " desconectado. Sesiones activas: " + sessions.keySet());
        }
    }

    private String extractUserId(WebSocketSession session) {
        try {
            String query = session.getUri().getQuery();
            if (query != null && query.contains("userId=")) {
                return query.split("userId=")[1].split("&")[0];
            }
        } catch (Exception e) {
            System.err.println("Error extrayendo userId: " + e.getMessage());
        }
        return null;
    }

    // Clase interna para mapear los mensajes
    public static class ChatMessage {
        public Long id;
        public Long senderId;
        public Long receiverId;
        public String content;
        public String timestamp;
        public Object sender;  // Ignorar objeto anidado
        public Object receiver;  // Ignorar objeto anidado

        public Long getId() {
            return id;
        }

        public void setId(Long id) {
            this.id = id;
        }

        public Long getSenderId() {
            return senderId;
        }

        public void setSenderId(Long senderId) {
            this.senderId = senderId;
        }

        public Long getReceiverId() {
            return receiverId;
        }

        public void setReceiverId(Long receiverId) {
            this.receiverId = receiverId;
        }

        public String getContent() {
            return content;
        }

        public void setContent(String content) {
            this.content = content;
        }

        public String getTimestamp() {
            return timestamp;
        }

        public void setTimestamp(String timestamp) {
            this.timestamp = timestamp;
        }
    }
}
