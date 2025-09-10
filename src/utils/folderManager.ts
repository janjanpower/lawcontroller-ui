// 資料夾管理與檔案橋接工具（前端）- Class 版（維持原介面）
import { apiFetch, getFirmCodeOrThrow } from './api';

export type FolderType = 'default' | 'stage' | 'custom';

export interface CaseFolder {
  id: string;
  name: string;
  path: string;
  type: FolderType;
  children?: CaseFolder[];
}

export interface CaseExcelData {
  caseNumber: string;
  client: string;
  caseType: string;
  lawyer: string;
  legalAffairs: string;
  caseReason: string;
  opposingParty?: string;
  court?: string;
  division?: string;
  progress?: string;
  progressDate?: string;
  createdDate?: string;
}

const BASE_FOLDERS = ['狀紙', '案件資訊', '案件進度'] as const;
const LS_KEY = (caseId: string) => `case_folders:${caseId}`;
const uniqByNamePath = <T extends { name: string; path: string }>(arr: T[]) => {
  const m = new Map<string, T>();
  for (const x of arr) m.set(`${x.name}::${x.path}`, x);
  return Array.from(m.values());
};

export class FolderManager {
  /* =========================== 基本路徑與快取 ============================ */
  static getCaseRoot(caseId: string) { return `/cases/${caseId}`; }

  // 冪等建立預設資料夾
  static createDefaultFolders(caseId: string): CaseFolder[] {
    const root = this.getCaseRoot(caseId);
    const existing = this.getCaseFolders(caseId, /*fallback*/null);

    const baseNodes: CaseFolder[] = (BASE_FOLDERS as readonly string[]).map((name) => ({
      id: `${root}/${name}/`,
      name,
      path: `${root}/${name}/`,
      type: 'default',
      children: name === '案件進度' ? [] : undefined,
    }));

    let finalTree: CaseFolder[] = baseNodes;
    if (existing && Array.isArray(existing)) {
      // 過濾掉不在 BASE_FOLDERS 中的資料夾（移除進度追蹤等舊資料夾）
      const validExisting = existing.filter(f => BASE_FOLDERS.includes(f.name as any));
      const byName = new Map(validExisting.map(f => [f.name, f]));
      for (const n of baseNodes) {
        if (!byName.has(n.name)) byName.set(n.name, n);
      }
      finalTree = Array.from(byName.values());
    }
    localStorage.setItem(LS_KEY(caseId), JSON.stringify(finalTree));
    return finalTree;
  }

