# Используем официальный Node.js образ как базовый
FROM node:20-alpine AS build

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json для установки зависимостей
COPY ./package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем весь проект в контейнер
COPY . .

# Собираем проект
RUN npm run build

# Стартуем новый образ для продакшн
FROM nginx:alpine

# Копируем собранные файлы из предыдущего этапа сборки в директорию Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Изменим дефолтную конфигурацию Nginx, чтобы слушать порт 3000
RUN echo 'server { \
    listen 3000; \
    server_name localhost; \
    location / { \
    root /usr/share/nginx/html; \
    try_files $uri /index.html; \
    } \
    }' > /etc/nginx/conf.d/default.conf

# Открываем порт 3000 для доступа
EXPOSE 3000

# Запуск Nginx в фоновом режиме
CMD ["nginx", "-g", "daemon off;"]