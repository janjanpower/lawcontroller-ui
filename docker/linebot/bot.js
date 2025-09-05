const express = require('express');
const line = require('@line/bot-sdk');
const { Pool } = require('pg');
const axios = require('axios');
const moment = require('moment');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// LINE Bot 設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);

// 資料庫連接
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'law_management_system',
  user: process.env.DB_USER || 'law_admin',
  password: process.env.DB_PASSWORD || 'law_password_2024',
});

// 中間件
app.use('/webhook', line.middleware(config));

// 健康檢查
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'LINE Bot',
    timestamp: new Date().toISOString()
  });
});

// 處理 LINE 事件
app.post('/webhook', (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error('Webhook error:', err);
      res.status(500).end();
    });
});

// 事件處理函數
async function handleEvent(event) {
  if (event.type !== 'message' && event.type !== 'follow') {
    return Promise.resolve(null);
  }

  const userId = event.source.userId;

  try {
    // 處理用戶加入事件
    if (event.type === 'follow') {
      return handleFollowEvent(userId);
    }

    // 處理訊息事件
    if (event.type === 'message') {
      return handleMessageEvent(event, userId);
    }

  } catch (error) {
    console.error('Handle event error:', error);
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '系統發生錯誤，請稍後再試。'
    });
  }
}

// 處理用戶加入事件
async function handleFollowEvent(userId) {
  const welcomeMessage = {
    type: 'text',
    text: `歡迎加入法律事務所官方帳號！🏛️

請提供以下資料完成註冊：
1️⃣ 姓名
2️⃣ 電話號碼
3️⃣ 身分證字號

格式範例：
註冊 張三 0912345678 A123456789

完成註冊後，您可以：
📋 查詢案件進度
📁 上傳相關文件
💬 與律師即時溝通

如需協助，請輸入「幫助」`
  };

  return client.pushMessage(userId, welcomeMessage);
}

// 處理訊息事件
async function handleMessageEvent(event, userId) {
  const messageText = event.message.text;

  // 檢查用戶是否已註冊
  const customer = await getCustomerByLineId(userId);

  if (!customer) {
    // 未註冊用戶
    return handleUnregisteredUser(event, userId, messageText);
  } else {
    // 已註冊用戶
    return handleRegisteredUser(event, customer, messageText);
  }
}

// 處理未註冊用戶
async function handleUnregisteredUser(event, userId, messageText) {
  if (messageText.startsWith('註冊')) {
    return handleRegistration(event, userId, messageText);
  }

  const helpMessage = {
    type: 'text',
    text: `您尚未完成註冊，請先提供註冊資料：

格式：註冊 姓名 電話 身分證字號
範例：註冊 張三 0912345678 A123456789

如需協助，請聯繫事務所人員。`
  };

  return client.replyMessage(event.replyToken, helpMessage);
}

