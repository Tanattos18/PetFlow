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
