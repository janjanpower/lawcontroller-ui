const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const Joi = require('joi');

const router = express.Router();

// 資料庫連接
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'law_management_system',
  user: process.env.DB_USER || 'law_admin',
  password: process.env.DB_PASSWORD || 'law_password_2024',
});

// 驗證 schema
const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required()
});

const registerSchema = Joi.object({
  firm_name: Joi.string().required(),
  firm_code: Joi.string().required(),
  username: Joi.string().required(),
  password: Joi.string().min(6).required(),
  full_name: Joi.string().required(),
  email: Joi.string().email().required(),
  phone: Joi.string().optional()
});

// 登入
router.post('/login', async (req, res) => {
  try {
    // 驗證輸入
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { username, password } = value;

    // 查詢用戶
    const userQuery = `
      SELECT fu.*, lf.firm_name, lf.firm_code 
      FROM firm_users fu
      JOIN law_firms lf ON fu.firm_id = lf.id
      WHERE fu.username = $1 AND fu.is_active = true
    `;
    
    const userResult = await pool.query(userQuery, [username]);
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: '帳號或密碼錯誤' });
    }

    const user = userResult.rows[0];

    // 驗證密碼
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: '帳號或密碼錯誤' });
    }

    // 生成 JWT
    const token = jwt.sign(
      { 
        userId: user.id,
        firmId: user.firm_id,
        username: user.username,
        role: user.role
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        firm_name: user.firm_name,
        firm_code: user.firm_code
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '登入失敗' });
  }
});

// 註冊事務所
router.post('/register', async (req, res) => {
  const client = await pool.connect();
  
  try {
    // 驗證輸入
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { firm_name, firm_code, username, password, full_name, email, phone } = value;

    await client.query('BEGIN');

    // 檢查事務所代碼是否已存在
    const firmCheck = await client.query(
      'SELECT id FROM law_firms WHERE firm_code = $1',
      [firm_code]
    );

    if (firmCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: '事務所代碼已存在' });
    }

    // 檢查用戶名是否已存在
    const userCheck = await client.query(
      'SELECT id FROM firm_users WHERE username = $1',
      [username]
    );

    if (userCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: '用戶名已存在' });
    }

    // 建立事務所
    const firmResult = await client.query(
      'INSERT INTO law_firms (firm_name, firm_code) VALUES ($1, $2) RETURNING id',
      [firm_name, firm_code]
    );

    const firmId = firmResult.rows[0].id;

    // 加密密碼
    const passwordHash = await bcrypt.hash(password, 10);

    // 建立管理員用戶
    await client.query(
      `INSERT INTO firm_users (firm_id, username, password_hash, full_name, role, email, phone) 
       VALUES ($1, $2, $3, $4, 'admin', $5, $6)`,
      [firmId, username, passwordHash, full_name, email, phone]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: '事務所註冊成功'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Register error:', error);
    res.status(500).json({ error: '註冊失敗' });
  } finally {
    client.release();
  }
});

// 驗證 token 中間件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '未提供認證 token' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'token 無效' });
    }
    req.user = user;
    next();
  });
};

// 驗證 token
router.get('/verify', authenticateToken, (req, res) => {
  res.json({ 
    success: true, 
    user: req.user 
  });
});

module.exports = router;