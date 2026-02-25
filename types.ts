
export interface AgriCity {
  name: string;
  lat: number;
  lon: number;
  admin1?: string; 
}

export interface Farmer {
  id: string;
  fullName: string;
  phoneNumber: string;
  village: string;
  fieldSize: number; // Dekar
  crops: string;
  avatarUrl?: string;
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
  date: string; // ISO String
  note: string;
  photoUri?: string; // Base64 or Blob URL
  aiAnalysis?: string; // Gemini analysis result
  latitude?: number;
  longitude?: number;
}

export interface PrescriptionItem {
  pesticideId: string;
  pesticideName: string;
  dosage: string;
  quantity?: string; // Opsiyonel ürün adedi (örn: "2", "3 Kutu")
}

export interface Prescription {
  id: string; // REC-YYYY-XXX (Primary Key)
  farmerId: string; // Foreign Key to Farmer
  date: string;
  prescriptionNo: string; // Explicit display number if different from ID
  engineerName: string;
  items: PrescriptionItem[]; // Stored as JSON in DB
  isOfficial: boolean;
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
}

export type ViewState = 'DASHBOARD' | 'FARMERS' | 'PESTICIDES' | 'PRESCRIPTIONS' | 'VISITS' | 'NEWS' | 'CONTACT' | 'SETTINGS' | 'NOTIFICATIONS' | 'PROFILE' | 'STATISTICS' | 'FIELD_ASSISTANT' | 'REMINDERS';

export type UIScale = 'SMALL' | 'MEDIUM' | 'LARGE';
