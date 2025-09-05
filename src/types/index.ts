// 共用型別定義
export interface User {
  id: string;
  username: string;
  full_name: string;
  role: 'admin' | 'lawyer' | 'legal_affairs';
  firm_name: string;
  firm_code: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: User;
}

// 案件相關型別
export interface Stage {
  name: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  note?: string;
  time?: string; // HH:MM
}

export type CaseStatus = 'active' | 'pending' | 'completed' | 'urgent';

export interface TableCase {
  id: string;
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
  status: CaseStatus;
  stages: Stage[];
}

// 表單用型別
export interface FormCaseData {
  case_id?: string;
  case_type: string;
  client: string;
  lawyer?: string;
  legal_affairs?: string;
  case_reason?: string;
  case_number?: string;
  opposing_party?: string;
  court?: string;
  division?: string;
  progress?: string;
  progress_date?: string;
  created_date?: string;
}

// 提醒元件用型別
export interface ReminderCaseData {
  case_id: string;
  client: string;
  case_type: string;
  progress_stages?: Record<string, string>;
  progress_times?: Record<string, string>;
  progress_notes?: Record<string, string>;
}

// 檔案系統型別
export interface FolderNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  path: string;
  children?: FolderNode[];
  size?: number;
  modified?: string;
}

// 對話框型別
export interface DialogConfig {
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  onConfirm?: () => void;
}

// 欄位顯示控制型別
export interface VisibleColumns {
  caseNumber: boolean;
  client: boolean;
  caseType: boolean;
  lawyer: boolean;
  legalAffairs: boolean;
  progress: boolean;
  progressDate: boolean;
  court: boolean;
  division: boolean;
}