// src/utils/importers.ts - 智慧Excel分析器 (JavaScript版本)
export type ImportedCase = {
  type: '刑事' | '民事' | '未知';
  title: string;
  fields: Record<string, any>;
};

type XLSXType = typeof import('xlsx');
let xlsxPromise: Promise<XLSXType> | null = null;

async function getXLSX(): Promise<XLSXType> {
  if (!xlsxPromise) {
    xlsxPromise = import('xlsx') as Promise<XLSXType>;
  }
  return xlsxPromise;
}

// 🔥 智慧欄位關鍵字對應表
const FIELD_KEYWORDS = {
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

// 🔥 案件類型關鍵字
const CASE_TYPE_KEYWORDS = {
  '民事': ['民事', '民商', '民', 'civil', 'Civil', 'CIVIL'],
  '刑事': ['刑事', '刑', 'criminal', 'Criminal', 'CRIMINAL']
};

// 🔥 標題列識別的最小得分閾值
const HEADER_MIN_SCORE = 2;

// 🔥 合併欄位的分隔符
const MERGE_SEPARATOR = '-';

function detectSheetType(sheetName: string, sampleData: any[]): '刑事' | '民事' | '未知' {
  const searchText = `${sheetName} ${JSON.stringify(sampleData)}`.toLowerCase();
  
  // 檢查民事關鍵字
  for (const keyword of CASE_TYPE_KEYWORDS['民事']) {
    if (searchText.includes(keyword.toLowerCase())) {
      return '民事';
    }
  }
  
  // 檢查刑事關鍵字
  for (const keyword of CASE_TYPE_KEYWORDS['刑事']) {
    if (searchText.includes(keyword.toLowerCase())) {
      return '刑事';
    }
  }
  
  return '未知';
}

function findHeaderRow(data: any[]): number {
  const maxRowsToCheck = Math.min(10, data.length);
  let bestRow = 0;
  let bestScore = 0;

  console.log(`🔍 檢查前 ${maxRowsToCheck} 行尋找標題列...`);

  for (let rowIdx = 0; rowIdx < maxRowsToCheck; rowIdx++) {
    let score = 0;
    const matchedKeywords: string[] = [];
    const row = data[rowIdx];

    if (!row) continue;

    // 計算該行包含多少個可能的欄位關鍵字
    Object.values(row).forEach(cellValue => {
      if (cellValue != null) {
        const cellText = String(cellValue).trim();

        // 檢查是否包含任何欄位關鍵字
        for (const [fieldName, fieldKeywords] of Object.entries(FIELD_KEYWORDS)) {
          for (const keyword of fieldKeywords) {
            if (cellText.includes(keyword)) {
              score += 1;
              matchedKeywords.push(`${keyword}(${fieldName})`);
              break; // 找到一個就跳出
            }
          }
        }
      }
    });

    console.log(`  第 ${rowIdx + 1} 行: 得分 ${score}, 匹配: ${matchedKeywords.slice(0, 3).join(', ')}`);

    // 如果這一行的得分更高，更新最佳標題列
    if (score > bestScore) {
      bestScore = score;
      bestRow = rowIdx;
    }
  }

  // 如果得分太低，可能沒有找到合適的標題列
  if (bestScore < HEADER_MIN_SCORE) {
    console.log(`❌ 最高得分 ${bestScore} 低於閾值 ${HEADER_MIN_SCORE}`);
    return 0; // 預設使用第一行
  }

  console.log(`✅ 選擇第 ${bestRow + 1} 行 (得分: ${bestScore})`);
  return bestRow;
}

function smartColumnMapping(columns: string[]): Record<string, string | null> {
  const mapping: Record<string, string | null> = {};
  
  // 初始化所有欄位為 null
  Object.keys(FIELD_KEYWORDS).forEach(field => {
    mapping[field] = null;
  });

  console.log(`🔍 可用欄位: ${columns.join(', ')}`);

  for (const [field, keywords] of Object.entries(FIELD_KEYWORDS)) {
    let bestMatch: string | null = null;
    let bestScore = 0;

    for (const col of columns) {
      if (col != null) {
        const colText = String(col).trim();
        let score = 0;

        for (const keyword of keywords) {
          if (colText.includes(keyword)) {
            // 完全匹配得分更高
            if (keyword === colText) {
              score += 10;
            } else {
              score += 1;
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
      console.log(`✅ ${getFieldDisplayName(field)}: 「${bestMatch}」`);
    } else {
      console.log(`❌ ${getFieldDisplayName(field)}: 未找到`);
    }
  }

  return mapping;
}

function getFieldDisplayName(field: string): string {
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

function checkMergeRequirements(columns: string[]): {
  case_number_fields: string[];
  needs_merge: boolean;
  merge_separator: string;
} {
  const mergeInfo = {
    case_number_fields: [] as string[],
    needs_merge: false,
    merge_separator: MERGE_SEPARATOR
  };

  const caseNumberKeywords = FIELD_KEYWORDS.case_number;

  for (const col of columns) {
    if (col != null) {
      const colText = String(col).trim();
      for (const keyword of caseNumberKeywords) {
        if (colText.includes(keyword)) {
          mergeInfo.case_number_fields.push(col);
          break;
        }
      }
    }
  }

  // 如果找到多個案號相關欄位，標記需要合併
  if (mergeInfo.case_number_fields.length > 1) {
    mergeInfo.needs_merge = true;
  }

  return mergeInfo;
}

function safeExtractValue(row: any, columnName: string | null): string | null {
  if (!columnName || !row) return null;
  
  const value = row[columnName];
  if (value == null || value === '') return null;
  
  // 清理資料
  return String(value).trim();
}

function buildTitleFromRow(row: any, columnMapping: Record<string, string | null>): string {
  const titleParts: string[] = [];
  
  // 優先順序：當事人 > 案由 > 案號
  const priorityFields = ['client', 'case_reason', 'case_number'];
  
  for (const field of priorityFields) {
    const value = safeExtractValue(row, columnMapping[field]);
    if (value) {
      titleParts.push(value);
      if (titleParts.length >= 3) break; // 最多取3個部分
    }
  }
  
  return titleParts.length > 0 ? titleParts.join(' / ') : '未命名案件';
}

export async function parseExcelToCases(file: File): Promise<ImportedCase[]> {
  const XLSX = await getXLSX();

  console.log('🔍 開始智慧分析Excel檔案...');

  const buf = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });

  const results: ImportedCase[] = [];

  console.log(`📋 找到 ${wb.SheetNames.length} 個工作表`);

  // 🔥 第一步：分類工作表
  const categorizedSheets = {
    '民事': [] as string[],
    '刑事': [] as string[],
    'unknown': [] as string[]
  };

  wb.SheetNames.forEach(sheetName => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return;

    // 讀取前幾行作為樣本
    const sampleJson = XLSX.utils.sheet_to_json(ws, { defval: '', range: 5 });
    const sheetType = detectSheetType(sheetName, sampleJson);
    
    if (sheetType === '民事') {
      categorizedSheets['民事'].push(sheetName);
      console.log(`📝 ${sheetName} → 民事`);
    } else if (sheetType === '刑事') {
      categorizedSheets['刑事'].push(sheetName);
      console.log(`⚖️ ${sheetName} → 刑事`);
    } else {
      categorizedSheets['unknown'].push(sheetName);
      console.log(`❓ ${sheetName} → 未識別`);
    }
  });

  // 🔥 第二步：處理民事和刑事工作表
  for (const caseType of ['民事', '刑事'] as const) {
    const sheets = categorizedSheets[caseType];
    
    for (const sheetName of sheets) {
      console.log(`🔍 分析工作表: ${sheetName} (${caseType})`);
      
      const ws = wb.Sheets[sheetName];
      if (!ws) continue;

      // 🔥 第三步：智慧尋找標題列
      const allData = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 });
      if (!allData.length) continue;

      const headerRowIndex = findHeaderRow(allData);
      
      // 🔥 第四步：使用找到的標題列重新讀取資料
      const jsonData = XLSX.utils.sheet_to_json(ws, { 
        defval: '', 
        range: headerRowIndex // 從標題列開始讀取
      });

      if (!jsonData.length) continue;

      // 🔥 第五步：智慧欄位對應
      const columns = Object.keys(jsonData[0]);
      const columnMapping = smartColumnMapping(columns);
      
      // 🔥 第六步：檢查合併需求
      const mergeInfo = checkMergeRequirements(columns);
      
      console.log(`📊 ${sheetName}: 找到 ${Object.values(columnMapping).filter(v => v).length} 個欄位, ${jsonData.length} 行資料`);

      // 🔥 第七步：提取案件資料
      jsonData.forEach((row, index) => {
        try {
          // 智慧提取各欄位資料
          const caseData: Record<string, any> = {
            case_type: caseType,
            client: safeExtractValue(row, columnMapping.client),
            case_id: safeExtractValue(row, columnMapping.case_id),
            case_reason: safeExtractValue(row, columnMapping.case_reason),
            lawyer: safeExtractValue(row, columnMapping.lawyer),
            legal_affairs: safeExtractValue(row, columnMapping.legal_affairs),
            opposing_party: safeExtractValue(row, columnMapping.opposing_party),
            court: safeExtractValue(row, columnMapping.court),
            division: safeExtractValue(row, columnMapping.division)
          };

          // 🔥 處理案號合併
          if (mergeInfo.needs_merge) {
            const caseNumberParts: string[] = [];
            for (const field of mergeInfo.case_number_fields) {
              const part = safeExtractValue(row, field);
              if (part) {
                caseNumberParts.push(part);
              }
            }
            caseData.case_number = caseNumberParts.length > 0 ? caseNumberParts.join(mergeInfo.merge_separator) : null;
          } else {
            caseData.case_number = safeExtractValue(row, columnMapping.case_number);
          }

          // 檢查必要欄位（當事人是必要的）
          if (!caseData.client) {
            return; // 跳過沒有當事人的行
          }

          // 🔥 智慧建立標題
          const title = buildTitleFromRow(row, columnMapping);

          results.push({
            type: caseType,
            title,
            fields: caseData
          });

        } catch (error) {
          console.error(`處理第 ${index + 1} 行時發生錯誤:`, error);
        }
      });
    }
  }

  console.log(`✅ 智慧分析完成！共提取 ${results.length} 筆案件`);
  console.log(`📊 民事: ${results.filter(r => r.type === '民事').length} 筆`);
  console.log(`📊 刑事: ${results.filter(r => r.type === '刑事').length} 筆`);

  return results;
}