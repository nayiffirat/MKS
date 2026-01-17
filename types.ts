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
  FERTILIZER = 'Gübre',
  OTHER = 'Diğer'
}

export interface Pesticide {
  id: string;
  name: string;
  activeIngredient: string;
  defaultDosage: string;
  category: PesticideCategory;
}

export interface VisitLog {
  id: string;
  farmerId: string;
  date: string; // ISO String
  note: string;
  photoUri?: string; // Base64 or Blob URL
  aiAnalysis?: string; // Gemini analysis result
}

export interface PrescriptionItem {
  pesticideId: string;
  pesticideName: string;
  dosage: string;
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

export enum NewsCategory {
  AGRICULTURE = 'TARIM',
  TECHNOLOGY = 'TEKNOLOJİ',
  ECONOMY = 'EKONOMİ',
  POLITICS = 'SİYASET',
  SPORTS = 'SPOR',
  HEALTH = 'SAĞLIK',
  AUTOMOTIVE = 'OTOMOTİV',
  MAGAZINE = 'MAGAZİN',
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

export type ViewState = 'DASHBOARD' | 'FARMERS' | 'PESTICIDES' | 'VISITS' | 'PRESCRIPTIONS' | 'NEWS';