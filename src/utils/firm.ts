export function getFirmCodeOrThrow(): string {
  const code = localStorage.getItem('law_firm_code');
  if (!code) throw new Error('找不到事務所代碼（law_firm_code）。請重新登入並選擇用戶。');
  return code;
}