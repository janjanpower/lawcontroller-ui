FROM node:18-alpine

# 設定工作目錄
WORKDIR /app

# 複製 package.json 和 package-lock.json
COPY package*.json ./

# 安裝依賴
RUN npm ci --only=production

# 複製應用程式碼
COPY . .

# 建立非 root 用戶
RUN addgroup -g 1001 -S nodejs
RUN adduser -S linebot -u 1001

# 變更檔案擁有者
RUN chown -R linebot:nodejs /app
USER linebot

# 暴露端口
EXPOSE 3001

# 設定環境變數
ENV NODE_ENV=production
ENV PORT=3001

# 啟動應用
CMD ["npm", "start"]