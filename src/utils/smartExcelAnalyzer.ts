// src/utils/smartExcelAnalyzer.ts
// 基於 smart_excel_analyzer.py 的 TypeScript 實現

export interface AnalysisResult {
  success: boolean;
  message: string;
  data?: {
    categorizedSheets: Record<string, string[]>;
    sheetsAnalysis: Record<string, any>;
    totalProcessableSheets: number;
    analysisReport: string;
  };
}

export interface ExtractedCase {
  type: '民事' | '刑事';
  client: string;
  case_reason?: string;
  case_number?: string;
  court?: string;
  division?: string;
  lawyer?: string;
  legal_affairs?: string;
  opposing_party?: string;
  fields: Record<string, any>;
}

export class SmartExcelAnalyzer {
  private fieldKeywords = {
    case_id: ['編號', '案件編號', 'ID', 'id', '序號', '流水號', '案件ID', '案件id'],
    case_reason: ['案由', '事由', '案件事由', '訴訟事由', '案件原因', '事件類型', '事件', '原因'],
    case_number: ['案號', '機關', '案件號碼', '機關案號', '法院案號', '案件號', '號碼'],
    court: ['法院', '負責法院', '管轄法院', '審理法院', '法庭'],
    client: ['當事人', '客戶', '客戶名稱', '姓名', '委託人', '申請人', '當事者', '名稱'],
    lawyer: ['委任律師', '律師', '代理律師', '辯護律師', '訴訟代理人', '代表律師', '律師姓名'],
    legal_affairs: ['法務', '法務人員', '助理', '法務助理', '承辦人', '負責人', '經辦人'],
    opposing_party: ['對造', '相對人', '被告', '對方當事人', '另一方', '對方'],
    division: ['股別', '分機']
  };

  private caseTypeKeywords = {
    '民事': ['民事', '民商', '民', 'civil', 'Civil', 'CIVIL'],
    '刑事': ['刑事', '刑', 'criminal', 'Criminal', 'CRIMINAL']
  };

  private headerMinScore = 2;
  private mergeSeparator = '-';

