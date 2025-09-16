// src/utils/caseStage.ts
export function hasClosedStage(stages: { name: string }[] = []) {
  // 名稱完全等於「已結案」，或包含「結案」關鍵字都算（避免用詞差異）
  return stages.some(s => s.name === '已結案' || s.name.includes('結案'));
}

// 檢查案件是否可以轉移到結案案件
export function canTransferToClosedCases(stages: { name: string }[] = []) {
  return hasClosedStage(stages);
}

// 過濾出沒有結案階段的案件
export function filterCasesWithoutClosedStage(cases: any[]) {
  return cases.filter(caseItem => {
    const stages = Object.keys(caseItem.progress_stages || {}).map(name => ({ name }));
    return !hasClosedStage(stages);
  });
}