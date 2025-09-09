// 資料夾管理工具
export interface CaseFolder {
  id: string;
  name: string;
  path: string;
  type: 'default' | 'stage' | 'custom';
  children?: CaseFolder[];
}

export interface CaseExcelData {
  caseNumber: string;
  client: string;
  caseType: string;
  lawyer: string;
  legalAffairs: string;
  caseReason: string;
  opposingParty: string;
  court: string;
  division: string;
  progress: string;
  progressDate: string;
  createdDate: string;
}

export class FolderManager {
  private static getStorageKey(caseId: string): string {
    return `case_folders:${caseId}`;
  }

  private static getExcelKey(caseId: string): string {
    return `case_excel:${caseId}`;
  }

  // 建立預設資料夾結構
  static createDefaultFolders(caseId: string): CaseFolder[] {
    const defaultFolders: CaseFolder[] = [
      {
        id: `${caseId}_pleadings`,
        name: '狀紙',
        path: `/cases/${caseId}/狀紙`,
        type: 'default',
        children: []
      },
      {
        id: `${caseId}_info`,
        name: '案件資訊',
        path: `/cases/${caseId}/案件資訊`,
        type: 'default',
        children: []
      },
      {
        id: `${caseId}_progress`,
        name: '進度追蹤',
        path: `/cases/${caseId}/案件進度`,
        type: 'default',
        children: []
      }
    ];

    // 存儲到 localStorage
    localStorage.setItem(this.getStorageKey(caseId), JSON.stringify(defaultFolders));
    
    console.log(`為案件 ${caseId} 建立預設資料夾結構：狀紙、案件資訊、進度追蹤`);
    return defaultFolders;
  }

  // 取得案件資料夾結構
  static getCaseFolders(caseId: string): CaseFolder[] {
    const stored = localStorage.getItem(this.getStorageKey(caseId));
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return this.createDefaultFolders(caseId);
      }
    }
    return this.createDefaultFolders(caseId);
  }

  // 新增階段資料夾
  static createStageFolder(caseId: string, stageName: string): void {
    const folders = this.getCaseFolders(caseId);
    const progressFolder = folders.find(f => f.name === '進度追蹤');
    
    if (progressFolder) {
      if (!progressFolder.children) {
        progressFolder.children = [];
      }
      
      // 檢查是否已存在同名資料夾
      const existingStage = progressFolder.children.find(c => c.name === stageName);
      if (!existingStage) {
        const stageFolder: CaseFolder = {
          id: `${caseId}_stage_${stageName}`,
          name: stageName,
          path: `/cases/${caseId}/案件進度/${stageName}`,
          type: 'stage',
          children: []
        };
        
        progressFolder.children.push(stageFolder);
        localStorage.setItem(this.getStorageKey(caseId), JSON.stringify(folders));
        
        console.log(`為案件 ${caseId} 在進度追蹤資料夾下建立階段資料夾：${stageName}`);
      }
    }
  }

  // 建立案件資訊 Excel 檔案
  static createCaseInfoExcel(caseId: string, caseData: CaseExcelData): void {
    // 模擬建立 Excel 檔案
    const excelData = {
      fileName: `${caseId}_案件資訊.xlsx`,
      path: `/cases/${caseId}/案件資訊/${caseId}_案件資訊.xlsx`,
      data: caseData,
      lastUpdated: new Date().toISOString()
    };

    localStorage.setItem(this.getExcelKey(caseId), JSON.stringify(excelData));
    console.log(`為案件 ${caseId} 建立案件資訊 Excel 檔案`);
  }

  // 更新案件資訊 Excel 檔案
  static updateCaseInfoExcel(caseId: string, updatedData: Partial<CaseExcelData>): void {
    const stored = localStorage.getItem(this.getExcelKey(caseId));
    if (stored) {
      try {
        const excelData = JSON.parse(stored);
        excelData.data = { ...excelData.data, ...updatedData };
        excelData.lastUpdated = new Date().toISOString();
        
        localStorage.setItem(this.getExcelKey(caseId), JSON.stringify(excelData));
        console.log(`更新案件 ${caseId} 的案件資訊 Excel 檔案`);
      } catch (error) {
        console.error('更新 Excel 檔案失敗:', error);
      }
    }
  }

  // 取得案件的所有資料夾（用於上傳檔案時選擇）
  static getAvailableFolders(caseId: string): { name: string; path: string }[] {
    const folders = this.getCaseFolders(caseId);
    const result: { name: string; path: string }[] = [];

    const addFolderRecursively = (folder: CaseFolder) => {
      result.push({ name: folder.name, path: folder.path });
      if (folder.children) {
        folder.children.forEach(addFolderRecursively);
      }
    };

    folders.forEach(addFolderRecursively);
    return result;
  }

  // 取得階段資料夾路徑
  static getStageFolder(caseId: string, stageName: string): string {
    return `/cases/${caseId}/案件進度/${stageName}`;
  }
}