// src/utils/id.ts
export const isUUID = (v: string) => /^[0-9a-fA-F-]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v);
// src/utils/api.ts
export function getFirmCodeOrThrow(): string {
  const v = localStorage.getItem('law_firm_code') || '';
  if (!v) throw new Error('找不到事務所代碼 (law_firm_code)');
  return v;
}

// 自動把 firm_code 掛在所有 /api/ 請求上
export async function apiFetch(path: string, init?: RequestInit) {
  const token = localStorage.getItem('auth_token');
  const headers = new Headers(init?.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(path, { ...init, headers });
}
