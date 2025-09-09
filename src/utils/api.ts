// src/utils/api.ts

export async function apiFetch(url: string, init: RequestInit = {}) {
  // 轉成完整 URL（支援相對路徑）
  const u = new URL(url, window.location.origin);

  // 只對自己家的 /api/* 自動帶 firm_code
  if (u.pathname.startsWith('/api/')) {
    const fc = getFirmCodeOrThrow();
    if (!u.searchParams.has('firm_code')) {
      u.searchParams.set('firm_code', fc);
    }
  }

  const headers = new Headers(init.headers || {});
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const token = localStorage.getItem('token');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  return fetch(u.toString(), { ...init, headers });
}


// 檢查是否有登入 token
export function hasAuthToken(): boolean {
  const token = localStorage.getItem('auth_token');
  const firmCode = localStorage.getItem('law_firm_code');
  const userId = localStorage.getItem('law_user_id');

  // 需要有基本的登入資訊
  return !!(token && firmCode && userId);
}

// 檢查是否完整登入（包含用戶選擇）
export function isFullyLoggedIn(): boolean {
  const token = localStorage.getItem('auth_token');
  const firmCode = localStorage.getItem('law_firm_code');
  const userId = localStorage.getItem('law_user_id');
  const userName = localStorage.getItem('law_user_name');

  return !!(token && firmCode && userId && userName);
}

// 清除登入狀態並跳轉
export function clearLoginAndRedirect(): void {
  localStorage.removeItem('law_user_id');
  localStorage.removeItem('law_user_name');
  localStorage.removeItem('law_user_role');
  localStorage.removeItem('law_last_login');
  localStorage.removeItem('auth_token');
  localStorage.removeItem('law_firm_code');

  // 只在不是登入頁面時才跳轉
  if (!window.location.pathname.includes('/login')) {
    window.location.replace('/login');
  }
}

// 取得事務所代碼，找不到時清除登入狀態並跳轉
export function getFirmCodeOrThrow(): string {
  const fc = localStorage.getItem('firm_code')?.trim();
  if (!fc) {
    throw new Error('firm_code 缺失，請重新登入');
  }
  return fc; // 允許像 26134402red 這種含字母
}

// 初始化應用程式狀態
export async function initializeAppState(): Promise<boolean> {
  const token = localStorage.getItem('auth_token');
  const firmCode = localStorage.getItem('law_firm_code');
  const userId = localStorage.getItem('law_user_id');

  if (!token || !firmCode) {
    console.log('缺少基本登入資訊:', { hasToken: !!token, hasFirmCode: !!firmCode });
    return false;
  }

  // 如果沒有用戶資訊，表示還在登入流程中，不算完整登入
  if (!userId) {
    console.log('尚未完成用戶選擇，跳過狀態驗證');
    return true; // 允許繼續，但不驗證 API
  }

  try {
    // 驗證 token 是否有效（使用健康檢查）
    const response = await apiFetch('/api/healthz');
    if (response.ok) {
      console.log('API 連線正常');
      return true;
    } else {
      console.log('API 連線失敗，清除登入狀態');
      clearLoginAndRedirect();
      return false;
    }
  } catch (error) {
    console.log('API 連線錯誤，清除登入狀態:', error);
    clearLoginAndRedirect();
    return false;
  }
}

// 假設已經有 BASE_URL 與帶 Token 的 fetch
export async function updateCase(caseId: string, payload: any) {
  const res = await fetch(`/api/cases/${caseId}`, {
    method: 'PUT', // 或 PATCH 依你的後端路由而定
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || '更新案件失敗');
  }
  return res.json();
}
