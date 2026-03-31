
export type AccountType = 'DEALER' | 'COMPANY';
export type TeamRole = 'MANAGER' | 'SALES' | 'WAREHOUSE' | 'ACCOUNTING';
export type Language = 'tr' | 'en' | 'ar';

export interface TeamMember {
  id: string;
  username: string;
  password?: string;
  role: TeamRole;
  fullName: string;
  createdAt: string;
  notes?: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
}

export interface AgriCity {
  name: string;
  lat: number;
  lon: number;
  admin1?: string; 
}

export interface Field {
  id: string;
  name: string;
  size: number;
  crop: string;
  plantingDate?: string; // ISO String
  currentStage?: string;
}

export interface ManualDebt {
  id: string;
  farmerId: string;
  amount: number;
  date: string;
  note?: string;
  createdById?: string;
}

export interface Payment {
  id: string;
  farmerId: string;
  amount: number;
  date: string;
  method: 'CASH' | 'CARD' | 'CHECK' | 'TEDYE' | 'OTHER';
  dueDate?: string;
  note?: string;
  accountId?: string; // Linked account (Cash or Bank)
  createdById?: string;
  deletedAt?: string;
}

export interface Account {
  id: string;
  name: string;
  type: 'CASH' | 'BANK';
  balance: number;
  iban?: string;
  accountHolder?: string;
  bankLogo?: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  date: string;
  description: string;
  relatedId?: string;
  category?: string;
}

export interface Farmer {
  id: string;
  fullName: string;
  phoneNumber: string;
  village: string;
  fields: Field[];
  avatarUrl?: string;
  totalDebt?: number; // Calculated or stored
  balance?: number; // Current balance (negative means debt)
  latitude?: number;
  longitude?: number;
  createdById?: string;
  deletedAt?: string;
}

export enum PesticideCategory {
  INSECTICIDE = 'İnsektisit (Böcek)',
  HERBICIDE = 'Herbisit (Ot)',
  FUNGICIDE = 'Fungisit (Mantar)',
  FERTILIZER = 'Gübre / Besleme',
  GROWTH_REGULATOR = 'Bitki Gelişim Düzenleyici (BGD)',
  OTHER = 'Diğer'
}

export interface Pesticide {
  id: string;
  name: string;
  activeIngredient: string;
  defaultDosage: string;
  category: PesticideCategory;
  description?: string;
  barcode?: string;
  deletedAt?: string;
}

export interface VisitLog {
  id: string;
  farmerId: string;
  fieldId?: string;
  date: string; // ISO String
  note: string;
  photoUri?: string; // Base64 or Blob URL
  latitude?: number;
  longitude?: number;
  pestFound?: string; // e.g., "Tuta Absoluta"
  diseaseFound?: string; // e.g., "Pas Hastalığı"
  severity?: 'LOW' | 'MEDIUM' | 'HIGH';
  village?: string;
  createdById?: string;
  deletedAt?: string;
}

export interface PrescriptionItem {
  pesticideId: string;
  pesticideName: string;
  dosage: string;
  quantity?: string; // Opsiyonel ürün adedi (örn: "2", "3 Kutu")
  unitPrice?: number;
  totalPrice?: number;
}

export interface Prescription {
  id: string; // REC-YYYY-XXX (Primary Key)
  farmerId: string; // Foreign Key to Farmer
  fieldId?: string;
  date: string;
  prescriptionNo: string; // Explicit display number if different from ID
  engineerName: string;
  items: PrescriptionItem[]; // Stored as JSON in DB
  isOfficial: boolean;
  isProcessed?: boolean;
  isInventoryProcessed?: boolean;
  totalAmount?: number;
  priceType?: 'CASH' | 'TERM';
  status?: 'PENDING' | 'APPROVED' | 'DELIVERED' | 'INVOICED';
  createdById?: string;
  deliveredById?: string;
  deletedAt?: string;
}

export interface Reminder {
  id: string;
  title: string;
  description: string;
  date: string; // ISO String
  isCompleted: boolean;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  farmerIds?: string[]; // Array of linked farmers
  recurrence: 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  createdById?: string;
}

