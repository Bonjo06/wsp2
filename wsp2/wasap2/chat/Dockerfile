FROM eclipse-temurin:17-jdk-jammy

WORKDIR /app

ARG JAR_FILE=target/*.jar
COPY ${JAR_FILE} app.jar

# Configurar variables de entorno 
ENV MAX_THREADS=200

EXPOSE 8080

ENTRYPOINT ["java","-jar","app.jar"]