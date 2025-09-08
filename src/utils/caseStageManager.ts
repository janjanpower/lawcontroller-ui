// 案件階段管理工具
import type { TableCase } from '../types';

export interface CaseStageData {
  caseId: string;
  stages: Array<{
    name: string;
    date: string;
    completed: boolean;
    note?: string;
    time?: string;
  }>;
}

class CaseStageManager {
  private static instance: CaseStageManager;
  private stageData: Map<string, CaseStageData> = new Map();
  private caseData: Map<string, TableCase[]> = new Map(); // 新增案件資料存儲

  private constructor() {
    // 從 localStorage 載入資料
    this.loadFromStorage();
  }

  public static getInstance(): CaseStageManager {
    if (!CaseStageManager.instance) {
      CaseStageManager.instance = new CaseStageManager();
    }
    return CaseStageManager.instance;
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('case_stages_data');
      if (stored) {
        const data = JSON.parse(stored);
        this.stageData = new Map(Object.entries(data));
      }
      
      // 載入案件資料
      const caseStored = localStorage.getItem('case_data_by_firm');
      if (caseStored) {
        const caseData = JSON.parse(caseStored);
        this.caseData = new Map(Object.entries(caseData));
      }
    } catch (error) {
      console.error('載入案件階段資料失敗:', error);
    }
  }

  private saveToStorage(): void {
    try {
      const data = Object.fromEntries(this.stageData);
      localStorage.setItem('case_stages_data', JSON.stringify(data));
      
      // 儲存案件資料
      const caseData = Object.fromEntries(this.caseData);
      localStorage.setItem('case_data_by_firm', JSON.stringify(caseData));
    } catch (error) {
      console.error('儲存案件階段資料失敗:', error);
    }
  }

  // 案件資料管理方法
  public getFirmCases(firmCode: string): TableCase[] {
    return this.caseData.get(firmCode) || [];
  }

  public setFirmCases(firmCode: string, cases: TableCase[]): void {
    this.caseData.set(firmCode, cases);
    this.saveToStorage();
  }

  public addCaseToFirm(firmCode: string, newCase: TableCase): void {
    const existingCases = this.getFirmCases(firmCode);
    const updatedCases = [...existingCases, newCase];
    this.setFirmCases(firmCode, updatedCases);
  }

  public updateCaseInFirm(firmCode: string, updatedCase: TableCase): void {
    const existingCases = this.getFirmCases(firmCode);
    const updatedCases = existingCases.map(c => 
      c.id === updatedCase.id ? updatedCase : c
    );
    this.setFirmCases(firmCode, updatedCases);
  }

  public removeCaseFromFirm(firmCode: string, caseId: string): void {
    const existingCases = this.getFirmCases(firmCode);
    const updatedCases = existingCases.filter(c => c.id !== caseId);
    this.setFirmCases(firmCode, updatedCases);
  }

  public getCaseStages(caseId: string): CaseStageData['stages'] {
    const caseData = this.stageData.get(caseId);
    return caseData?.stages || [];
  }

  public setCaseStages(caseId: string, stages: CaseStageData['stages']): void {
    this.stageData.set(caseId, { caseId, stages });
    this.saveToStorage();
  }

  public addStage(caseId: string, stage: CaseStageData['stages'][0]): void {
    const currentStages = this.getCaseStages(caseId);
    const updatedStages = [...currentStages, stage];
    this.setCaseStages(caseId, updatedStages);
    
    // 建立階段資料夾
    this.createStageFolder(caseId, stage.name);
  }

  public updateStage(caseId: string, stageIndex: number, updatedStage: CaseStageData['stages'][0]): void {
    const currentStages = this.getCaseStages(caseId);
    if (stageIndex >= 0 && stageIndex < currentStages.length) {
      currentStages[stageIndex] = updatedStage;
      this.setCaseStages(caseId, currentStages);
    }
  }

  public deleteStage(caseId: string, stageIndex: number): void {
    const currentStages = this.getCaseStages(caseId);
    if (stageIndex >= 0 && stageIndex < currentStages.length) {
      currentStages.splice(stageIndex, 1);
      this.setCaseStages(caseId, currentStages);
    }
  }

  public createDefaultFolders(caseId: string): void {
    // 建立預設資料夾結構的邏輯
    console.log(`為案件 ${caseId} 建立預設資料夾結構：狀紙、案件資訊、案件進度`);
    
    // 建立案件資訊 Excel 檔案
    this.generateCaseInfoExcel(caseId, null);
  }

  public createStageFolder(caseId: string, stageName: string): void {
    // 在案件進度資料夾下建立同名階段資料夾
    console.log(`為案件 ${caseId} 在案件進度資料夾下建立階段資料夾：${stageName}`);
  }

  public generateCaseInfoExcel(caseId: string, caseData: any): void {
    // 生成案件資訊 Excel 檔案
    console.log(`為案件 ${caseId} 生成案件資訊 Excel 檔案`);
  }

  public updateCaseInfoExcel(caseId: string, updatedData: any): void {
    // 更新案件資訊 Excel 檔案
    console.log(`更新案件 ${caseId} 的案件資訊 Excel 檔案`);
    this.generateCaseInfoExcel(caseId, updatedData);
  }
}

export default CaseStageManager;