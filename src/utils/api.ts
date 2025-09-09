// src/utils/id.ts
export const isUUID = (v: string) => /^[0-9a-fA-F-]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v);
// src/utils/api.ts
export function getFirmCodeOrThrow(): string {
  const firmCode = localStorage.getItem('law_firm_code');
  if (!firmCode) {
    // 清除所有登入相關資訊
    localStorage.removeItem('law_user_id');
    localStorage.removeItem('law_user_name');
    localStorage.removeItem('law_firm_id');
    localStorage.removeItem('law_firm_code');
    localStorage.removeItem('law_last_login');
    
    // 跳轉到登入頁面
    window.location.replace('/login');
    throw new Error('登入狀態已過期，請重新登入');
  }
  return firmCode;
}

// 自動把 firm_code 掛在所有 /api/ 請求上
export async function apiFetch(path: string, init?: RequestInit) {
  // 檢查登入狀態
  const userId = localStorage.getItem('law_user_id');
  const firmCode = localStorage.getItem('law_firm_code');
  
  if (!userId || !firmCode) {
    // 清除所有登入相關資訊
    localStorage.removeItem('law_user_id');
    localStorage.removeItem('law_user_name');
    localStorage.removeItem('law_firm_id');
    localStorage.removeItem('law_firm_code');
    localStorage.removeItem('law_last_login');
    
    // 跳轉到登入頁面
    window.location.replace('/login');
    throw new Error('登入狀態已過期，請重新登入');
  }
  
  const headers = new Headers(init?.headers || {});
  headers.set('Content-Type', 'application/json');
  
  // 如果有 auth token 就加入（目前系統可能還沒實現 JWT）
  const token = localStorage.getItem('auth_token');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  return fetch(path, { ...init, headers });
}
