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
