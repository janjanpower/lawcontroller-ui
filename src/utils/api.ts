// src/utils/id.ts
export const isUUID = (v: string) => /^[0-9a-fA-F-]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v);
// src/utils/api.ts
export function getFirmCodeOrThrow(): string {
  const v = localStorage.getItem('law_firm_code') || '';
  if (!v) throw new Error('找不到事務所代碼 (law_firm_code)');
  return v;
}

// 自動把 firm_code 掛在所有 /api/ 請求上
export async function apiFetch(input: string, init?: RequestInit) {
  const url = new URL(input, window.location.origin);
  if (url.pathname.startsWith('/api/')) {
    const firm = getFirmCodeOrThrow();
    if (!url.searchParams.has('firm_code')) {
      url.searchParams.set('firm_code', firm);
    }
  }
  return fetch(url.toString(), init);
}
