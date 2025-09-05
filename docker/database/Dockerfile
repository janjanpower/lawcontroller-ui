FROM postgres:15-alpine

# 設定環境變數
ENV POSTGRES_DB=law_management_system
ENV POSTGRES_USER=law_admin
ENV POSTGRES_PASSWORD=law_password_2024

# 複製初始化腳本
COPY init.sql /docker-entrypoint-initdb.d/

# 設定時區
RUN apk add --no-cache tzdata
ENV TZ=Asia/Taipei

# 暴露端口
EXPOSE 5432

# 設定資料持久化
VOLUME ["/var/lib/postgresql/data"]