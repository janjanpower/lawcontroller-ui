// src/utils/id.ts
export const isUUID = (v: string) => /^[0-9a-fA-F-]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v);
// src/utils/api.ts
export function getFirmCodeOrThrow(): string {
  const firmCode = localStorage.getItem('law_firm_code');
  if (!firmCode) {
    throw new Error('登入狀態已過期，請重新登入');
  }
  return firmCode;
}

// 檢查是否已登入（不會自動跳轉）
export function isLoggedIn(): boolean {
  const userId = localStorage.getItem('law_user_id');
  const firmCode = localStorage.getItem('law_firm_code');
  return !!(userId && firmCode);
}

// 清除登入狀態並跳轉
export function clearLoginAndRedirect(): void {
  localStorage.removeItem('law_user_id');
  localStorage.removeItem('law_user_name');
  localStorage.removeItem('law_firm_id');
  localStorage.removeItem('law_firm_code');
  localStorage.removeItem('law_user_role');
  localStorage.removeItem('law_last_login');

  // 只在不是登入頁面時才跳轉
  if (!window.location.pathname.includes('/login')) {
    window.location.replace('/login');
  }
}

// 自動把 firm_code 掛在所有 /api/ 請求上
export async function apiFetch(path: string, init?: RequestInit) {
  // 檢查登入狀態（但不自動跳轉）
  if (!isLoggedIn()) {
    throw new Error('登入狀態已過期，請重新登入');
  }

  const headers = new Headers(init?.headers || {});
  headers.set('Content-Type', 'application/json');

  // 如果有 auth token 就加入（目前系統可能還沒實現 JWT）
  const token = localStorage.getItem('auth_token');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const response = await fetch(path, { ...init, headers });

    // 如果是 401 或 403 錯誤，可能是登入狀態過期
    if (response.status === 401 || response.status === 403) {
      clearLoginAndRedirect();
      throw new Error('登入狀態已過期，請重新登入');
    }

    return response;
  } catch (error) {
    // 如果是網路錯誤且不在登入頁面，可能需要重新登入
    if (error.message.includes('fetch') && !window.location.pathname.includes('/login')) {
      console.warn('網路請求失敗，可能需要重新登入');
    }
    throw error;
  }
}
