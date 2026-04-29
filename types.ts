
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
  farmerName?: string;
  amount: number;
  date: string;
  note?: string;
  createdById?: string;
  deletedAt?: string;
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
  deletedAt?: string;
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
  buyingPrice?: number;
}

export interface Prescription {
  id: string; // REC-YYYY-XXX (Primary Key)
  farmerId: string; // Foreign Key to Farmer
  fieldId?: string;
  fieldIds?: string[];
  plantId?: string;
  date: string;
  type?: 'SALE' | 'RETURN'; // Differentiate between sales and returns
  prescriptionNo: string; // Explicit display number if different from ID
  engineerName: string;
  items: PrescriptionItem[]; // Stored as JSON in DB
  isOfficial: boolean;
  isProcessed?: boolean;
  isInventoryProcessed?: boolean;
  totalAmount?: number;
  priceType?: 'CASH' | 'TERM';
  discountAmount?: number;
  dueDate?: string; // ISO String for term payment due date
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
  theme?: 'DEFAULT' | 'TECHNICAL' | 'ORGANIC' | 'MINIMAL' | 'BARBIE';
  assistantVoice?: 'male' | 'female';
  currency?: 'TRY' | 'USD' | 'EUR';
  role?: 'admin' | 'user';
  subscriptionStatus?: 'trial' | 'active' | 'expired';
  subscriptionEndsAt?: string;
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
  deletedAt?: string;
  adjustments?: { date: string; amount: number; note: string; }[];
  lastAuditDate?: string;
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
  type?: 'PURCHASE' | 'RETURN';
  receiptNo?: string;
  items: {
    pesticideId: string;
    pesticideName: string;
    quantity: number;
    unit: string;
    buyingPrice: number;
    sellingPrice?: number;
  }[];
  totalAmount: number;
  note?: string;
  isInventoryProcessed?: boolean;
  createdById?: string;
  deletedAt?: string;
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
  type?: 'PAY' | 'RECEIVE';
  deletedAt?: string;
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
  type: 'CHECK' | 'PROMISSORY_NOTE' | 'TEDYE' | 'CARD_INSTALLMENT' | 'DEFERRED_CARD' | 'OTHER';
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  note?: string;
  accountId?: string;
  relatedId?: string;
  createdById?: string;
  deletedAt?: string;
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
  deletedAt?: string;
}

export interface News {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  date: string;
  authorId?: string;
  category?: string;
  deletedAt?: string;
}

export interface SystemError {
  id: string;
  timestamp: number;
  source: string;
  message: string;
  stack?: string;
  userEmail?: string;
}

export interface CollectionLog {
  id: string;
  farmerId: string;
  date: string;
  type: 'PHONE_CALL' | 'WP_MESSAGE' | 'IN_PERSON' | 'OTHER';
  status: 'REMINDED' | 'PROMISED_TO_PAY' | 'PAID' | 'UNREACHABLE';
  note?: string;
  nextCallDate?: string;
  createdById?: string;
  deletedAt?: string;
}

export interface Plant {
  id: string;
  name: string;
  category?: string;
  maturityDate?: string; // Vade tarihi belirlemek için (Örn: 10-31)
  defaultDosage?: string;
  culturalPractices?: string;
  description?: string;
  deletedAt?: string;
}

export type ViewState = 'DASHBOARD' | 'FARMERS' | 'PESTICIDES' | 'PRESCRIPTIONS' | 'VISITS' | 'CONTACT' | 'SETTINGS' | 'NOTIFICATIONS' | 'PROFILE' | 'STATISTICS' | 'REMINDERS' | 'INVENTORY' | 'DEBT_TRACKING' | 'MAP' | 'PRODUCER_PORTAL' | 'COMPATIBILITY_CHECK' | 'SUPPLIERS' | 'PAYMENTS' | 'EXPENSES' | 'KASA' | 'CALCULATOR' | 'RECENT_TRANSACTIONS' | 'REPORTS' | 'ADMIN_PANEL' | 'TEAM' | 'MESSAGES' | 'PERFORMANCE' | 'TRASH' | 'LAND_DETAIL' | 'NEWS_DETAIL' | 'NEWS' | 'FINDEKS' | 'PLANTS' | 'AI_ASSISTANT' | 'SMART_STOCK';

export type UIScale = 'SMALL' | 'MEDIUM' | 'LARGE';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
