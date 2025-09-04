# 使用較小的 Node 版本，減少映像體積
FROM node:18-alpine AS builder

# 設定工作目錄
WORKDIR /app

# 先複製 package.json / package-lock.json，利用快取
COPY package*.json ./

# 安裝依賴（--legacy-peer-deps 可避免某些 peerDependencies 問題）
RUN npm install --legacy-peer-deps

# 複製其餘程式碼
COPY . .

# 建立 production build
RUN npm run build

# ========================
# 執行階段
# ========================
FROM node:18-alpine AS runner
WORKDIR /app

# 僅複製必要檔案（避免帶入 devDependencies）
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# 預設環境變數
ENV NODE_ENV=production
ENV PORT=3000

# 容器內跑的指令
CMD ["npm", "start"]

# 對外開放 port
EXPOSE 3000
