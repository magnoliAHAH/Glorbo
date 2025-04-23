# Используем официальный образ Go
FROM golang:1.24-alpine

# Устанавливаем рабочую директорию в контейнере
WORKDIR /app

# Копируем go.mod и go.sum для установки зависимостей
COPY go.mod ./

# Устанавливаем зависимости
RUN go mod download

# Копируем все файлы проекта
COPY . .


# Собираем приложение
RUN go build -o server ./cmd/server

# Открываем порт 44044
EXPOSE 44044

# Запускаем приложение
ENTRYPOINT ["/app/server"]
CMD ["--config=/app/config/prod.yaml"]