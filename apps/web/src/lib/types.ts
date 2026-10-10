export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type RecordStatus = "ACTIVE" | "INACTIVE";
export type ProductUnit =
  | "UNIDADE"
  | "KG"
  | "G"
  | "L"
  | "ML"
  | "CAIXA"
  | "PACOTE"
  | "ROLLO";

export const productUnitLabels: Record<ProductUnit, string> = {
  UNIDADE: "unidade",
  KG: "kg",
  G: "g",
  L: "l",
  ML: "ml",
  CAIXA: "caixa",
  PACOTE: "pacote",
  ROLLO: "rolo",
};

export type StockMovementType =
  | "IN"
  | "OUT"
  | "ADJUST_POSITIVE"
  | "ADJUST_NEGATIVE";

export const stockMovementTypeLabels: Record<StockMovementType, string> = {
  IN: "Entrada",
  OUT: "Saída",
  ADJUST_POSITIVE: "Ajuste +",
  ADJUST_NEGATIVE: "Ajuste -",
};

export interface CategoryDto {
  id: string;
  name: string;
  description: string | null;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierDto {
  id: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProductDto {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  unit: ProductUnit;
  costPrice: string;
  salePrice: string;
  stockQuantity: string;
  minimumStock: string;
  status: RecordStatus;
  categoryId: string | null;
  supplierId: string | null;
  createdAt: string;
  updatedAt: string;
  lowStock: boolean;
  category: { id: string; name: string } | null;
  supplier: { id: string; name: string } | null;
}

export interface ProductListItemDto extends Omit<ProductDto, "description"> {
  description: string | null;
}

export interface MovementDto {
  id: string;
  type: StockMovementType;
  quantity: string;
  notes: string | null;
  reference: string | null;
  createdAt: string;
  product: { id: string; name: string; unit: ProductUnit };
  createdBy: { id: string; name: string };
}

export interface LowStockDto {
  id: string;
  name: string;
  sku: string | null;
  unit: ProductUnit;
  stockQuantity: string;
  minimumStock: string;
}

export interface StockMovementResult {
  movement: MovementDto;
  stockQuantity: string;
}

export type PaymentMethod = "CASH" | "CARD" | "PIX" | "OTHER";

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: "Dinheiro",
  CARD: "Cartão",
  PIX: "Pix",
  OTHER: "Outro",
};

export type SaleStatus = "COMPLETED" | "CANCELLED";

export const saleStatusLabels: Record<SaleStatus, string> = {
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};

export interface SaleItemDto {
  id: string;
  productId: string;
  productName: string;
  productSku: string | null;
  unit: ProductUnit;
  unitPrice: string;
  quantity: string;
  subtotal: string;
}

export interface SaleDto {
  id: string;
  receiptCode: string;
  clientId: string | null;
  status: SaleStatus;
  subtotal: string;
  discount: string;
  total: string;
  paymentMethod: PaymentMethod;
  paymentNote: string | null;
  createdAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdBy: { id: string; name: string };
  cancelledBy: { id: string; name: string } | null;
  client: { id: string; name: string } | null;
  items: SaleItemDto[];
}

export type CashSessionStatus = "OPEN" | "CLOSED";

export const cashSessionStatusLabels: Record<CashSessionStatus, string> = {
  OPEN: "Aberto",
  CLOSED: "Fechado",
};

export type CashMovementType = "IN" | "OUT";

export const cashMovementTypeLabels: Record<CashMovementType, string> = {
  IN: "Entrada",
  OUT: "Saída",
};

export type CashMovementOrigin =
  | "MANUAL"
  | "SALE"
  | "SALE_CANCELMENT"
  | "REVERSAL";

export const cashMovementOriginLabels: Record<CashMovementOrigin, string> = {
  MANUAL: "Manual",
  SALE: "Venda",
  SALE_CANCELMENT: "Cancelamento",
  REVERSAL: "Estorno",
};

export interface CashSessionTotals {
  entriesTotal: string;
  exitsTotal: string;
  salesTotal: string;
  cancelmentsTotal: string;
}

export interface CashSessionDto extends CashSessionTotals {
  id: string;
  status: CashSessionStatus;
  initialAmount: string;
  openingNotes: string | null;
  openedAt: string;
  openedBy: { id: string; name: string };
  closedAt: string | null;
  closedBy: { id: string; name: string } | null;
  closingNotes: string | null;
  countedAmount: string | null;
  expectedAmount: string | null;
  difference: string | null;
  expectedBalance: string;
  differenceBalance?: string | null;
}

export interface CashMovementDto {
  id: string;
  type: CashMovementType;
  origin: CashMovementOrigin;
  inCash: boolean;
  amount: string;
  description: string;
  justification: string | null;
  saleId: string | null;
  sale: { id: string; receiptCode: string } | null;
  reversalOfId: string | null;
  reversalOf: {
    id: string;
    description: string;
    amount: string;
    type: CashMovementType;
  } | null;
  reversedAt: string | null;
  reversedBy: { id: string; name: string } | null;
  reversalReason: string | null;
  cashSessionId: string | null;
  createdAt: string;
  createdBy: { id: string; name: string };
}

export interface CashSummaryDto {
  from: string | null;
  to: string | null;
  sessionId: string | null;
  salesTotal: string;
  manualEntriesTotal: string;
  manualExitsTotal: string;
  cancelmentsTotal: string;
  reversalsInTotal: string;
  reversalsOutTotal: string;
  reversalsNetTotal: string;
  totalIn: string;
  totalOut: string;
  net: string;
}

export interface ClientDto {
  id: string;
  name: string;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  cpf: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  notes: string | null;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
  _count?: { pets: number; sales: number };
}

export type PetSpecies =
  | "DOG"
  | "CAT"
  | "BIRD"
  | "RODENT"
  | "REPTILE"
  | "FISH"
  | "OTHER";

export const petSpeciesLabels: Record<PetSpecies, string> = {
  DOG: "Cachorro",
  CAT: "Gato",
  BIRD: "Ave",
  RODENT: "Roedor",
  REPTILE: "Réptil",
  FISH: "Peixe",
  OTHER: "Outro",
};

export type PetSex = "MALE" | "FEMALE" | "UNKNOWN";

export const petSexLabels: Record<PetSex, string> = {
  MALE: "Macho",
  FEMALE: "Fêmea",
  UNKNOWN: "Não informado",
};

export interface PetDto {
  id: string;
  clientId: string;
  name: string;
  species: PetSpecies;
  breed: string | null;
  sex: PetSex;
  birthDate: string | null;
  weight: string | null;
  color: string | null;
  notes: string | null;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
  client: {
    id: string;
    name: string;
    phone: string | null;
    mobile: string | null;
    email: string | null;
  } | null;
}

export interface ServiceDto {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number | null;
  price: string;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Etapa 6 — integração com WhatsApp
// ---------------------------------------------------------------------------

export type WhatsAppConfigStatus =
  | "NOT_CONFIGURED"
  | "CONFIGURED"
  | "ACTIVE"
  | "ERROR"
  | "DISCONNECTED";

export const whatsappConfigStatusLabels: Record<WhatsAppConfigStatus, string> = {
  NOT_CONFIGURED: "Não configurado",
  CONFIGURED: "Configurado",
  ACTIVE: "Ativo",
  ERROR: "Erro",
  DISCONNECTED: "Desconectado",
};

export interface WhatsAppConfigDto {
  status: WhatsAppConfigStatus;
  phoneNumberId: string | null;
  wabaId: string | null;
  displayName: string | null;
  lastError: string | null;
  lastHealthAt: string | null;
  updatedAt: string | null;
  reminderTemplateId: string | null;
  reminderLeadMinutes: number;
  provider: { provider: "mock" | "meta"; credentialsConfigured: boolean };
  webhook: {
    path: string;
    verifyConfigured: boolean;
    signatureConfigured: boolean;
  };
}

export interface WhatsAppHealthResult {
  ok: boolean;
  status: WhatsAppConfigStatus;
  verifiedName?: string | null;
  displayPhoneNumber?: string | null;
  lastHealthAt?: string | null;
  message?: string;
}

export type WhatsAppTemplateCategory = "UTILITY" | "MARKETING" | "AUTHENTICATION";
export type WhatsAppTemplateApproval = "PENDING_APPROVAL" | "APPROVED" | "REJECTED";

export const whatsappTemplateCategoryLabels: Record<WhatsAppTemplateCategory, string> = {
  UTILITY: "Utilidade",
  MARKETING: "Marketing",
  AUTHENTICATION: "Autenticação",
};

export const whatsappTemplateApprovalLabels: Record<WhatsAppTemplateApproval, string> = {
  PENDING_APPROVAL: "Aguardando aprovação",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
};

export interface WhatsAppTemplateDto {
  id: string;
  name: string;
  language: string;
  category: WhatsAppTemplateCategory;
  body: string;
  providerReference: string | null;
  approval: WhatsAppTemplateApproval;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
}

export type WhatsAppConsentStatus = "OPTED_IN" | "OPTED_OUT";
export type WhatsAppConsentSource = "MANUAL" | "REPLY" | "IMPORT";

export const whatsappConsentStatusLabels: Record<WhatsAppConsentStatus, string> = {
  OPTED_IN: "Com consentimento",
  OPTED_OUT: "Descadastrado",
};

export const whatsappConsentSourceLabels: Record<WhatsAppConsentSource, string> = {
  MANUAL: "Registro manual",
  REPLY: "Resposta no WhatsApp",
  IMPORT: "Importação",
};

export interface WhatsAppConsentDto {
  id: string;
  clientId: string;
  status: WhatsAppConsentStatus;
  source: WhatsAppConsentSource;
  phone: string | null;
  notes: string | null;
  changedAt: string | null;
  createdAt: string;
  updatedAt: string;
  client: {
    id: string;
    name: string;
    phone: string | null;
    mobile: string | null;
    status: RecordStatus;
  } | null;
}

export type WhatsAppMessageStatus =
  | "PENDING"
  | "PROCESSING"
  | "ACCEPTED"
  | "SENT"
  | "DELIVERED"
  | "READ"
  | "FAILED"
  | "CANCELLED";

export const whatsappMessageStatusLabels: Record<WhatsAppMessageStatus, string> = {
  PENDING: "Pendente",
  PROCESSING: "Processando",
  ACCEPTED: "Aceita pelo provedor",
  SENT: "Enviada",
  DELIVERED: "Entregue",
  READ: "Lida",
  FAILED: "Falha",
  CANCELLED: "Cancelada",
};

export type WhatsAppMessageOrigin = "MANUAL" | "SERVICE_REMINDER";

export const whatsappMessageOriginLabels: Record<WhatsAppMessageOrigin, string> = {
  MANUAL: "Manual",
  SERVICE_REMINDER: "Lembrete de serviço",
};

export interface WhatsAppMessageAttemptDto {
  id: string;
  attemptNumber: number;
  outcome: string;
  providerMessageId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  httpStatus: number | null;
  startedAt: string;
  finishedAt: string;
}

export interface WhatsAppMessageDto {
  id: string;
  clientId: string;
  templateId: string;
  toPhone: string;
  variables: string[];
  templateNameSnapshot: string;
  templateLanguageSnapshot: string;
  templateBodySnapshot: string;
  status: WhatsAppMessageStatus;
  origin: WhatsAppMessageOrigin;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  lastAttemptAt: string | null;
  providerMessageId: string | null;
  failureReason: string | null;
  failureDetail: string | null;
  idempotencyKey: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string } | null;
  template: { id: string; name: string; approval: WhatsAppTemplateApproval; status: RecordStatus } | null;
  createdBy: { id: string; name: string } | null;
  attemptsLog?: WhatsAppMessageAttemptDto[];
}

// ---------------------------------------------------------------------------
// Etapa 7 — dashboard e relatórios
// ---------------------------------------------------------------------------

export interface ReportPeriod {
  from: string;
  to: string;
  timezone: string;
}

export interface ModuleAvailability {
  available: boolean;
  reason: string | null;
}

/** Contagens de agendamentos por status no período (Etapa 8). */
export interface ServicesCounts {
  scheduled: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  noShow: number;
}

export interface DashboardSummaryDto {
  period: ReportPeriod;
  generatedAt: string;
  sales: {
    completedCount: number;
    gross: string;
    discounts: string;
    net: string;
    cancelledCount: number;
    cancelledTotal: string;
    ticketAverage: string | null;
  };
  salesByDay: Array<{ day: string; count: number; net: string }>;
  salesByPaymentMethod: Array<{
    paymentMethod: PaymentMethod;
    label: string;
    count: number;
    net: string;
  }>;
  cash: {
    openSession: {
      id: string;
      openedAt: string;
      initialAmount: string;
      expectedBalance: string;
    } | null;
    entriesInCash: string;
    exitsInCash: string;
    entriesTotal: string;
    exitsTotal: string;
  };
  stock: { outOfStockCount: number; lowStockCount: number };
  clients: { newClients: number; newPets: number };
  services: ServicesCounts;
  whatsapp: {
    total: number;
    pending: number;
    accepted: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    cancelled: number;
  };
  modules: { servicesRealized: ModuleAvailability };
}

export interface SaleReportItemDto {
  id: string;
  receiptCode: string;
  createdAt: string;
  status: SaleStatus;
  paymentMethod: PaymentMethod;
  subtotal: string;
  discount: string;
  total: string;
  client: string | null;
  createdBy: string;
}

export interface SalesReportDto {
  period: ReportPeriod;
  generatedAt: string;
  totals: {
    completed: { count: number; gross: string; discounts: string; net: string };
    cancelled: { count: number; total: string };
  };
  items: SaleReportItemDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface StockAlertItemDto {
  id: string;
  name: string;
  sku: string | null;
  unit: ProductUnit;
  unitLabel: string;
  stockQuantity: string;
  minimumStock: string;
  alert: "OUT_OF_STOCK" | "LOW_STOCK";
}

export interface StockAlertsReportDto {
  generatedAt: string;
  alerts: { total: number; outOfStockCount: number; lowStockCount: number };
  items: StockAlertItemDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface StockMovementReportItemDto {
  id: string;
  createdAt: string;
  type: StockMovementType;
  typeLabel: string;
  quantity: string;
  reference: string | null;
  notes: string | null;
  product: { name: string; sku: string | null };
  createdBy: string;
}

export interface StockMovementsReportDto {
  period: ReportPeriod;
  generatedAt: string;
  totals: {
    count: number;
    byType: Array<{ type: StockMovementType; label: string; count: number; quantity: string }>;
  };
  items: StockMovementReportItemDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CashReportDto {
  period: ReportPeriod;
  generatedAt: string;
  movements: {
    inCash: { entries: string; exits: string; net: string };
    all: { entries: string; exits: string };
    byOrigin: Array<{
      origin: CashMovementOrigin;
      originLabel: string;
      type: "IN" | "OUT";
      typeLabel: string;
      count: number;
      total: string;
    }>;
    reversals: { count: number; total: string };
  };
  sessions: {
    openedCount: number;
    closedCount: number;
    closedWithDifferenceCount: number;
    totalDifference: string;
    items: Array<{
      id: string;
      status: CashSessionStatus;
      openedAt: string;
      closedAt: string | null;
      initialAmount: string;
      countedAmount: string | null;
      expectedAmount: string | null;
      difference: string | null;
    }>;
  };
}

export interface ClientsReportDto {
  period: ReportPeriod;
  generatedAt: string;
  newClients: number;
  newPets: number;
  petsBySpecies: Array<{ species: PetSpecies; label: string; count: number }>;
  services: ServicesCounts;
}

export interface WhatsAppReportDto {
  period: ReportPeriod;
  generatedAt: string;
  total: number;
  byStatus: Array<{ status: WhatsAppMessageStatus; label: string; count: number }>;
  states: {
    pending: number;
    accepted: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    cancelled: number;
  };
  failed: { count: number; byReason: Array<{ reason: string; count: number }> };
}

// ---------------------------------------------------------------------------
// Etapa 8 — agendamentos
// ---------------------------------------------------------------------------

export type AppointmentStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  SCHEDULED: "Agendado",
  CONFIRMED: "Confirmado",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  NO_SHOW: "Não compareceu",
};

/** Transições aceitas em PATCH /api/appointments/:id/status. */
export type AppointmentActionStatus = "CONFIRMED" | "COMPLETED" | "NO_SHOW";

export interface AppointmentDto {
  id: string;
  companyId: string;
  clientId: string;
  petId: string | null;
  serviceId: string;
  startAt: string;
  endAt: string;
  startLocal: string;
  durationMinutes: number;
  status: AppointmentStatus;
  notes: string | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string; phone: string | null; mobile: string | null; status: RecordStatus };
  pet: { id: string; name: string; species: PetSpecies } | null;
  service: { id: string; name: string; price: string; status: RecordStatus };
  createdBy: { id: string; name: string };
  cancelledBy: { id: string; name: string } | null;
}

// ---------------------------------------------------------------------------
// Etapa 9 — assinaturas e gestão comercial
// ---------------------------------------------------------------------------

export type SubscriptionStatus = "ACTIVE" | "EXPIRED" | "CANCELLED";

export const subscriptionStatusLabels: Record<SubscriptionStatus, string> = {
  ACTIVE: "Ativa",
  EXPIRED: "Expirada",
  CANCELLED: "Cancelada",
};

export interface SubscriptionPlanDto {
  id: string;
  name: string;
  description: string | null;
  price: string;
  durationDays: number;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionPaymentDto {
  id: string;
  amount: string;
  description: string;
  cashSessionId: string;
  createdAt: string;
}

export interface SubscriptionDto {
  id: string;
  clientId: string;
  planId: string;
  startAt: string;
  endAt: string;
  status: SubscriptionStatus;
  cancelReason: string | null;
  cancelledAt: string | null;
  renewalCount: number;
  lastPaymentAt: string | null;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string; phone: string | null; mobile: string | null };
  plan: {
    id: string;
    name: string;
    price: string;
    durationDays: number;
    status: RecordStatus;
  };
  payments?: SubscriptionPaymentDto[];
}

export interface TenantPlanDto {
  id: string;
  name: string;
  description: string | null;
  priceMonthly: string;
  durationDays: number;
  active: boolean;
}

export type TenantSubscriptionStatus = "ACTIVE" | "EXPIRED" | "CANCELLED";

export const tenantSubscriptionStatusLabels: Record<TenantSubscriptionStatus, string> = {
  ACTIVE: "Ativa",
  EXPIRED: "Expirada",
  CANCELLED: "Cancelada",
};

export interface TenantSubscriptionDto {
  id: string;
  companyId: string;
  planId: string;
  status: TenantSubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelReason: string | null;
  cancelledAt: string | null;
  changedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  plan: TenantPlanDto;
}