// 處理註冊
async function handleRegistration(event, userId, messageText) {
  const parts = messageText.split(' ');
  
  if (parts.length !== 4) {
    const errorMessage = {
      type: 'text',
      text: '註冊格式錯誤，請使用：\n註冊 姓名 電話 身分證字號'
    };
    return client.replyMessage(event.replyToken, errorMessage);
  }

  const [, name, phone, idNumber] = parts;

  try {
    // 生成驗證碼
    const verificationCode = Math.random().toString().substr(2, 6);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30分鐘後過期

    // 儲存驗證資料（這裡假設使用第一個事務所）
    const firmResult = await pool.query('SELECT id FROM law_firms LIMIT 1');
    const firmId = firmResult.rows[0]?.id;

    if (!firmId) {
      throw new Error('找不到事務所資料');
    }

    await pool.query(
      `INSERT INTO customer_verifications 
       (firm_id, line_user_id, verification_code, name, phone, id_number, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [firmId, userId, verificationCode, name, phone, idNumber, expiresAt]
    );

    const successMessage = {
      type: 'text',
      text: `註冊資料已提交！✅

您的資料：
👤 姓名：${name}
📞 電話：${phone}
🆔 身分證：${idNumber}

驗證碼：${verificationCode}

請將驗證碼提供給事務所人員進行身份確認。
驗證碼將在30分鐘後失效。`
    };

    return client.replyMessage(event.replyToken, successMessage);

  } catch (error) {
    console.error('Registration error:', error);
    const errorMessage = {
      type: 'text',
      text: '註冊失敗，請稍後再試或聯繫事務所人員。'
    };
    return client.replyMessage(event.replyToken, errorMessage);
  }
}

// 處理已註冊用戶
async function handleRegisteredUser(event, customer, messageText) {
  const lowerText = messageText.toLowerCase();

  if (lowerText.includes('案件') || lowerText.includes('進度')) {
    return handleCaseInquiry(event, customer);
  }

  if (lowerText.includes('幫助') || lowerText.includes('help')) {
    return handleHelpRequest(event);
  }

  // 預設回應
  const defaultMessage = {
    type: 'text',
    text: `您好 ${customer.name}！👋

請選擇您需要的服務：
📋 查詢案件進度
📁 上傳文件
💬 聯繫律師
❓ 幫助

請直接輸入關鍵字，例如：「案件進度」`
  };

  return client.replyMessage(event.replyToken, defaultMessage);
}

// 處理案件查詢
async function handleCaseInquiry(event, customer) {
  try {
    const casesQuery = `
      SELECT c.case_id, c.case_type, c.case_reason, c.current_stage, c.status,
             cs.stage_name, cs.stage_date, cs.notes
      FROM cases c
      LEFT JOIN case_stages cs ON c.id = cs.case_id
      WHERE c.customer_id = $1 AND c.status = 'active'
      ORDER BY c.created_at DESC, cs.stage_date DESC
    `;

    const result = await pool.query(casesQuery, [customer.id]);

    if (result.rows.length === 0) {
      const noDataMessage = {
        type: 'text',
        text: '目前沒有進行中的案件資料。\n如有疑問，請聯繫事務所人員。'
      };
      return client.replyMessage(event.replyToken, noDataMessage);
    }

    // 組織案件資料
    const cases = {};
    result.rows.forEach(row => {
      if (!cases[row.case_id]) {
        cases[row.case_id] = {
          case_id: row.case_id,
          case_type: row.case_type,
          case_reason: row.case_reason,
          current_stage: row.current_stage,
          status: row.status,
          stages: []
        };
      }
      
      if (row.stage_name) {
        cases[row.case_id].stages.push({
          name: row.stage_name,
          date: row.stage_date,
          notes: row.notes
        });
      }
    });

    let messageText = `📋 您的案件進度：\n\n`;

    Object.values(cases).forEach(caseData => {
      messageText += `🔹 案件編號：${caseData.case_id}\n`;
      messageText += `📝 案件類型：${caseData.case_type}\n`;
      messageText += `⚖️ 案由：${caseData.case_reason || '未設定'}\n`;
      messageText += `📍 目前階段：${caseData.current_stage}\n`;
      
      if (caseData.stages.length > 0) {
        messageText += `\n📅 進度記錄：\n`;
        caseData.stages.slice(0, 3).forEach(stage => {
          const date = stage.date ? moment(stage.date).format('MM/DD') : '未設定';
          messageText += `  • ${stage.name} (${date})\n`;
        });
      }
      
      messageText += `\n`;
    });

    messageText += `如需更詳細資訊，請聯繫您的承辦律師。`;

    const caseMessage = {
      type: 'text',
      text: messageText
    };

    return client.replyMessage(event.replyToken, caseMessage);

  } catch (error) {
    console.error('Case inquiry error:', error);
    const errorMessage = {
      type: 'text',
      text: '查詢案件資料時發生錯誤，請稍後再試。'
    };
    return client.replyMessage(event.replyToken, errorMessage);
  }
}

// 處理幫助請求
async function handleHelpRequest(event) {
  const helpMessage = {
    type: 'text',
    text: `📖 使用說明：

🔍 查詢功能：
• 輸入「案件」或「進度」查看案件狀態
• 輸入「幫助」查看此說明

📁 文件上傳：
• 直接傳送圖片或檔案
• 系統會自動歸檔到您的案件中

💬 聯繫方式：
• 事務所電話：02-1234-5678
• 緊急聯絡：0912-345-678
• 營業時間：週一至週五 9:00-18:00

如有其他問題，請直接聯繫事務所人員。`
  };

  return client.replyMessage(event.replyToken, helpMessage);
}

// 輔助函數：根據 LINE ID 取得客戶資料
async function getCustomerByLineId(lineUserId) {
  try {
    const result = await pool.query(
      'SELECT * FROM customers WHERE line_user_id = $1 AND status = $2',
      [lineUserId, 'active']
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Get customer error:', error);
    return null;
  }
}

// 啟動伺服器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🤖 LINE Bot 已啟動`);
  console.log(`📡 端口: ${PORT}`);
  console.log(`🌍 環境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Webhook: http://localhost:${PORT}/webhook`);
});

// 優雅關閉
process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信號，正在關閉 LINE Bot...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('收到 SIGINT 信號，正在關閉 LINE Bot...');
  process.exit(0);
});