export interface AppNotification {
  id: string;
  type: 'WARNING' | 'INFO' | 'SUCCESS' | 'SYSTEM';
  title: string;
  message: string;
  date: string;
  isRead: boolean;
}

export interface UserProfile {
  id?: string;
  email?: string;
  createdAt?: string;
  lastLoginAt?: string;
  fullName: string;
  phoneNumber: string;
  companyName: string;
  title: string;
  selectedCity?: AgriCity;
  lastSyncTime?: string;
  highContrastMode?: boolean;
  assistantVoice?: 'male' | 'female';
  currency?: 'TRY' | 'USD' | 'EUR';
  role?: 'admin' | 'user';
  subscriptionStatus?: 'trial' | 'active' | 'expired';
  subscriptionEndsAt?: string;
  accountType?: AccountType;
  adminUsername?: string;
  adminPassword?: string;
  language?: Language;
}

export interface InventoryItem {
  id: string;
  pesticideId: string;
  pesticideName: string;
  category: PesticideCategory;
  quantity: number; // Stock quantity
  unit: string; // e.g., 'Adet', 'Litre', 'Kg'
  buyingPrice: number;
  sellingPrice: number;
  cashPrice?: number;
  cashBuyingPrice?: number;
  barcode?: string;
  lastUpdated: string;
  lowStockThreshold?: number; // Threshold for alerts
}

export interface Supplier {
  id: string;
  name: string;
  phoneNumber: string;
  address?: string;
  totalDebt: number; // Total amount purchased
  balance: number; // Current balance (negative means we owe money)
  deletedAt?: string;
}

export interface SupplierPurchase {
  id: string;
  supplierId: string;
  date: string;
  receiptNo?: string;
  items: {
    pesticideId: string;
    pesticideName: string;
    quantity: number;
    unit: string;
    buyingPrice: number;
  }[];
  totalAmount: number;
  note?: string;
  createdById?: string;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  amount: number;
  date: string;
  method: 'CASH' | 'CARD' | 'CHECK' | 'PROMISSORY_NOTE' | 'OTHER';
  dueDate?: string; // For checks and promissory notes
  isPaid?: boolean;
  note?: string;
  accountId?: string;
  createdById?: string;
  installments?: number;
  producerCardMonths?: number;
}

export interface MyPayment {
  id: string;
  supplierId?: string;
  supplierName?: string;
  farmerId?: string;
  farmerName?: string;
  amount: number;
  issueDate: string;
  dueDate: string;
  type: 'CHECK' | 'PROMISSORY_NOTE' | 'TEDYE' | 'OTHER';
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  note?: string;
  accountId?: string;
  relatedId?: string;
  createdById?: string;
}

export interface TurnoverLog {
  id: string;
  year: number;
  date: string;
  type: 'FINANCIAL' | 'INVENTORY';
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  date: string;
  category: 'RENT' | 'ELECTRICITY' | 'WATER' | 'FUEL' | 'SALARY' | 'TAX' | 'HOME' | 'OTHER';
  note?: string;
  accountId?: string;
  createdById?: string;
}

export type ViewState = 'DASHBOARD' | 'FARMERS' | 'PESTICIDES' | 'PRESCRIPTIONS' | 'VISITS' | 'CONTACT' | 'SETTINGS' | 'NOTIFICATIONS' | 'PROFILE' | 'STATISTICS' | 'REMINDERS' | 'INVENTORY' | 'DEBT_TRACKING' | 'REGIONAL_ALERTS' | 'PRODUCER_PORTAL' | 'COMPATIBILITY_CHECK' | 'SUPPLIERS' | 'PAYMENTS' | 'EXPENSES' | 'KASA' | 'CALCULATOR' | 'MIXTURE_TEST' | 'RECENT_TRANSACTIONS' | 'REPORTS' | 'ADMIN_PANEL' | 'TEAM' | 'MESSAGES' | 'PERFORMANCE' | 'TRASH';

export type UIScale = 'SMALL' | 'MEDIUM' | 'LARGE';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