  // 讀取資料夾樹；沒有就建立預設
  static getCaseFolders(caseId: string, fallback: 'create' | null = 'create'): CaseFolder[] {
    const raw = localStorage.getItem(LS_KEY(caseId));
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as CaseFolder[];
        if (Array.isArray(parsed)) {
          // 過濾掉舊的無效資料夾
          const filtered = parsed.filter(f => BASE_FOLDERS.includes(f.name as any));
          return filtered;
        }
      } catch {}
    }
    if (fallback === 'create') return this.createDefaultFolders(caseId);
    return [];
  }

  private static saveCaseFolders(caseId: string, folders: CaseFolder[]) {
    // 儲存前再次過濾，確保只有有效的資料夾
    const validFolders = folders.filter(f => BASE_FOLDERS.includes(f.name as any));
    localStorage.setItem(LS_KEY(caseId), JSON.stringify(folders));
  }

  /* ============================ 階段資料夾 ============================== */
  static getStageFolder(caseId: string, stageName: string): string {
    return `${this.getCaseRoot(caseId)}/案件進度/${encodeURIComponent(stageName)}/`;
  }

  static createStageFolder(caseId: string, stageName: string): void {
    const folders = this.getCaseFolders(caseId);
    const progress = folders.find(f => f.name === '案件進度' && f.path.endsWith('/案件進度/'));
    const stagePath = this.getStageFolder(caseId, stageName);

    if (progress) {
      progress.children = progress.children || [];
      const exists = progress.children.some(c => c.path === stagePath);
      if (!exists) {
        progress.children.push({
          id: stagePath,
          name: stageName,
          path: stagePath,
          type: 'stage',
        });
        this.saveCaseFolders(caseId, folders);
        console.log(`已建立階段資料夾: ${stageName}`);
      }
    } else {
      // 如果沒有案件進度資料夾，先建立它
      folders.push({
        id: `${this.getCaseRoot(caseId)}/案件進度/`,
        name: '案件進度',
        path: `${this.getCaseRoot(caseId)}/案件進度/`,
        type: 'default',
        children: [{
          id: stagePath,
          name: stageName,
          path: stagePath,
          type: 'stage',
        }],
      });
      this.saveCaseFolders(caseId, folders);
      console.log(`已建立案件進度資料夾和階段資料夾: ${stageName}`);
    }
  }

  // 僅從前端樹移除（檔案刪除另有 API）
  static removeStageFolderNode(caseId: string, stageName: string): void {
    const folders = this.getCaseFolders(caseId);
    const progress = folders.find(f => f.name === '案件進度' && f.path.endsWith('/案件進度/'));
    if (!progress || !progress.children) return;
    const next = progress.children.filter(c => c.name !== stageName);
    if (next.length !== progress.children.length) {
      progress.children = next;
      this.saveCaseFolders(caseId, folders);
      console.log(`已移除階段資料夾: ${stageName}`);
    }
  }

  // 提供給上傳對話框的可選資料夾清單（含階段；自動去重）
  static getAvailableFolders(caseId: string): Array<{ name: string; path: string }> {
    const folders = this.getCaseFolders(caseId);
    const res: Array<{ name: string; path: string }> = [];
    const walk = (n: CaseFolder) => { res.push({ name: n.name, path: n.path }); n.children?.forEach(walk); };
    folders.forEach(walk);

    // 確保三個基本資料夾都在
    const root = this.getCaseRoot(caseId);
    for (const name of BASE_FOLDERS) {
      if (!res.some(x => x.name === name)) res.push({ name, path: `${root}/${name}/` });
    }
    return uniqByNamePath(res);
  }

  // 新增：刷新資料夾樹的方法
  static refreshFolderTree(caseId: string): void {
    // 清除快取，強制重新載入
    localStorage.removeItem(LS_KEY(caseId));
    console.log(`已清除案件 ${caseId} 的資料夾快取`);
  }

  /* ============================== 檔案 API =============================== */
  // 取某階段底下的檔案（需要後端支援 GET /api/cases/:id/files?folder_type=stage&stage_name=...）
  static async listStageFiles(caseId: string, stageName: string): Promise<any[]> {
    const fc = getFirmCodeOrThrow();
    const url = `/api/cases/${caseId}/files?folder_type=stage&stage_name=${encodeURIComponent(stageName)}&firm_code=${encodeURIComponent(fc)}`;
    const res = await apiFetch(url);
    if (!res.ok) return [];
    try {
      const data = await res.json();
      return Array.isArray(data) ? data : (data?.items ?? []);
    } catch { return []; }
  }

  static async hasFilesInStageFolder(caseId: string, stageName: string): Promise<boolean> {
    const files = await this.listStageFiles(caseId, stageName);
    return files.length > 0;
  }

  // 刪除整個階段資料夾（需要後端支援 DELETE /api/cases/:id/files?folder_type=stage&stage_name=...）
  static async deleteStageFolder(caseId: string, stageName: string): Promise<void> {
    const fc = getFirmCodeOrThrow();
    const url = `/api/cases/${caseId}/files?folder_type=stage&stage_name=${encodeURIComponent(stageName)}&firm_code=${encodeURIComponent(fc)}`;
    const res = await apiFetch(url, { method: 'DELETE' });
    if (!res.ok) {
      try { console.warn('deleteStageFolder failed:', await res.text()); } catch {}
    }
  }

  // 解析 prefix（/cases/{id}/案件進度/{stage}/）→ 兼容舊呼叫
  private static parseStageFromPath(prefix: string): { caseId?: string; stageName?: string } {
    const m = prefix.match(/\/cases\/(.+?)\/案件進度\/([^/]+)\/?$/);
    if (!m) return {};
    const caseId = decodeURIComponent(m[1]);
    const stageName = decodeURIComponent(m[2]);
    return { caseId, stageName };
  }

  // 兼容舊呼叫：hasFilesInFolder(prefix)
  static async hasFilesInFolder(prefix: string): Promise<boolean> {
    const { caseId, stageName } = this.parseStageFromPath(prefix);
    if (!caseId || !stageName) return false;
    return this.hasFilesInStageFolder(caseId, stageName);
  }

  // 兼容舊呼叫：deleteFolderRecursive(prefix)
  static async deleteFolderRecursive(prefix: string): Promise<void> {
    const { caseId, stageName } = this.parseStageFromPath(prefix);
    if (!caseId || !stageName) return;
    await this.deleteStageFolder(caseId, stageName);
  }

  /* ============================== Excel 快取 ============================= */
  // 這兩個先以 localStorage 快取，避免呼叫處噴錯；如需真正產生檔案可再串後端
  static createCaseInfoExcel(caseId: string, data: CaseExcelData): void {
    localStorage.setItem(`case_info_excel:${caseId}`, JSON.stringify(data));
  }

  static updateCaseInfoExcel(caseId: string, data: Partial<CaseExcelData>): void {
    try {
      const raw = localStorage.getItem(`case_info_excel:${caseId}`);
      const prev = raw ? JSON.parse(raw) : {};
      localStorage.setItem(`case_info_excel:${caseId}`, JSON.stringify({ ...prev, ...data }));
    } catch {
      localStorage.setItem(`case_info_excel:${caseId}`, JSON.stringify(data));
    }
  }
}
