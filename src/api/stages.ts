// src/api/stages.ts
import { isUUID } from '../utils/id';

export interface StageCreatePayload {
  stageName: string;
  date: string;  // YYYY-MM-DD
  time?: string; // HH:MM
  note?: string;
}

export async function createStage(caseId: string, payload: StageCreatePayload) {
  if (!isUUID(caseId)) {
    throw new Error('案件尚未建立完成（缺少有效 UUID）。請先儲存案件，再新增階段。');
  }
  const firm = localStorage.getItem('law_firm_code') || '';
  const res = await fetch(`/api/cases/${caseId}/stages?firm_code=${encodeURIComponent(firm)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`新增階段失敗：${res.status} ${msg}`);
  }
  return res.json();
}
