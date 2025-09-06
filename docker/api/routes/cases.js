const express = require('express');
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

// 驗證中間件
const authenticateToken = require('../middleware/auth');

// 案件驗證 schema
const caseSchema = Joi.object({
  customer_id: Joi.string().uuid().required(),
  case_id: Joi.string().required(),
  case_type: Joi.string().valid('民事', '刑事', '行政', '家事', '商事').required(),
  case_reason: Joi.string().optional(),
  case_number: Joi.string().optional(),
  opposing_party: Joi.string().optional(),
  court: Joi.string().optional(),
  division: Joi.string().optional(),
  lawyer_id: Joi.string().uuid().optional(),
  legal_affairs_id: Joi.string().uuid().optional()
});

// 取得案件列表
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, status = 'active', search } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        c.*,
        cu.name as customer_name,
        cu.phone as customer_phone,
        l.full_name as lawyer_name,
        la.full_name as legal_affairs_name
      FROM cases c
      LEFT JOIN customers cu ON c.customer_id = cu.id
      LEFT JOIN firm_users l ON c.lawyer_id = l.id
      LEFT JOIN firm_users la ON c.legal_affairs_id = la.id
      WHERE c.firm_id = $1
    `;

    const params = [req.user.firmId];
    let paramIndex = 2;

    // 狀態篩選
    if (status !== 'all') {
      query += ` AND c.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // 搜尋功能
    if (search) {
      query += ` AND (
        c.case_id ILIKE $${paramIndex} OR
        cu.name ILIKE $${paramIndex} OR
        c.case_reason ILIKE $${paramIndex} OR
        c.case_number ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY c.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // 取得總數
    let countQuery = `
      SELECT COUNT(*) 
      FROM cases c
      LEFT JOIN customers cu ON c.customer_id = cu.id
      WHERE c.firm_id = $1
    `;
    const countParams = [req.user.firmId];
    let countParamIndex = 2;

    if (status !== 'all') {
      countQuery += ` AND c.status = $${countParamIndex}`;
      countParams.push(status);
      countParamIndex++;
    }

    if (search) {
      countQuery += ` AND (
        c.case_id ILIKE $${countParamIndex} OR
        cu.name ILIKE $${countParamIndex} OR
        c.case_reason ILIKE $${countParamIndex} OR
        c.case_number ILIKE $${countParamIndex}
      )`;
      countParams.push(`%${search}%`);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get cases error:', error);
    res.status(500).json({ error: '取得案件列表失敗' });
  }
});

// 取得單一案件
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        c.*,
        cu.name as customer_name,
        cu.phone as customer_phone,
        cu.email as customer_email,
        l.full_name as lawyer_name,
        la.full_name as legal_affairs_name
      FROM cases c
      LEFT JOIN customers cu ON c.customer_id = cu.id
      LEFT JOIN firm_users l ON c.lawyer_id = l.id
      LEFT JOIN firm_users la ON c.legal_affairs_id = la.id
      WHERE c.id = $1 AND c.firm_id = $2
    `;

    const result = await pool.query(query, [id, req.user.firmId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '案件不存在' });
    }

    // 取得案件階段
    const stagesQuery = `
      SELECT * FROM case_stages 
      WHERE case_id = $1 
      ORDER BY stage_date ASC, created_at ASC
    `;
    const stagesResult = await pool.query(stagesQuery, [id]);

    const caseData = {
      ...result.rows[0],
      stages: stagesResult.rows
    };

    res.json({
      success: true,
      data: caseData
    });

  } catch (error) {
    console.error('Get case error:', error);
    res.status(500).json({ error: '取得案件失敗' });
  }
});

// 新增案件
router.post('/', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    // 驗證輸入
    const { error, value } = caseSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    await client.query('BEGIN');

    // 檢查案件編號是否已存在
    const existingCase = await client.query(
      'SELECT id FROM cases WHERE case_id = $1',
      [value.case_id]
    );

    if (existingCase.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: '案件編號已存在' });
    }

    // 新增案件
    const insertQuery = `
      INSERT INTO cases (
        firm_id, customer_id, case_id, case_type, case_reason, 
        case_number, opposing_party, court, division, 
        lawyer_id, legal_affairs_id, current_stage
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, '委任')
      RETURNING *
    `;

    const insertResult = await client.query(insertQuery, [
      req.user.firmId,
      value.customer_id,
      value.case_id,
      value.case_type,
      value.case_reason,
      value.case_number,
      value.opposing_party,
      value.court,
      value.division,
      value.lawyer_id,
      value.legal_affairs_id
    ]);

    const newCase = insertResult.rows[0];

    // 建立預設資料夾結構
    const defaultFolders = [
      { name: '狀紙', path: '/狀紙', type: 'default' },
      { name: '案件資訊', path: '/案件資訊', type: 'default' },
      { name: '進度追蹤', path: '/進度追蹤', type: 'default' }
    ];

    for (const folder of defaultFolders) {
      await client.query(
        'INSERT INTO case_folders (case_id, folder_name, folder_path, folder_type) VALUES ($1, $2, $3, $4)',
        [newCase.id, folder.name, folder.path, folder.type]
      );
    }

    // 新增預設階段
    await client.query(
      'INSERT INTO case_stages (case_id, stage_name, stage_date, is_completed) VALUES ($1, $2, $3, $4)',
      [newCase.id, '委任', new Date().toISOString().split('T')[0], true]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      data: newCase
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create case error:', error);
    res.status(500).json({ error: '新增案件失敗' });
  } finally {
    client.release();
  }
});

// 更新案件
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // 建立動態更新查詢
    const allowedFields = [
      'case_reason', 'case_number', 'opposing_party', 'court', 
      'division', 'lawyer_id', 'legal_affairs_id', 'current_stage'
    ];

    const setClause = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClause.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (setClause.length === 0) {
      return res.status(400).json({ error: '沒有有效的更新欄位' });
    }

    setClause.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id, req.user.firmId);

    const query = `
      UPDATE cases 
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex} AND firm_id = $${paramIndex + 1}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '案件不存在' });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Update case error:', error);
    res.status(500).json({ error: '更新案件失敗' });
  }
});

// 刪除案件
router.delete('/:id', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // 檢查案件是否存在
    const caseCheck = await client.query(
      'SELECT id FROM cases WHERE id = $1 AND firm_id = $2',
      [id, req.user.firmId]
    );

    if (caseCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: '案件不存在' });
    }

    // 刪除相關資料（由於設定了 CASCADE，會自動刪除）
    await client.query('DELETE FROM cases WHERE id = $1', [id]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: '案件已刪除'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete case error:', error);
    res.status(500).json({ error: '刪除案件失敗' });
  } finally {
    client.release();
  }
});

module.exports = router;