# Используем официальный образ Go
FROM golang:1.24-alpine

# Устанавливаем рабочую директорию в контейнере
WORKDIR /app

RUN apk add --no-cache git ca-certificates
# Копируем go.mod и go.sum для установки зависимостей
COPY go.mod ./

# Устанавливаем зависимости
RUN go mod download

# Копируем все файлы проекта
COPY . .

COPY ./certs /app/certs

# Собираем приложение
RUN go build -o main .

# Открываем порт 8080
EXPOSE 8080

# Запускаем приложение
CMD ["./main"]