export type TeamRole = 'MANAGER' | 'SALES' | 'WAREHOUSE' | 'ACCOUNTING';
export type Language = 'tr' | 'en' | 'ar';

export interface TeamMember {
  id: string;
  username: string;
  /** Stored as salted SHA-256 hash (`sha256$<salt>$<digest>`) */
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

export interface SiloTransaction {
  id: string;
  type: 'BUY' | 'SELL' | 'PAYMENT_IN' | 'PAYMENT_OUT';
  product: string;
  person: string;
  date: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  dueDate?: string;
  paymentType?: 'CASH' | 'TERM';
  plateNumber?: string;
  driverPhone?: string;
  carrierName?: string;
  routeFrom?: string;
  routeTo?: string;
  tripStatus?: 'IN_TRANSIT' | 'DELIVERED';
  transportCost?: number;
  transportPayer?: 'US' | 'THEM';
  commissionRate?: number;
  commissionAmount?: number;
  grossWeightKg?: number;
  tareWeightKg?: number;
  rawNetWeightKg?: number;
  moisturePct?: number;
  hectoliter?: number;
  foreignMatterPct?: number;
  deductionPct?: number;
  deductionKg?: number;
  barterFarmerId?: string;
  barterOffsetAmount?: number;
  linkedPaymentId?: string;
  note?: string;
  documentUrl?: string;
  createdById?: string;
  lastUpdated?: string;
  deletedAt?: string;
}

export interface SiloContact {
  id: string;
  name: string;
  phone?: string;
  tcNo?: string;
  address?: string;
  type: 'BUYER' | 'SELLER' | 'BOTH';
  createdById?: string;
  deletedAt?: string;
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
  /** Standard RFC 7946 WGS84 (EPSG:4326) GeoJSON Feature/Polygon serialized for Firestore compatibility */
  polygonGeoJson?: string;
  /** Flat coordinate ring for fast Leaflet rendering */
  polygonPoints?: { lat: number; lng: number }[];
  /** [minLon, minLat, maxLon, maxLat] */
  bbox?: [number, number, number, number];
  polygonBbox?: [number, number, number, number];
  centroid?: { lat: number; lon: number };
  centroidLat?: number;
  centroidLng?: number;
  lat?: number;
  lng?: number;
  il?: string;
  ilce?: string;
  mahalle?: string;
  ada?: string;
  parsel?: string;
  nitelik?: string;
  tkgmIl?: string;
  tkgmIlce?: string;
  tkgmMahalle?: string;
  tkgmAda?: string;
  tkgmParsel?: string;
  lastSatelliteCaptureDate?: string;
  lastSatelliteNdviMean?: number;
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

export type CardSettlementOption = 'UNBLOCKED' | 'DAYS_15' | 'DAYS_30' | 'DAYS_45';

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
  cardOption?: CardSettlementOption;
  commissionRate?: number;
  commissionAmount?: number;
  netAmount?: number;
  unblockDate?: string;
  isUnblocked?: boolean;
  crop?: string;
}

export interface Account {
  id: string;
  name: string;
  type: 'CASH' | 'BANK';
  balance: number;
  iban?: string;
  accountHolder?: string;
  bankLogo?: string;
  deletedAt?: string;
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
  partyName?: string;
  partyType?: 'FARMER' | 'SUPPLIER' | 'EXPENSE' | 'OTHER';
  partyId?: string;
  deletedAt?: string;
}

export interface Farmer {
  id: string;
  fullName: string;
  phoneNumber: string;
  village: string;
  tcNo?: string;
  fields: Field[];
  avatarUrl?: string;
  totalDebt?: number; // Calculated or stored
  balance?: number; // Current balance (negative means debt)
  creditLimit?: number;
  riskScoreOverride?: 'A' | 'B' | 'C' | 'D';
  latitude?: number;
  longitude?: number;
  portalToken?: string; // Unguessable capability token for secure Producer Portal sharing
  createdById?: string;
  lastUpdated?: string;
  deletedAt?: string;
}

export interface PortalShareSnapshot {
  portalToken: string;
  engineerId: string;
  farmerId: string;
  updatedAt: string;
  engineerProfile: {
    fullName: string;
    companyName: string;
    phoneNumber?: string;
    currency: 'TRY' | 'USD' | 'EUR';
    bankAccounts?: {
      name: string;
      iban: string;
      accountHolder?: string;
    }[];
  };
  farmer: {
    id: string;
    fullName: string;
    village: string;
    fields?: {
      id: string;
      name: string;
      size: number;
      crop: string;
      plantingDate?: string;
      mahalle?: string;
      ada?: string;
      parsel?: string;
      lat?: number;
      lng?: number;
    }[];
  };
  prescriptions: {
    id: string;
    prescriptionNo: string;
    date: string;
    totalAmount?: number;
    priceType?: 'CASH' | 'TERM';
    type?: 'SALE' | 'RETURN';
    items: {
      pesticideName: string;
      dosage: string;
      quantity?: string;
      unitPrice?: number;
      totalPrice?: number;
    }[];
  }[];
  visits: {
    id: string;
    date: string;
    note: string;
  }[];
  payments: {
    id: string;
    amount: number;
    date: string;
    method?: string;
    note?: string;
  }[];
  manualDebts: {
    id: string;
    amount: number;
    date: string;
    note?: string;
  }[];
}

export enum PesticideCategory {
  INSECTICIDE = 'İnsektisit (Böcek)',
  HERBICIDE = 'Herbisit (Ot)',
  FUNGICIDE = 'Fungisit (Mantar)',
  FERTILIZER = 'Gübre / Besleme',
  NEMATICIDE = 'Nematod',
  GRANULAR_FERTILIZER = 'Granül Gübre',
  SEED = 'Tohum',
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
  beforePhotoUri?: string; // Öncesi fotoğrafı (#5 kıyaslama kaydırıcısı için)
  voiceTranscript?: string;
  latitude?: number;
  longitude?: number;
  pestFound?: string; // e.g., "Tuta Absoluta"
  diseaseFound?: string; // e.g., "Pas Hastalığı"
  severity?: 'LOW' | 'MEDIUM' | 'HIGH';
  village?: string;
  createdById?: string;
  lastUpdated?: string;
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
  gtin?: string;
  lotNumber?: string;
  expiryDate?: string;
  serialNumber?: string;
  serialNumbers?: string[];
  batchAllocations?: {
    lotNumber: string;
    expiryDate?: string;
    quantity: number;
    serialNumbers?: string[];
  }[];
  soldAsPack?: boolean;
  packCount?: number;
  quarantineReason?: string;
}

export interface PrescriptionTemplate {
  id: string;
  name: string;
  targetCrop?: string;
  targetDisease?: string;
  note?: string;
  items: PrescriptionItem[];
  createdAt: string;
  lastUpdated?: string;
  deletedAt?: string;
}

export interface Prescription {
  id: string; // REC-YYYY-XXX (Primary Key)
  farmerId: string; // Foreign Key to Farmer
  farmerTcNo?: string;
  fieldId?: string;
  fieldIds?: string[];
  plantId?: string;
  crop?: string;
  cropName?: string;
  date: string;
  type?: 'SALE' | 'RETURN'; // Differentiate between sales and returns
  prescriptionNo: string; // Explicit display number if different from ID
  engineerName: string;
  items: PrescriptionItem[]; // Stored as JSON in DB
  isOfficial: boolean;
  saleRegistryMode?: 'BKTS' | 'FREE';
  bReceteCode?: string;
  isProcessed?: boolean;
  isInventoryProcessed?: boolean;
  totalAmount?: number;
  priceType?: 'CASH' | 'TERM';
  accountId?: string;
  discountAmount?: number;
  dueDate?: string; // ISO String for term payment due date
  status?: 'PENDING' | 'APPROVED' | 'DELIVERED' | 'INVOICED';
  createdById?: string;
  deliveredById?: string;
  lastUpdated?: string;
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

export type NotificationCategory =
  | 'PAYMENT_DUE'
  | 'CHECK_NOTE_CARD'
  | 'DAILY_CALL_LIST'
  | 'WEATHER_ALERT'
  | 'APP_UPDATE'
  | 'SYSTEM';

export interface NotificationCallItem {
  id: string;
  name: string;
  phone?: string;
  reason: string;
  amount?: number;
}

export interface NotificationPreferences {
  paymentDue: boolean;
  checkNoteCard: boolean;
  dailyCallList: boolean;
  weatherAlerts: boolean;
  appUpdates: boolean;
}

export interface AppNotification {
  id: string;
  type: 'WARNING' | 'INFO' | 'SUCCESS' | 'SYSTEM';
  category?: NotificationCategory;
  title: string;
  message: string;
  date: string;
  isRead: boolean;
  targetView?: ViewState;
  actionLabel?: string;
  callItems?: NotificationCallItem[];
}

export interface UserProfile {
  id?: string;
  uid?: string;
  email?: string;
  createdAt?: string;
  lastLoginAt?: string;
  fullName: string;
  phoneNumber: string;
  companyName: string;
  title: string;
  selectedCity?: AgriCity;
  notificationPrefs?: NotificationPreferences;
  lastSyncTime?: string;
  highContrastMode?: boolean;
  colorMode?: 'DARK' | 'LIGHT';
  theme?: 'DEFAULT' | 'TECHNICAL' | 'ORGANIC' | 'MINIMAL' | 'BARBIE' | 'APPLE' | 'LIGHT' | 'GLASSY_V30';
  assistantVoice?: 'male' | 'female';
  currency?: 'TRY' | 'USD' | 'EUR';
  role?: 'admin' | 'user';
  subscriptionStatus?: 'trial' | 'active' | 'expired';
  subscriptionTier?: 'PRO' | 'ULTRA' | 'MAX';
  subscriptionEndsAt?: string;
  subscriptionEndsAtMs?: number;
  adminUsername?: string;
  /** Stored as salted SHA-256 hash (`sha256$<salt>$<digest>`) */
  adminPassword?: string;
  language?: Language;
  // İşyeri Kaşesi (Official Business Stamp)
  stampEnabled?: boolean;
  stampTitle?: string;
  stampSubTitle?: string;
  stampTaxInfo?: string;
  stampTradeInfo?: string;
  stampAddressPhone?: string;
  stampColor?: string;
  stampShape?: 'RECTANGLE' | 'OVAL';
  // Rol Bazlı Maliyet & Kâr Gizleme (#47)
  lastUpdate?: string;
  hideCostAndProfit?: boolean;
  hideBuyingPricesForStaff?: boolean;
  hideCostInScreens?: boolean;
  // Dinamik WhatsApp Mesaj Şablonları (#33)
  whatsappTemplates?: {
    debtReminder?: string;
    collectionReceipt?: string;
    prescriptionShare?: string;
    announcement?: string;
  };
  // Tarım Bakanlığı BKTS / GTS / B-Reçete Senkron Yapılandırması
  ministryConfig?: {
    gln?: string;
    bktsEnabled?: boolean;
    gtsEnabled?: boolean;
    bReceteEnabled?: boolean;
  };
}

export interface InventoryBatch {
  lotNumber: string;
  expiryDate?: string; // YYYY-MM-DD
  quantity: number;
  serialNumbers?: string[];
  receivedAt?: string;
}

export interface StockCountRecord {
  id: string;
  date: string;
  countedQuantity: number;
  previousQuantity?: number;
  unit: string;
  approvedBy?: string;
  note?: string;
}

export interface ConsignmentRecord {
  id: string;
  date: string;
  partyName: string;
  type: 'GIVEN' | 'TAKEN' | 'RETURNED';
  quantity: number;
  note?: string;
}

export interface QuarantineRecord {
  id: string;
  date: string;
  farmerId?: string;
  farmerName?: string;
  prescriptionId?: string;
  lotNumber?: string;
  expiryDate?: string;
  quantity: number;
  reason: string;
  resolved?: boolean;
  resolvedAt?: string;
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
  gtin?: string;
  lotNumber?: string;
  expiryDate?: string; // YYYY-MM-DD
  serialNumber?: string;
  batches?: InventoryBatch[];
  revision?: number;
  packUnitName?: string; // Örn: 'Koli', 'Çuval', 'Palet'
  packSize?: number; // Örn: 1 Koli = 12 Adet
  consignmentQty?: number;
  consignmentLogs?: ConsignmentRecord[];
  quarantineQty?: number;
  quarantineLogs?: QuarantineRecord[];
  lastUpdated: string;
  lowStockThreshold?: number; // Threshold for alerts
  deletedAt?: string;
  adjustments?: { date: string; amount: number; note: string }[];
  lastAuditDate?: string;
  auditHistory?: StockCountRecord[];
}

export interface Supplier {
  id: string;
  name: string;
  phoneNumber: string;
  tcNo?: string;
  vkn?: string;
  address?: string;
  totalDebt: number; // Total amount purchased
  balance: number; // Current balance (negative means we owe money)
  deletedAt?: string;
}

export interface SupplierPurchase {
  id: string;
  supplierId: string;
  date: string;
  type?: 'PURCHASE' | 'RETURN' | 'SALE';
  receiptNo?: string;
  items: {
    pesticideId: string;
    pesticideName: string;
    quantity: number;
    unit: string;
    buyingPrice: number;
    sellingPrice?: number;
    gtin?: string;
    barcode?: string;
    lotNumber?: string;
    expiryDate?: string;
    serialNumber?: string;
    serialNumbers?: string[];
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
  cardOption?: CardSettlementOption;
  unblockDate?: string;
  commissionRate?: number;
  commissionAmount?: number;
  autoCollected?: boolean;
  checkSerialNo?: string;
  bankName?: string;
  drawerName?: string;
  issuerName?: string;
  portfolioStatus?: 'PORTFOLIO' | 'ENDORSED' | 'COLLECTED' | 'BOUNCED' | 'ISSUED';
  endorsedToSupplierId?: string;
  endorsedToSupplierName?: string;
  endorsedDate?: string;
  lastUpdated?: string;
}

export interface SavedMapFeature {
  id: string;
  name: string;
  type: 'AREA' | 'DISTANCE' | 'COORDINATE';
  points: { lat: number; lng: number }[];
  farmerId?: string;
  fieldId?: string;
  areaDaa?: number;
  dekar?: number;
  polygonGeoJson?: string;
  tkgmInfo?: Record<string, any>;
  ada?: string;
  parsel?: string;
  mahalle?: string;
  ilce?: string;
  il?: string;
  createdAt?: string;
  lastUpdated?: string;
  deletedAt?: string;
}

export interface SatelliteCacheRecord {
  id: string; // `${fieldId}_${polygonHash}`
  fieldId: string;
  farmerId?: string;
  polygonHash: string;
  captureDate?: string; // Real Sentinel-2 ISO timestamp
  captureDatetime?: string; // Real Sentinel-2 ISO timestamp
  cloudCover: number;
  cachedAt?: string;
  fetchedAt?: string;
  expiresAt?: string;
  bounds?: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  bbox?: [number, number, number, number];
  areaDaa?: number;
  layers?: {
    ndvi: string; // PNG RGBA data URL
    ndmi: string; // PNG RGBA data URL
    wetness: string; // PNG RGBA data URL
  };
  ndviPngDataUrl?: string;
  ndmiPngDataUrl?: string;
  wetnessPngDataUrl?: string;
  summary?: {
    ndviStatus?: string;
    ndmiStatus?: string;
    wetnessStatus?: string;
  };
  postCaptureRainMm?: number;
  rainSinceCaptureMm?: number;
  rainCheckedAt?: string;
}

export interface SyncOutboxEntry {
  id: string; // `${collection}:${itemId}`
  collection: string;
  itemId: string;
  op: 'UPSERT' | 'DELETE';
  payload?: any;
  updatedAt: string;
  retryCount?: number;
}

export interface PortalInquiry {
  id: string;
  portalToken: string;
  engineerId: string;
  farmerId: string;
  farmerName: string;
  type: 'QUESTION' | 'PAYMENT_NOTICE';
  message: string;
  photoBase64?: string;
  paymentAmount?: number;
  claimedAmount?: number;
  ibanUsed?: string;
  engineerReply?: string;
  createdAt: string;
  status: 'NEW' | 'OPEN' | 'READ' | 'ANSWERED' | 'RESOLVED';
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

export type ViewState = 'DASHBOARD' | 'FARMERS' | 'PESTICIDES' | 'PRESCRIPTIONS' | 'VISITS' | 'CONTACT' | 'SETTINGS' | 'NOTIFICATIONS' | 'PROFILE' | 'STATISTICS' | 'REMINDERS' | 'INVENTORY' | 'DEBT_TRACKING' | 'MAP' | 'PRODUCER_PORTAL' | 'COMPATIBILITY_CHECK' | 'SUPPLIERS' | 'PAYMENTS' | 'EXPENSES' | 'KASA' | 'CALCULATOR' | 'RECENT_TRANSACTIONS' | 'REPORTS' | 'ADMIN_PANEL' | 'TEAM' | 'MESSAGES' | 'PERFORMANCE' | 'TRASH' | 'LAND_DETAIL' | 'NEWS_DETAIL' | 'NEWS' | 'FINDEKS' | 'PLANTS' | 'AI_ASSISTANT' | 'SMART_STOCK' | 'SILO' | 'MKS_MUHENDISIM' | 'USER_GUIDE';

export type UIScale = 'SMALL' | 'MEDIUM' | 'LARGE';

export interface MinistryShipmentLine {
  gtin: string;
  name: string;
  batch: string;
  expiry?: string;
  serial?: string;
  qty: number;
}

export interface MinistryShipmentRecord {
  id: string;
  sscc: string;
  senderGln?: string;
  senderName: string;
  waybillNo: string;
  itemCount: number;
  date: string;
  status: 'PENDING' | 'ACCEPTED';
  acceptedAt?: string;
  lines: MinistryShipmentLine[];
  lastUpdated?: string;
  deletedAt?: string;
}

export interface MinistryRecord {
  id: string;
  system: 'BKTS' | 'GTS';
  recordType: 'SHIPMENT_ACCEPT' | 'FARMER_SALE' | 'FREE_SALE' | 'RETURN';
  date: string;
  documentNo: string;
  prescriptionId?: string;
  bReceteCode?: string;
  farmerId?: string;
  farmerName?: string;
  farmerTcNo?: string;
  supplierName?: string;
  sscc?: string;
  waybillNo?: string;
  pesticideId?: string;
  productName: string;
  gtin: string;
  lotNumber: string;
  serialNumber?: string;
  expiryDate?: string;
  quantity: number;
  unit?: string;
  status: 'Dışa Aktarıma Hazır' | 'Kuyrukta' | 'Kayıtsız Serbest Satış';
  lastUpdated?: string;
  deletedAt?: string;
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
