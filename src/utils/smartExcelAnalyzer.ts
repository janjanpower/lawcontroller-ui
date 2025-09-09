// src/utils/smartExcelAnalyzer.ts


// 全形→半形
const toHalfWidth = (s: string) =>
  s.replace(/[\uFF01-\uFF5E]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)).replace(/\u3000/g, ' ');

// 標題正規化：去空白→全轉半形→移除空白/冒號等→小寫
const normalizeHeader = (s: any) =>
  String(s ?? '')
    .trim()
    ? toHalfWidth(String(s))
        .trim()
        .replace(/[:：\s\-/_.]/g, '')
        .toLowerCase()
    : '';

// 簡易 Levenshtein（容忍 1~2 個字差）
const lev = (a: string, b: string) => {
  const m = a.length, n = b.length;
  if (m === 0) return n; if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
};
const sim = (a: string, b: string) => {
  const d = lev(a, b);
  return 1 - d / Math.max(1, a.length, b.length); // 0~1
};

export type AnalyzedCase = {
  case_type?: string | null;
  client?: string | null;
  lawyer?: string | null;
  legal_affairs?: string | null;
  case_reason?: string | null;
  case_number?: string | null;
  opposing_party?: string | null;
  court?: string | null;
  division?: string | null;
  progress?: string | null;
  progress_date?: string | null; // YYYY-MM-DD
};

type SheetResult = {
  sheetName: string;
  headerRow: number;
  rows: any[][];
  cases: AnalyzedCase[];
  warnings: string[];
};


// 支援更寬鬆的標題比對：同義詞、關鍵字、正則
type Key = keyof AnalyzedCase;
const FLEX_HEADERS: Record<Key, { synonyms: string[]; keywords?: string[]; patterns?: RegExp[] }> = {
  case_type: {
    synonyms: ['案件類型', '類型', '案類', '案件分類'],
    keywords: ['類型', '案類', '分類'],
  },
  case_reason: {
    synonyms: ['案由', '案情', '事由', '案件事由'],
    keywords: ['案由', '事由'],
  },
  case_number: {
    synonyms: ['案號', '字號', '案件編號', '案件號'],
    keywords: ['案', '字號', '編號'],
  },
  client: {
    synonyms: ['當事人', '客戶', '委任人', '委託人', '原告', '被告'],
    keywords: ['當事', '客戶', '委任', '委託', '當事人姓名'],
  },
  lawyer: {
    synonyms: ['律師', '負責律師', '主辦律師', '承辦律師'],
    keywords: ['律師'],
  },
  legal_affairs: {
    synonyms: ['法務', '承辦法務', '負責法務'],
    keywords: ['法務'],
  },
  opposing_party: {
    synonyms: ['對造', '對造當事人', '相對人'],
    keywords: ['對造', '相對'],
  },
  court: {
    synonyms: ['法院', '負責法院', '法院名稱'],
    keywords: ['法院'],
  },
  division: {
    synonyms: ['股別', '庭別', '承辦股別'],
    keywords: ['股', '庭'],
  },
  progress: {
    synonyms: ['進度', '案件進度', '委任進度'],
    keywords: ['進度'],
  },
  progress_date: {
    synonyms: ['進度日期', '日期', '開庭日期', '收文日期'],
    keywords: ['日期', '開庭', '收文'],
    patterns: [/^\s*(日期|日期\(進度\))\s*$/i],
  },
};


const isDateLike = (v: any) => {
  if (v === 0) return true;
  if (!v) return false;
  if (typeof v === 'number') return true;
  if (typeof v === 'string')
    return /\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(v) || /^\d{8}$/.test(v);
  return false;
};

const normalizeDate = (XLSX: any, v: any) => {
  if (v == null || v === '') return null;
  try {
    if (typeof v === 'number') {
      const d = XLSX.SSF.parse_date_code(v);
      if (!d) return null;
      const mm = String(d.m).padStart(2, '0');
      const dd = String(d.d).padStart(2, '0');
      return `${d.y}-${mm}-${dd}`;
    }
    if (typeof v === 'string') {
      let s = v.trim().replace(/\./g, '/').replace(/-/g, '/');
      if (/^\d{8}$/.test(s)) s = `${s.slice(0,4)}/${s.slice(4,6)}/${s.slice(6,8)}`;
      const d = new Date(s);
      if (isNaN(d.getTime())) return null;
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  } catch {}
  return null;
};

const toStr = (v: any) => (v == null ? null : String(v).trim() || null);

const detectHeaderRow = (rows: any[][]): number => {
  let bestRow = 0, bestScore = -1;
  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const row = rows[r] || [];
    const score = row.reduce((acc, cell) => acc + (matchHeaderKey(cell).score > 0 ? 1 : 0), 0);
    if (score > bestScore) { bestScore = score; bestRow = r; }
    if (score >= 3) return r; // 超過 3 個已知欄，直接認定
  }
  return bestRow;
};

