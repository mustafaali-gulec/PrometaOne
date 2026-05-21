/**
 * API tipleri — OpenAPI 3.0 spesifikasyonundan türetilmiştir.
 * Frontend ile shared olabilir (monorepo).
 */

// ============== Enums ==============
export type UserRole = 'viewer' | 'editor' | 'hr_manager' | 'cfo' | 'admin';
export type CategorySection = 'inflows' | 'outflows' | 'nonPnlOutflows' | 'kasaCategories';
export type CurrencyCode = 'TRY' | 'USD' | 'EUR';
export type FlowDirection = 'in' | 'out';
export type EndpointType = 'bank' | 'kasa';
export type InvoiceStatus = 'open' | 'partial' | 'paid' | 'overdue';
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'very_low';
export type TrendDirection = 'increasing' | 'decreasing' | 'stable';

// ============== Auth ==============
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  expiresIn: number;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// ============== Core entities ==============
export interface User {
  id: number;
  username: string;
  fullName: string | null;
  email: string | null;
  role: UserRole;
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface UserCreateRequest {
  username: string;
  password: string;
  fullName?: string;
  email?: string;
  role: UserRole;
}

export interface UserUpdateRequest {
  fullName?: string;
  email?: string;
  role?: UserRole;
  active?: boolean;
}

export interface Company {
  id: number;
  name: string;
  taxNo: string | null;
  color: string;
  fiscalYear: number;
  fiscalStartMonth: number;
  openingCash: number;
  createdAt: string;
}

export interface CompanyCreateRequest {
  name: string;
  taxNo?: string;
  color?: string;
  fiscalYear?: number;
  fiscalStartMonth?: number;
  openingCash?: number;
  copyCategoriesFrom?: number;
}

export interface CompanyState {
  company: Company;
  inflows: Category[];
  outflows: Category[];
  nonPnlOutflows: Category[];
  kasaCategories: Category[];
  cells: Record<string, number>;
  bankAccounts: BankAccount[];
  kasaAccounts: KasaAccount[];
  kasaEntries: KasaEntry[];
  transfers: Transfer[];
  invoices: Invoice[];
  revaluations: Revaluation[];
  notificationSettings: NotificationSettings;
  archives: Archive[];
}

export interface Category {
  id: number;
  companyId: number;
  section: CategorySection;
  name: string;
  sortOrder: number;
}

export interface Bank {
  id: number;
  name: string;
  code: string;
  color: string | null;
}

export interface BankAccount {
  id: number;
  companyId: number;
  bankId: number;
  name: string;
  iban: string | null;
  accountNo: string | null;
  currency: CurrencyCode;
  openingBalance: number;
  cashflowCatId: number | null;
  balance?: number; // hesaplanmış
}

export interface KasaAccount {
  id: number;
  companyId: number;
  name: string;
  currency: CurrencyCode;
  openingBalance: number;
  balance?: number;
}

export interface KasaEntry {
  id: number;
  kasaAccountId: number;
  date: string;
  type: FlowDirection;
  amount: number;
  description: string | null;
  category: string | null;
  cashflowCatId: number | null;
  committedToCells: boolean;
  committedAt: string | null;
  createdAt: string;
  createdBy: number;
}

export interface Transfer {
  id: number;
  date: string;
  fromType: EndpointType;
  fromId: number;
  toType: EndpointType;
  toId: number;
  fromAmount: number;
  toAmount: number;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  description: string | null;
  cashflowCatId: number | null;
  committedToCells: boolean;
  createdAt: string;
  createdBy: number;
}

export interface Invoice {
  id: number;
  companyId: number;
  type: FlowDirection;
  invoiceNo: string | null;
  counterparty: string;
  issueDate: string | null;
  dueDate: string;
  currency: CurrencyCode;
  subtotal: number;
  kdvRate: number;
  kdv: number;
  total: number;
  paidAmount: number;
  status: InvoiceStatus;
  cashflowCatId: number | null;
  committedToCells: boolean;
  committedAt: string | null;
  note: string | null;
  payments: InvoicePayment[];
  createdAt: string;
  createdBy: number;
}

export interface InvoicePayment {
  id: number;
  invoiceId: number;
  amount: number;
  date: string;
  currency: CurrencyCode;
  bankAccountId: number | null;
  kasaAccountId: number | null;
  note: string | null;
  createdAt: string;
}

export interface Revaluation {
  id: number;
  companyId: number;
  referenceDate: string;
  valuationDate: string;
  usdRate1: number;
  usdRate2: number;
  eurRate1: number;
  eurRate2: number;
  gainTotal: number;
  lossTotal: number;
  net: number;
  details: Array<Record<string, any>>;
  posted: boolean;
  postedAt: string | null;
  createdAt: string;
  createdBy: number;
}

export interface Archive {
  id: number;
  companyId: number;
  fiscalYear: number;
  fiscalStartMonth: number;
  openingCash: number;
  closingCash: number;
  totalInflow: number;
  totalOutflow: number;
  archivedAt: string;
  archivedBy: number;
}

export interface ArchiveDetail extends Archive {
  snapshot: {
    inflows: Category[];
    outflows: Category[];
    nonPnlOutflows: Category[];
    cells: Record<string, number>;
  };
}

export interface NotificationSettings {
  enabled: boolean;
  recipients: string[];
  alertThresholdDays: number;
  includeOverdue: boolean;
  includeDueSoon: boolean;
  includeUpcoming30: boolean;
  includeCashPosition: boolean;
  includeFxPositions: boolean;
  lastGeneratedAt: string | null;
  lastSentAt: string | null;
  cronSchedule: string;
}

export interface AuditLog {
  id: number;
  userId: number | null;
  username: string;
  companyId: number | null;
  action: string;
  details: Record<string, any>;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: string;
}

export interface CategoryPrediction {
  categoryId: number;
  categoryName: string;
  historical: number[];
  predicted: number[];
  lower: number[];
  upper: number[];
  r2: number;
  confidence: ConfidenceLevel;
  trend: TrendDirection;
  totalPredicted: number;
  mean: number;
}

export interface AIPredictionResponse {
  currentMonth: number;
  horizon: number;
  yearsOfData: number;
  monthsOfData: number;
  inflows: CategoryPrediction[];
  outflows: CategoryPrediction[];
  projectedCash: number[];
  algorithm: {
    method: string;
    weights: { linear: number; ma: number; es: number };
  };
}

// ============== Internal types (DB rows etc.) ==============
export interface AuthContext {
  userId: number;
  username: string;
  role: UserRole;
  companyId?: number;
}

export interface ErrorResponse {
  error: string;
  message: string;
  details?: Record<string, any>;
}

// ============== Role hierarchy ==============
// Faz 4 ADR-0005: hr_manager rolü eklendi. Hiyerarşi:
//   viewer < editor < hr_manager < cfo < admin
export const ROLE_LEVEL: Record<UserRole, number> = {
  viewer: 1,
  editor: 2,
  hr_manager: 3,
  cfo: 4,
  admin: 5,
};

export function canRole(role: UserRole, minRole: UserRole): boolean {
  return ROLE_LEVEL[role] >= ROLE_LEVEL[minRole];
}
