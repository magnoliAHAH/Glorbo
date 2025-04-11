FROM ubuntu:24.04

# Копирование Nginx deb пакетов
COPY nginx* /tmp

# Установка зависимостей
RUN apt update && apt install -y\
    libbrotli1 \
    openssl \
    certbot 

# Изменение прав на пакеты
RUN chmod 755 /tmp/nginx*

# Установка .deb пакетов
RUN dpkg -i /tmp/*.deb

# Создаём необходимую директорию для PID файла
RUN mkdir -p /var/run/nginx

# Копируем конфигурационные файлы
COPY nginx.conf /etc/nginx/nginx.conf
RUN chmod 755 /etc/nginx/nginx.conf
# Создаём структуру каталогов для веб-сайта
RUN mkdir -p /var/www/supreme-roulette.work.gd/html
# Копируем конфиг для сайта
RUN mkdir -p /etc/nginx/sites-available/ && \
    mkdir -p /etc/nginx/sites-enabled/
COPY supreme-roulette.work.gd.conf /etc/nginx/sites-available/supreme-roulette.work.gd.conf

# Создаём символическую ссылку для активации сайта
RUN ln -s /etc/nginx/sites-available/supreme-roulette.work.gd.conf /etc/nginx/sites-enabled/

# Создаём структуру каталогов для хранения сертификатов
RUN mkdir -p /etc/letsencrypt/live /etc/letsencrypt/archive /etc/letsencrypt/certbot

# CERTIFICATION
RUN mkdir -p /etc/nginx/snippets/
COPY ssl-params.conf /etc/nginx/snippets/ssl-params.conf

# Открываем порты для HTTP и HTTPS
EXPOSE 80 443

# Запуск Nginx в контейнере
CMD ["nginx", "-g", "daemon off;"]