// 從標題列建立：欄位索引 → 我們資料鍵 的映射
const buildHeaderMap = (headerRowValues: any[]): Record<number, Key> => {
  const map: Record<number, Key> = {};
  headerRowValues.forEach((cell, idx) => {
    const m = matchHeaderKey(cell);
    if (m.key && m.score >= 50) {
      // 若重複映射到相同 key，保留分數較高的那一欄
      const existingIdx = Object.entries(map).find(([_, key]) => key === m.key)?.[0];
      if (existingIdx) {
        const prevScore = matchHeaderKey(headerRowValues[Number(existingIdx)]).score;
        if (m.score > prevScore) { delete map[Number(existingIdx)]; map[idx] = m.key; }
      } else {
        map[idx] = m.key;
      }
    }
  });
  return map;
};

const rowToCase = (XLSX: any, row: any[], map: Record<number, keyof AnalyzedCase>): AnalyzedCase | null => {
  const item: AnalyzedCase = {};
  let hasAny = false;

  Object.entries(map).forEach(([idxStr, key]) => {
    const idx = Number(idxStr);
    const raw = row[idx];
    if (raw == null || String(raw).trim() === '') return;
    hasAny = true;
    if (key === 'progress_date') item[key] = isDateLike(raw) ? normalizeDate(XLSX, raw) : toStr(raw);
    else item[key] = toStr(raw);
  });

  if (!hasAny) return null;
  if (!item.client && !item.case_number && !item.case_reason && !item.case_type) return null;
  if (!item.progress) item.progress = '委任';
  return item;
};

export async function analyzeExcelFile(file: File): Promise<{ cases: AnalyzedCase[]; sheets: SheetResult[] }> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });

  const allCases: AnalyzedCase[] = [];
  const sheets: SheetResult[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
    if (!rows.length) {
      sheets.push({ sheetName, headerRow: 0, rows: [], cases: [], warnings: ['空白工作表'] });
      continue;
    }
    const headerRow = detectHeaderRow(rows);
    const map = buildHeaderMap(rows[headerRow] || []);
    const casesInSheet: AnalyzedCase[] = [];
    const warnings: string[] = [];

    if (Object.keys(map).length === 0) {
      warnings.push('未偵測到已知的表頭欄位，已忽略該工作表。');
    } else {
      for (let r = headerRow + 1; r < rows.length; r++) {
        const item = rowToCase(XLSX, rows[r] || [], map);
        if (item) casesInSheet.push(item);
      }
    }

    allCases.push(...casesInSheet);
    sheets.push({ sheetName, headerRow, rows, cases: casesInSheet, warnings });
  }

  return { cases: allCases, sheets };
}

// 輸入一個標題字串，回傳最可能對應的 key 與分數
function matchHeaderKey(raw: any): { key?: Key; score: number } {
  const name = normalizeHeader(raw);
  if (!name) return { score: 0 };

  let best: { key?: Key; score: number } = { score: 0 };

  for (const [k, cfg] of Object.entries(FLEX_HEADERS) as [Key, (typeof FLEX_HEADERS)[Key]][]) {
    // 1) 同義詞完全相等（最強）
    for (const syn of cfg.synonyms) {
      const s = normalizeHeader(syn);
      if (s === name) {
        return { key: k, score: 100 };
      }
    }
    // 2) 正則
    for (const rx of cfg.patterns || []) {
      if (rx.test(String(raw))) {
        best = best.score < 85 ? { key: k, score: 85 } : best;
      }
    }
    // 3) 關鍵字包含/開頭
    for (const kw of cfg.keywords || []) {
      const s = normalizeHeader(kw);
      if (!s) continue;
      if (name.startsWith(s)) best = best.score < 70 ? { key: k, score: 70 } : best;
      if (name.includes(s))  best = best.score < 60 ? { key: k, score: 60 } : best;
    }
    // 4) 同義詞相似度（容忍小錯字）
    for (const syn of cfg.synonyms) {
      const s = normalizeHeader(syn);
      const score = Math.round(sim(name, s) * 100); // 0~100
      if (score >= 80 && score > best.score) best = { key: k, score };
    }
  }
  return best;
}