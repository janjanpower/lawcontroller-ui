const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const caseRoutes = require('./routes/cases');
const customerRoutes = require('./routes/customers');
const fileRoutes = require('./routes/files');
const lineBotRoutes = require('./routes/linebot');

const app = express();
const PORT = process.env.PORT || 3000;

// 安全中間件
app.use(helmet());
app.use(compression());

// CORS 設定
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// 請求限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分鐘
  max: 100, // 限制每個 IP 15 分鐘內最多 100 個請求
  message: '請求過於頻繁，請稍後再試'
});
app.use('/api/', limiter);

// 日誌中間件
app.use(morgan('combined'));

// 解析 JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 健康檢查端點
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/linebot', lineBotRoutes);

// 404 處理
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'API 端點不存在',
    path: req.originalUrl 
  });
});

// 全域錯誤處理
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  
  // 開發環境顯示詳細錯誤
  if (process.env.NODE_ENV === 'development') {
    res.status(err.status || 500).json({
      error: err.message,
      stack: err.stack
    });
  } else {
    // 生產環境只顯示一般錯誤訊息
    res.status(err.status || 500).json({
      error: '伺服器內部錯誤'
    });
  }
});

// 啟動伺服器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 法律案件管理系統 API 已啟動`);
  console.log(`📡 端口: ${PORT}`);
  console.log(`🌍 環境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 健康檢查: http://localhost:${PORT}/health`);
});

// 優雅關閉
process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信號，正在關閉伺服器...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('收到 SIGINT 信號，正在關閉伺服器...');
  process.exit(0);
});