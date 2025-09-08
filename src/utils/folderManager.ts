// src/utils/folderManager.ts
/**
 * FolderManager (server-driven 版本)
 * 目標：前端不再用 localStorage 生成/保存樹狀資料，而是「只負責組路徑字串」與「提供少量工具函式」。
 * 預設資料夾的建立交由後端 `/api/files/tree` 自動處理。
 */

export type FolderKind = 'default' | 'stage' | 'custom';

/** 與後端統一：所有路徑以 `/cases/{caseId}` 為根 */
export const FolderManager = {
  /** 根路徑：/cases/{caseId} */
  root(caseId: string) {
    return `/cases/${caseId}`;
  },

  /**
   * 三個預設資料夾（名稱需與後端一致；後端會在 /api/files/tree 自動建立）
   * - 案件資訊
   * - 進度追蹤
   * - 狀紙
   */
  preset(caseId: string) {
    return [
      { name: '案件資訊', path: `/cases/${caseId}/案件資訊`, type: 'default' as FolderKind },
      { name: '進度追蹤', path: `/cases/${caseId}/進度追蹤`, type: 'default' as FolderKind },
      { name: '狀紙',     path: `/cases/${caseId}/狀紙`,     type: 'default' as FolderKind },
    ];
  },

  /**
   * 進度追蹤底下的階段資料夾路徑
   * 舊版若使用「案件進度」，此函式會自動糾正為「進度追蹤」。
   */
  stage(caseId: string, stageName: string) {
    const safe = (stageName || '').trim();
    return `/cases/${caseId}/進度追蹤/${safe}`;
  },

  /** 客製化拼接：/cases/{caseId}/...segments */
  join(caseId: string, ...segments: string[]) {
    const cleaned = segments
      .filter(Boolean)
      .map(s => s.replace(/^\/+|\/+$/g, '')); // 去除每段前後斜線
    return [`/cases/${caseId}`, ...cleaned].join('/');
  },

  /**
   * （可選）把後端回來的 children（folders + files）攤平成可放入下拉選單的 {name, path}
   * 主要用在「選擇要上傳到哪個資料夾」的情境。
   */
  flattenToOptions(caseId: string, nodes: Array<{type: 'folder' | 'file'; name: string; path?: string; children?: any[]}>) {
    const result: { name: string; path: string }[] = [];
    const walk = (n: any) => {
      if (n.type === 'folder' && n.path) {
        result.push({ name: n.name, path: n.path });
      }
      if (n.children?.length) n.children.forEach(walk);
    };
    nodes.forEach(walk);
    return result;
  },

  /**
   * （遷移輔助）把舊版 localStorage 以「案件進度」命名的資料夾轉為「進度追蹤」字串（不改動後端，只處理前端舊字串）
   */
  normalizeLegacyPath(path: string) {
    return (path || '').replace('案件進度', '進度追蹤');
  },
};

/* === 用法摘要 ===
import { FolderManager } from '../utils/folderManager';

// 1) 取得根與預設資料夾（僅顯示用途；實體建立由後端處理）
FolderManager.root(caseId);              // '/cases/{caseId}'
FolderManager.preset(caseId);            // [{name:'案件資訊',...}, {name:'進度追蹤',...}, {name:'狀紙',...}]

// 2) 取得某階段路徑
FolderManager.stage(caseId, '開庭');     // '/cases/{caseId}/進度追蹤/開庭'

// 3) 自訂更深層路徑
FolderManager.join(caseId, '案件資訊', '證據', '第1批');
// '/cases/{caseId}/案件資訊/證據/第1批'

// 4) 將後端 children 攤平成下拉選單
// const options = FolderManager.flattenToOptions(caseId, childrenFromApi);

// 5) 將舊字串「案件進度」矯正為「進度追蹤」
FolderManager.normalizeLegacyPath('/cases/xxx/案件進度/開庭'); // '/cases/xxx/進度追蹤/開庭'
*/