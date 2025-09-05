// 共用型別定義

// 方案型別
export type PlanType = 'basic' | 'advanced' | 'premium' | 'enterprise';

export interface Plan {
  type: PlanType;
  name: string;
  maxUsers: number;
  features: string[];
}

export const PLANS: Record<PlanType, Plan> = {
  basic: {
    type: 'basic',
    name: '基礎方案',
    maxUsers: 5,
    features: ['基本案件管理', '客戶管理', '檔案上傳']
  },
  advanced: {
    type: 'advanced',
    name: '進階方案',
    maxUsers: 10,
    features: ['基本案件管理', '客戶管理', '檔案上傳', 'LINE Bot整合', '進度提醒']
  },
  premium: {
    type: 'premium',
    name: '高階方案',
    maxUsers: 20,
    features: ['所有進階功能', '自訂報表', '資料匯出', 'API整合']
  },
  enterprise: {
    type: 'enterprise',
    name: '企業方案',
    maxUsers: 50,
    features: ['所有功能', '無限儲存', '專屬客服', '客製化開發']
  }
};

// 事務所型別
export interface Firm {
  id: string;
  firmName: string;
  firmCode: string;
  plan: PlanType;
  currentUsers: number;
  maxUsers: number;
  createdAt: string;
  isActive: boolean;
}

// 用戶型別
export interface User {
  id: string;
  firmId: string;
  username: string;
  fullName: string;
  role: 'admin' | 'lawyer' | 'legal_affairs';
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
}

// 登入相關型別
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface UserLoginCredentials {
  userId: string;
  personalPassword: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: User;
  firm: Firm;
}

// 註冊型別
export interface RegisterData {
  firmName: string;
  firmCode: string;
  adminUsername: string;
  adminPassword: string;
  confirmPassword: string;
  plan: PlanType;
}

// 用戶管理型別
export interface CreateUserData {
  username: string;
  fullName: string;
  role: 'admin' | 'lawyer' | 'legal_affairs';
  personalPassword: string;
  confirmPersonalPassword: string;
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