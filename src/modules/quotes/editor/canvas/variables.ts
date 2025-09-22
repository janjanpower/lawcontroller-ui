export type VariableDef = { key: string; label: string };

export const CASE_VARS: VariableDef[] = [
  { key: "case.number", label: "案件編號" },
  { key: "case.client_name", label: "客戶姓名" },
  { key: "case.court", label: "法院" },
];

export const FIRM_VARS: VariableDef[] = [
  { key: "firm.name", label: "事務所名稱" },
];

export const SYS_VARS: VariableDef[] = [
  { key: "sys.now", label: "今天日期(YYYY-MM-DD)" },
];

export const STAGE_VARS: VariableDef[] = [
  { key: "stages.current.name", label: "目前階段名稱" },
  { key: "stages.current.date", label: "目前階段日期" },
  { key: "stages.last.name", label: "上一階段名稱" },
  { key: "stages.last.date", label: "上一階段日期" },
];

export const ALL_VARS = [...CASE_VARS, ...FIRM_VARS, ...STAGE_VARS, ...SYS_VARS];

export function insertVar(template: string, varKey: string) {
  // 在當前游標點插入 {{varKey}}（前端會把它貼回對應欄位）
  return template + `{{${varKey}}}`;
}
