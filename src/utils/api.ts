// src/utils/api.ts

/** 清除登入狀態並回登入頁 */
export function clearLoginAndRedirect() {
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('firm_code');
  } catch {}
  // 視你的路由而定
  window.location.href = '/login';
}

/** 設定/覆寫 firm_code（登入或使用者切換事務所時可用） */
export function setFirmCode(fc: string) {
  if (fc && typeof fc === 'string') {
    localStorage.setItem('firm_code', fc.trim());
  }
}

/** 嘗試取得 firm_code（不丟錯）：
 * 1) localStorage
 * 2) 網址列 ?firm_code=
 * 3) .env：VITE_DEFAULT_FIRM_CODE
 * 任一取得到就寫回 localStorage，以後就穩定有值
 */
export function tryGetFirmCode(): string | null {
  // 1) 先看新鍵
  const lc = localStorage.getItem('firm_code')?.trim();
  if (lc) return lc;

  // 2) 兼容舊鍵
  const legacy = localStorage.getItem('law_firm_code')?.trim()
             || localStorage.getItem('LAW_FIRM_CODE')?.trim()
             || localStorage.getItem('firmCode')?.trim();
  if (legacy) {
    localStorage.setItem('firm_code', legacy);
    return legacy;
  }

  // 3) URL 參數
  const urlFc = new URLSearchParams(window.location.search).get('firm_code');
  if (urlFc) {
    localStorage.setItem('firm_code', urlFc);
    return urlFc;
  }

  // 4) .env 預設
  const envFc = (import.meta as any)?.env?.VITE_DEFAULT_FIRM_CODE as string | undefined;
  if (envFc) {
    localStorage.setItem('firm_code', envFc);
    return envFc;
  }

  return null;
}


/** 取得 firm_code（取不到就丟錯） */
export function getFirmCodeOrThrow(): string {
  const fc = tryGetFirmCode();
  if (!fc) {
    console.error('getFirmCodeOrThrow: 無法取得 firm_code');
    console.error('localStorage firm_code:', localStorage.getItem('firm_code'));
    console.error('localStorage law_firm_code:', localStorage.getItem('law_firm_code'));
    console.error('URL params:', window.location.search);
    throw new Error('firm_code 缺失，請重新登入');
  }
  return fc;
}

/** 同 getFirmCodeOrThrow，語義化別名 */
export function ensureFirmCode(): string {
  return getFirmCodeOrThrow();
}

/** 取得/檢查 token（沿用你專案既有介面） */
export function hasAuthToken(): boolean {
  try {
    return !!localStorage.getItem('token');
  } catch {
    return false;
  }
}
export function getAuthToken(): string | null {
  try {
    return localStorage.getItem('token');
  } catch {
    return null;
  }
}
export function setAuthToken(token: string) {
  try {
    localStorage.setItem('token', token);
  } catch {}
}

/** 判斷此路徑是否需要帶 firm_code */
function pathRequiresFirmCode(pathname: string): boolean {
  if (!pathname.startsWith('/api/')) return false;
  // 登入/驗證相關端點通常不需要 firm_code
  if (pathname.startsWith('/api/login')) return false;
  if (pathname.startsWith('/api/auth')) return false;
  return true;
}

/** 安全的 fetch 包裝：
 * - 自動補上 ?firm_code=...
 * - 自動加 Authorization: Bearer <token>（若存在）
 * - body 是 FormData 時不設 Content-Type（避免上傳壞掉）
 */
export async function apiFetch(url: string, init: RequestInit = {}) {
  const u = new URL(url, window.location.origin);

  // 需要 firm_code 的路徑 → 自動補上（若未帶）
  if (pathRequiresFirmCode(u.pathname) && !u.searchParams.has('firm_code')) {
    try {
      const fc = ensureFirmCode();
      u.searchParams.set('firm_code', fc);
    } catch (e) {
      // 沒拿到 firm_code → 清除登入並拋錯
      clearLoginAndRedirect();
      throw e;
    }
  }

  const headers = new Headers(init.headers || {});
  const hasBody = typeof init.body !== 'undefined' && init.body !== null;

  // 只有 JSON body 才自動設 Content-Type；FormData 不要設（browser 會自動帶 boundary）
  if (hasBody && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // 自動帶上 token
  const token = getAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(u.toString(), { ...init, headers });
}

/** 小工具：在既有 URL 上安全加入/覆蓋 firm_code（少用；通常用 apiFetch 即可） */
export function withFirmCode(url: string, firmCode?: string): string {
  const u = new URL(url, window.location.origin);
  const fc = (firmCode ?? tryGetFirmCode()) || '';
  if (fc) u.searchParams.set('firm_code', fc);
  return u.toString();
}


// --- Backward-compat: for App.tsx ---
// 做兩件事：1) 搬遷舊 key；2) 確保 firm_code 可從 localStorage/URL/.env 任一來源取得並寫回
export function initializeAppState(): void {
  try {
    // 1) 舊 key → 新 key（避免專案其他地方混用）
    const oldFc = localStorage.getItem('law_firm_code');
    const oldToken = localStorage.getItem('auth_token');

    if (oldFc && !localStorage.getItem('firm_code')) {
      setFirmCode(oldFc);
    }
    if (oldToken && !localStorage.getItem('token')) {
      setAuthToken(oldToken);
    }
    // 保留舊 key 作為備援，確保兼容性
    // localStorage.removeItem('law_firm_code');
    // localStorage.removeItem('auth_token');

    // 2) 嘗試從 URL / .env 自動補 firm_code（會自動寫回 localStorage）
    //    如果 localStorage 已有 firm_code，tryGetFirmCode 會直接回傳，不影響既有值
    tryGetFirmCode();
  } catch {
    // 靜默失敗，不阻斷 App 啟動
  }
}
