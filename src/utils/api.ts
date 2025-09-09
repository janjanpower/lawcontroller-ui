// src/utils/api.ts
export async function apiFetch(path: string, init?: RequestInit) {
  const token = localStorage.getItem('auth_token');
  const headers = new Headers(init?.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(path, { ...init, headers });

  if (res.status === 401) {
    // 統一過期行為：讓上層顯示「請重新登入」
    localStorage.removeItem('auth_token');
    throw new Error('登入狀態已過期，請重新登入');
  }
  return res;
}

// 檢查是否有登入 token
export function hasAuthToken(): boolean {
  return !!localStorage.getItem('auth_token');
}

// 清除登入狀態並跳轉
export function clearLoginAndRedirect(): void {
  localStorage.removeItem('law_user_id');
  localStorage.removeItem('law_user_name');
  localStorage.removeItem('law_user_role');
  localStorage.removeItem('law_last_login');
  localStorage.removeItem('auth_token');
  
  // 只在不是登入頁面時才跳轉
  if (!window.location.pathname.includes('/login')) {
    window.location.replace('/login');
  }
}