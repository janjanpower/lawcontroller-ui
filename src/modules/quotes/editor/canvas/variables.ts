export type VariableDef = { key: string; label: string };

export const CASE_VARS: VariableDef[] = [
  { key: "case.number", label: "案件編號" },
  { key: "case.client_name", label: "客戶姓名" },
  { key: "case.court", label: "法院" },
  // ❌ 移除「最新階段名稱」「最新階段日期」
];

export const FIRM_VARS: VariableDef[] = [
  { key: "firm.name", label: "事務所名稱" },
];

export const SYS_VARS: VariableDef[] = [
  { key: "sys.now", label: "今天日期(YYYY-MM-DD)" },
];

// 注意：這裡只合併固定變數
export const BASE_VARS = [...CASE_VARS, ...FIRM_VARS, ...SYS_VARS];

export function insertVar(template: string, varKey: string) {
  // 在當前游標點插入 {{varKey}}（目前先簡單附加在字串最後）
  return template + `{{${varKey}}}`;
}
