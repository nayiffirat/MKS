
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
}

export interface Payment {
  id: string;
  farmerId: string;
  amount: number;
  date: string;
  method: 'CASH' | 'CARD' | 'CHECK' | 'OTHER';
  note?: string;
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
}

export interface VisitLog {
  id: string;
  farmerId: string;
  fieldId?: string;
  date: string; // ISO String
  note: string;
  photoUri?: string; // Base64 or Blob URL
  aiAnalysis?: string; // Gemini analysis result
  latitude?: number;
  longitude?: number;
  pestFound?: string; // e.g., "Tuta Absoluta"
  diseaseFound?: string; // e.g., "Pas Hastalığı"
  severity?: 'LOW' | 'MEDIUM' | 'HIGH';
  village?: string;
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
}

export enum NewsCategory {
  AGRICULTURE = 'TARIM',
  TECHNOLOGY = 'TEKNOLOJİ',
  ECONOMY = 'EKONOMİ',
  POLITICS = 'SİYASET',
  SPORTS = 'SPOR',
  HEALTH = 'SAĞLIK',
  AUTOMOTIVE = 'OTOMOTİV',
  MAGAZİN = 'MAGAZİN',
  WORLD = 'DÜNYA'
}

export interface NewsItem {
  id: string;
  category: NewsCategory;
  title: string;
  summary: string;
  detailText: string;
  imageUrl?: string;
  sourceUrl: string;
  date: string; // ISO String
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
  fullName: string;
  phoneNumber: string;
  companyName: string;
  title: string;
  assistantVoice?: 'MALE' | 'FEMALE';
  selectedCity?: AgriCity;
  lastSyncTime?: string;
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
}

export interface SupplierPurchase {
  id: string;
  supplierId: string;
  date: string;
  items: {
    pesticideId: string;
    pesticideName: string;
    quantity: number;
    unit: string;
    buyingPrice: number;
  }[];
  totalAmount: number;
  note?: string;
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
}

export interface MyPayment {
  id: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  issueDate: string;
  dueDate: string;
  type: 'CHECK' | 'PROMISSORY_NOTE' | 'OTHER';
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  note?: string;
}

export type ViewState = 'DASHBOARD' | 'FARMERS' | 'PESTICIDES' | 'PRESCRIPTIONS' | 'VISITS' | 'NEWS' | 'CONTACT' | 'SETTINGS' | 'NOTIFICATIONS' | 'PROFILE' | 'STATISTICS' | 'FIELD_ASSISTANT' | 'REMINDERS' | 'INVENTORY' | 'DEBT_TRACKING' | 'REGIONAL_ALERTS' | 'DISEASE_DIAGNOSIS' | 'MAP_VIEW' | 'PRODUCER_PORTAL' | 'COMPATIBILITY_CHECK' | 'SUPPLIERS' | 'PAYMENTS';

export type UIScale = 'SMALL' | 'MEDIUM' | 'LARGE';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
