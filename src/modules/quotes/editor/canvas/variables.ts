export type VariableDef = { key: string; label: string; value?: string };

export const CASE_VARS: VariableDef[] = [
  { key: "case.number", label: "案件編號" },
  { key: "case.client_name", label: "客戶姓名" },
  { key: "case.court", label: "法院" },
  { key: "case.lawyer_name", label: "律師姓名" },
  { key: "case.case_type", label: "案件類型" },
  { key: "case.case_reason", label: "案由" },
];

export const FIRM_VARS: VariableDef[] = [
  { key: "firm.name", label: "事務所名稱" },
  { key: "firm.address", label: "事務所地址" },
  { key: "firm.phone", label: "事務所電話" },
  { key: "firm.email", label: "事務所信箱" },
];

export const SYS_VARS: VariableDef[] = [
  { key: "sys.now", label: "今天日期" },
  { key: "sys.year", label: "今年年份" },
  { key: "sys.month", label: "本月月份" },
];

// 基礎變數（不包含階段，階段會動態載入）
export const BASE_VARS = [...CASE_VARS, ...FIRM_VARS, ...SYS_VARS];

export function insertVar(template: string, varKey: string, cursorPos?: number): string {
  const varTag = `{{${varKey}}}`;
  if (cursorPos !== undefined) {
    return template.slice(0, cursorPos) + varTag + template.slice(cursorPos);
  }
  return template + varTag;
}

export function parseVariables(text: string): string[] {
  const matches = text.match(/\{\{([^}]+)\}\}/g);
  return matches ? matches.map(m => m.slice(2, -2)) : [];
}