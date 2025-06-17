FROM node:18-alpine

# Рабочая директория внутри контейнера
WORKDIR /app

# Копируем package.json и lock-файл из подкаталога
COPY frontend/package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем все файлы фронтенда
COPY frontend/. ./

# Собираем фронт
RUN npm run build

# Используем nginx для отдачи статики
FROM nginx:alpine
COPY --from=0 /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
