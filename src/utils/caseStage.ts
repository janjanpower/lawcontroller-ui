// src/utils/caseStage.ts
export function hasClosedStage(stages: { name: string }[] = []) {
  // 名稱完全等於「已結案」，或包含「結案」關鍵字都算（避免用詞差異）
  return stages.some(s => s.name === '已結案' || s.name.includes('結案'));
}
