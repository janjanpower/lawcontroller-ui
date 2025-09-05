# 使用 Node 進行編譯
FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# 使用 Nginx 提供靜態檔案
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html

# 開放 Nginx 的 HTTP port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
