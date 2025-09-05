# ---- Build Stage ----
FROM node:20-alpine AS builder
WORKDIR /app

# 安裝依賴
COPY package*.json ./
RUN npm install

# 複製程式碼並執行 build
COPY . .
RUN npm run build

# ---- Production Stage ----
FROM nginx:alpine
WORKDIR /usr/share/nginx/html

# 清掉預設的 index.html
RUN rm -rf ./*

# 從 build stage 複製 dist
COPY --from=builder /app/dist ./

# 複製自訂的 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
