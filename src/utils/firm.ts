export function getFirmCodeOrThrow(): string {
  const code = localStorage.getItem('law_firm_code');
  if (!code) {
    console.warn('找不到事務所代碼，可能需要重新登入');
    return '';
  }
  return code;
}