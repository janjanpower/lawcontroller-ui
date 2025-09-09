// src/utils/api.ts
export const isUUID = (v: string) => /^[0-9a-fA-F-]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v);

// 檢查是否有基本登入資訊（token 或 firm_code）
export function hasBasicAuth(): boolean {
  const token = localStorage.getItem('auth_token');
  const firmCode = localStorage.getItem('law_firm_code');
  return !!(token || firmCode);
}

// 檢查是否完全登入（包含用戶選擇）
export function isFullyLoggedIn(): boolean {
  const userId = localStorage.getItem('law_user_id');
  const firmCode = localStorage.getItem('law_firm_code');
  return !!(userId && firmCode);
}

// 嘗試取得事務所代碼，如果沒有則嘗試從 API 補齊
export async function getFirmCodeWithFallback(): Promise<string> {
  let firmCode = localStorage.getItem('law_firm_code');
  
  if (firmCode) {
    return firmCode;
  }

  // 如果沒有 firmCode 但有 token，嘗試從 /api/auth/me 取得
  const token = localStorage.getItem('auth_token');
  if (token) {
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.firm && data.firm.firm_code) {
          // 補齊 firm 資訊
          localStorage.setItem('law_firm_code', data.firm.firm_code);
          localStorage.setItem('law_firm_id', data.firm.id);
          localStorage.setItem('law_firm_name', data.firm.firm_name);
          
          return data.firm.firm_code;
        }
      }
    } catch (error) {
      console.warn('無法從 API 取得事務所資訊:', error);
    }
  }

  // 如果都沒有，拋出錯誤
  throw new Error('找不到事務所代碼，請重新登入');
}

// 取得事務所代碼（舊版相容）
export function getFirmCodeOrThrow(): string {
  const firmCode = localStorage.getItem('law_firm_code');
  if (!firmCode) {
    throw new Error('找不到事務所代碼，請重新登入');
  }
  return firmCode;
}

// 清除登入狀態並跳轉
export function clearLoginAndRedirect(): void {
  localStorage.removeItem('law_user_id');
  localStorage.removeItem('law_user_name');
  localStorage.removeItem('law_firm_id');
  localStorage.removeItem('law_firm_code');
  localStorage.removeItem('law_firm_name');
  localStorage.removeItem('law_user_role');
  localStorage.removeItem('law_last_login');
  localStorage.removeItem('auth_token');
  
  // 只在不是登入頁面時才跳轉
  if (!window.location.pathname.includes('/login')) {
    window.location.replace('/login');
  }
}

// 改進的 API 請求函數
export async function apiFetch(path: string, init?: RequestInit) {
  try {
    // 先嘗試取得 firmCode，如果失敗會自動嘗試從 API 補齊
    const firmCode = await getFirmCodeWithFallback();
    
    const headers = new Headers(init?.headers || {});
    headers.set('Content-Type', 'application/json');
    
    // 如果有 auth token 就加入
    const token = localStorage.getItem('auth_token');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    
    const response = await fetch(path, { ...init, headers });
    
    // 如果是 401 或 403 錯誤，清除登入狀態
    if (response.status === 401 || response.status === 403) {
      console.warn('API 回應 401/403，登入狀態已過期');
      clearLoginAndRedirect();
      throw new Error('登入狀態已過期，請重新登入');
    }
    
    return response;
  } catch (error) {
    // 如果是事務所代碼相關錯誤，清除登入狀態
    if (error.message.includes('找不到事務所代碼') && !window.location.pathname.includes('/login')) {
      clearLoginAndRedirect();
    }
    throw error;
  }
}

// 初始化應用狀態（在 App 啟動時呼叫）
export async function initializeAppState(): Promise<boolean> {
  try {
    // 如果已經有完整登入資訊，直接返回成功
    if (isFullyLoggedIn()) {
      return true;
    }

    // 如果有 token 但缺少其他資訊，嘗試補齊
    const token = localStorage.getItem('auth_token');
    if (token) {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        // 補齊所有登入資訊
        if (data.user) {
          localStorage.setItem('law_user_id', data.user.id);
          localStorage.setItem('law_user_name', data.user.full_name || data.user.username);
          localStorage.setItem('law_user_role', data.user.role);
        }
        
        if (data.firm) {
          localStorage.setItem('law_firm_id', data.firm.id);
          localStorage.setItem('law_firm_code', data.firm.firm_code);
          localStorage.setItem('law_firm_name', data.firm.firm_name);
        }
        
        return true;
      } else {
        // token 無效，清除所有登入資訊
        clearLoginAndRedirect();
        return false;
      }
    }

    // 沒有任何登入資訊
    return false;
  } catch (error) {
    console.error('初始化應用狀態失敗:', error);
    // 發生錯誤時清除可能損壞的登入資訊
    clearLoginAndRedirect();
    return false;
  }
}