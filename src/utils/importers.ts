// src/utils/importers.ts
export type ImportedCase = {
  type: '刑事' | '民事' | '未知';
  title: string;
  fields: Record<string, any>;
};

const CRIMINAL_HINTS = ['刑事', '公訴', '偵字', '訴字', '易字'];
const CIVIL_HINTS    = ['民事', '民訴', '民調', '家事', '家調'];
const KEYWORDS       = ['案由','案號','當事人','原告','被告','上訴人','被上訴人','告訴人','被告人','對造'];

type XLSXType = typeof import('xlsx');
let xlsxPromise: Promise<XLSXType> | null = null;
async function getXLSX(): Promise<XLSXType> {
  if (!xlsxPromise) xlsxPromise = import('xlsx') as Promise<XLSXType>;
  return xlsxPromise;
}

function detectSheetType(name: string, sampleText: string): '刑事' | '民事' | '未知' {
  const hay = `${name} ${sampleText}`.toLowerCase();
  const has = (arr: string[]) => arr.some(k => hay.includes(k.toLowerCase()));
  if (has(CRIMINAL_HINTS)) return '刑事';
  if (has(CIVIL_HINTS)) return '民事';
  return '未知';
}

function buildTitleRow(row: Record<string, any>) {
  const grabs = KEYWORDS.map(k => row[k]).filter(Boolean).slice(0, 3);
  return grabs.join(' / ');
}

export async function parseExcelToCases(file: File): Promise<ImportedCase[]> {
  const XLSX = await getXLSX();
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });

  const results: ImportedCase[] = [];

  wb.SheetNames.forEach((sheetName) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return;

    const json: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
    if (!json.length) return;

    const sampleText = JSON.stringify(json[0]);
    const sheetType = detectSheetType(sheetName, sampleText);

    json.forEach((row) => {
      const title = buildTitleRow(row) || (row['案由'] || row['案號'] || row['當事人'] || '未命名案件');
      results.push({ type: sheetType, title, fields: row });
    });
  });

  return results;
}
