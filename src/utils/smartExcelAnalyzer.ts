// src/utils/smartExcelAnalyzer.ts
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

const HEADER_CANONICAL: Record<string, keyof AnalyzedCase> = {
  '案件類型': 'case_type',
  '案由': 'case_reason',
  '案號': 'case_number',
  '字號': 'case_number',
  '當事人': 'client',
  '客戶': 'client',
  '律師': 'lawyer',
  '法務': 'legal_affairs',
  '對造': 'opposing_party',
  '法院': 'court',
  '股別': 'division',
  '進度': 'progress',
  '進度日期': 'progress_date',
  '日期': 'progress_date',
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
  let bestRow = 0;
  let bestScore = -1;
  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const row = rows[r] || [];
    const score = row.reduce((acc: number, cell: any) => {
      const name = String(cell || '').trim();
      return acc + (HEADER_CANONICAL[name] ? 1 : 0);
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      bestRow = r;
    }
    if (score >= 3) return r;
  }
  return bestRow;
};

const buildHeaderMap = (header: any[]): Record<number, keyof AnalyzedCase> => {
  const map: Record<number, keyof AnalyzedCase> = {};
  header.forEach((cell, i) => {
    const name = String(cell || '').trim();
    if (HEADER_CANONICAL[name]) map[i] = HEADER_CANONICAL[name];
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