  async analyzeExcel(file: File): Promise<AnalysisResult> {
    try {
      console.log('🔍 開始分析Excel檔案:', file.name);

      // 動態導入 xlsx
      const XLSX = await import('xlsx');
      
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        return {
          success: false,
          message: 'Excel檔案中沒有工作表'
        };
      }

      console.log(`📋 找到 ${workbook.SheetNames.length} 個工作表`);

      // 分類工作表
      const categorizedSheets = this.categorizeSheetsByType(workbook.SheetNames);
      
      const civilCount = categorizedSheets['民事'].length;
      const criminalCount = categorizedSheets['刑事'].length;
      const unknownCount = categorizedSheets['unknown'].length;

      console.log(`✅ 分類完成: 民事${civilCount}個, 刑事${criminalCount}個, 未識別${unknownCount}個`);

      // 分析每個相關工作表
      const sheetsAnalysis: Record<string, any> = {};
      let totalAnalyzed = 0;

      for (const caseType of ['民事', '刑事']) {
        const sheetNames = categorizedSheets[caseType];
        for (const sheetName of sheetNames) {
          console.log(`  分析工作表: ${sheetName}`);
          const analysis = this.analyzeSheetStructure(workbook, sheetName, caseType);
          if (analysis.success) {
            sheetsAnalysis[sheetName] = analysis;
            totalAnalyzed++;
            console.log(`  ✅ ${sheetName}: 找到${analysis.requiredFieldsFound}個欄位, ${analysis.dataRows}行資料`);
          } else {
            console.log(`  ❌ ${sheetName}: ${analysis.message}`);
          }
        }
      }

      console.log(`✅ 結構分析完成: ${totalAnalyzed}個工作表可處理`);

      // 生成分析報告
      const analysisReport = this.generateAnalysisReport(categorizedSheets, sheetsAnalysis);

      return {
        success: true,
        message: analysisReport,
        data: {
          categorizedSheets,
          sheetsAnalysis,
          totalProcessableSheets: totalAnalyzed,
          analysisReport
        }
      };

    } catch (error) {
      console.error('❌ 分析過程發生錯誤:', error);
      return {
        success: false,
        message: `分析過程發生錯誤：${error.message}`
      };
    }
  }

  async extractData(file: File, analysisResult: AnalysisResult): Promise<ExtractedCase[]> {
    try {
      console.log('🚀 開始提取資料:', file.name);

      if (!analysisResult.success || !analysisResult.data) {
        throw new Error('無效的分析結果');
      }

      const XLSX = await import('xlsx');
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });

      const allCases: ExtractedCase[] = [];
      const { sheetsAnalysis } = analysisResult.data;

      for (const [sheetName, analysis] of Object.entries(sheetsAnalysis)) {
        if (!analysis.success || !analysis.hasClientField) {
          console.log(`跳過工作表 ${sheetName}: 缺少必要欄位`);
          continue;
        }

        console.log(`處理工作表: ${sheetName} (${analysis.caseType})`);

        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) continue;

        // 轉換為 JSON，使用找到的標題列
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: analysis.headerRow || 0,
          defval: ''
        });

        console.log(`工作表 ${sheetName} 轉換為 ${jsonData.length} 行資料`);

        for (const row of jsonData) {
          try {
            const extractedCase = this.extractCaseFromRow(row, analysis);
            if (extractedCase && extractedCase.client) {
              allCases.push(extractedCase);
            }
          } catch (error) {
            console.error('處理行資料失敗:', error);
          }
        }
      }

      console.log(`✅ 資料提取完成: 共 ${allCases.length} 筆`);
      return allCases;

    } catch (error) {
      console.error('❌ 資料提取失敗:', error);
      throw error;
    }
  }

  private categorizeSheetsByType(sheetNames: string[]): Record<string, string[]> {
    const categorized = {
      '民事': [] as string[],
      '刑事': [] as string[],
      'unknown': [] as string[]
    };

    for (const sheetName of sheetNames) {
      let classified = false;
      const sheetNameClean = sheetName.trim();

      // 檢查民事關鍵字
      for (const keyword of this.caseTypeKeywords['民事']) {
        if (sheetNameClean.includes(keyword)) {
          categorized['民事'].push(sheetName);
          classified = true;
          console.log(`  📝 ${sheetName} → 民事 (匹配: ${keyword})`);
          break;
        }
      }

      // 檢查刑事關鍵字
      if (!classified) {
        for (const keyword of this.caseTypeKeywords['刑事']) {
          if (sheetNameClean.includes(keyword)) {
            categorized['刑事'].push(sheetName);
            classified = true;
            console.log(`  ⚖️ ${sheetName} → 刑事 (匹配: ${keyword})`);
            break;
          }
        }
      }

      // 未分類
      if (!classified) {
        categorized['unknown'].push(sheetName);
        console.log(`  ❓ ${sheetName} → 未識別`);
      }
    }

    return categorized;
  }

  private analyzeSheetStructure(workbook: any, sheetName: string, caseType: string): any {
    try {
      const XLSX = require('xlsx');
      const worksheet = workbook.Sheets[sheetName];
      
      if (!worksheet) {
        return { success: false, message: `工作表 ${sheetName} 不存在` };
      }

      // 轉換為陣列來尋找標題列
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
      const previewRows: string[][] = [];
      
      // 讀取前15行用於尋找標題列
      for (let row = range.s.r; row <= Math.min(range.e.r, range.s.r + 14); row++) {
        const rowData: string[] = [];
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = worksheet[cellAddress];
          rowData.push(cell ? String(cell.v || '') : '');
        }
        previewRows.push(rowData);
      }

      // 尋找標題列
      const headerRow = this.findHeaderRow(previewRows);
      if (headerRow === null) {
        return { success: false, message: `工作表 ${sheetName} 找不到標題列` };
      }

      console.log(`    標題列位置: 第 ${headerRow + 1} 行`);

      // 取得標題列的欄位名稱
      const headers = previewRows[headerRow] || [];
      
      // 智慧欄位對應
      const columnMapping = this.smartColumnMapping(headers);
      
      // 統計找到的欄位
      const foundFields = Object.values(columnMapping).filter(v => v !== null).length;
      console.log(`    找到欄位: ${foundFields}/${Object.keys(this.fieldKeywords).length}`);

      // 檢查合併欄位需求
      const mergeInfo = this.checkMergeRequirements(headers);
      if (mergeInfo.needsMerge) {
        console.log(`    需要合併欄位: ${mergeInfo.caseNumberFields.join(', ')}`);
      }

      // 統計資料行數（排除標題列）
      const dataRows = Math.max(0, range.e.r - range.s.r - headerRow);

      return {
        success: true,
        caseType,
        headerRow,
        columnMapping,
        mergeInfo,
        totalColumns: headers.length,
        dataRows,
        columns: headers,
        requiredFieldsFound: foundFields,
        hasClientField: columnMapping.client !== null,
        message: `分析成功: 找到 ${foundFields} 個欄位，${dataRows} 行資料`
      };

    } catch (error) {
      return { success: false, message: `分析工作表 ${sheetName} 失敗：${error.message}` };
    }
  }

  private findHeaderRow(rows: string[][]): number | null {
    let bestRow = 0;
    let bestScore = 0;

    const maxRowsToCheck = Math.min(10, rows.length);
    console.log(`      檢查前 ${maxRowsToCheck} 行...`);

    for (let rowIdx = 0; rowIdx < maxRowsToCheck; rowIdx++) {
      let score = 0;
      const matchedKeywords: string[] = [];

      const rowData = rows[rowIdx] || [];

      // 計算該行包含多少個可能的欄位關鍵字
      for (const cellValue of rowData) {
        if (cellValue && cellValue.trim()) {
          const cellText = cellValue.trim();

          // 檢查是否包含任何欄位關鍵字
          for (const [fieldName, fieldKeywords] of Object.entries(this.fieldKeywords)) {
            for (const keyword of fieldKeywords) {
              if (cellText.includes(keyword)) {
                score += 1;
                matchedKeywords.push(`${keyword}(${fieldName})`);
                break; // 找到一個就跳出
              }
            }
          }
        }
      }

      console.log(`      第 ${rowIdx + 1} 行: 得分 ${score}, 匹配: ${matchedKeywords.slice(0, 3).join(', ')}`);

      // 如果這一行的得分更高，更新最佳標題列
      if (score > bestScore) {
        bestScore = score;
        bestRow = rowIdx;
      }
    }

    // 如果得分太低，可能沒有找到合適的標題列
    if (bestScore < this.headerMinScore) {
      console.log(`      ❌ 最高得分 ${bestScore} 低於閾值 ${this.headerMinScore}`);
      return null;
    }

    console.log(`      ✅ 選擇第 ${bestRow + 1} 行 (得分: ${bestScore})`);
    return bestRow;
  }

  private smartColumnMapping(columns: string[]): Record<string, string | null> {
    const mapping: Record<string, string | null> = {};
    
    // 初始化所有欄位為 null
    for (const field of Object.keys(this.fieldKeywords)) {
      mapping[field] = null;
    }

    console.log(`      可用欄位: ${columns.join(', ')}`);

    for (const [field, keywords] of Object.entries(this.fieldKeywords)) {
      let bestMatch: string | null = null;
      let bestScore = 0;

      for (const col of columns) {
        if (col && col.trim()) {
          const colText = col.trim();

          // 計算匹配得分
          let score = 0;
          let matchedKeyword: string | null = null;

          for (const keyword of keywords) {
            if (colText.includes(keyword)) {
              // 完全匹配得分更高
              if (keyword === colText) {
                score += 10;
                matchedKeyword = keyword;
              } else {
                score += 1;
                if (!matchedKeyword) {
                  matchedKeyword = keyword;
                }
              }
            }
          }

          if (score > bestScore) {
            bestScore = score;
            bestMatch = col;
          }
        }
      }

      if (bestMatch) {
        mapping[field] = bestMatch;
        console.log(`      ✅ ${this.getFieldDisplayName(field)}: 「${bestMatch}」`);
      } else {
        console.log(`      ❌ ${this.getFieldDisplayName(field)}: 未找到`);
      }
    }

    return mapping;
  }

  private checkMergeRequirements(columns: string[]): any {
    const mergeInfo = {
      caseNumberFields: [] as string[],
      needsMerge: false,
      mergeSeparator: this.mergeSeparator
    };

    const caseNumberKeywords = this.fieldKeywords.case_number;

    for (const col of columns) {
      if (col && col.trim()) {
        const colText = col.trim();
        for (const keyword of caseNumberKeywords) {
          if (colText.includes(keyword)) {
            mergeInfo.caseNumberFields.push(col);
            break;
          }
        }
      }
    }

    // 如果找到多個案號相關欄位，標記需要合併
    if (mergeInfo.caseNumberFields.length > 1) {
      mergeInfo.needsMerge = true;
    }

    return mergeInfo;
  }

  private generateAnalysisReport(categorizedSheets: Record<string, string[]>, sheetsAnalysis: Record<string, any>): string {
    const lines: string[] = [];

    // 工作表分類統計
    lines.push('📋 工作表分類結果：');
    for (const [caseType, sheets] of Object.entries(categorizedSheets)) {
      if (sheets.length > 0) {
        if (caseType === '民事') {
          lines.push(`  📝 民事工作表 (${sheets.length} 個)`);
        } else if (caseType === '刑事') {
          lines.push(`  ⚖️ 刑事工作表 (${sheets.length} 個)`);
        }
      }
    }

    // 詳細欄位分析
    if (Object.keys(sheetsAnalysis).length > 0) {
      lines.push('');
      for (const [sheetName, analysis] of Object.entries(sheetsAnalysis)) {
        lines.push(`📄 工作表：${sheetName}`);
        lines.push(`   案件類型：${analysis.caseType}`);
        lines.push(`   資料行數：${analysis.dataRows} 行`);
      }
    } else {
      lines.push('⚠️ 沒有找到可處理的工作表');
    }

    return lines.join('\n');
  }

  private extractCaseFromRow(row: any, analysis: any): ExtractedCase | null {
    try {
      const columnMapping = analysis.columnMapping;
      const mergeInfo = analysis.mergeInfo;

      // 提取各欄位資料
      const caseData: any = {
        type: analysis.caseType,
        client: this.safeExtractValue(row, columnMapping.client),
        case_reason: this.safeExtractValue(row, columnMapping.case_reason),
        court: this.safeExtractValue(row, columnMapping.court),
        division: this.safeExtractValue(row, columnMapping.division),
        lawyer: this.safeExtractValue(row, columnMapping.lawyer),
        legal_affairs: this.safeExtractValue(row, columnMapping.legal_affairs),
        opposing_party: this.safeExtractValue(row, columnMapping.opposing_party),
        fields: row
      };

      // 處理案號合併
      if (mergeInfo.needsMerge) {
        const caseNumberParts: string[] = [];
        for (const field of mergeInfo.caseNumberFields) {
          const part = this.safeExtractValue(row, field);
          if (part) {
            caseNumberParts.push(part);
          }
        }
        caseData.case_number = caseNumberParts.length > 0 ? caseNumberParts.join(mergeInfo.mergeSeparator) : null;
      } else {
        caseData.case_number = this.safeExtractValue(row, columnMapping.case_number);
      }

      // 檢查必要欄位
      if (!caseData.client) {
        return null;
      }

      return caseData as ExtractedCase;

    } catch (error) {
      console.error('提取案件資料失敗:', error);
      return null;
    }
  }

  private safeExtractValue(row: any, columnName: string | null): string | null {
    if (!columnName || !row) {
      return null;
    }

    try {
      const value = row[columnName];
      if (value === null || value === undefined || value === '') {
        return null;
      }

      // 清理資料
      const cleanedValue = String(value).trim();
      return cleanedValue || null;

    } catch (error) {
      return null;
    }
  }

  private getFieldDisplayName(field: string): string {
    const displayNames: Record<string, string> = {
      case_id: '案件編號',
      case_reason: '案由',
      case_number: '案號',
      court: '法院',
      client: '當事人',
      lawyer: '委任律師',
      legal_affairs: '法務',
      opposing_party: '對造',
      division: '股別'
    };
    return displayNames[field] || field;
  }
}