import { z } from "zod";

export const APP_NAME = "PetFlow";

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const apiErrorSchema = z.object({
  statusCode: z.number().int(),
  message: z.string(),
  error: z.string().optional(),
  timestamp: z.string(),
  path: z.string().optional(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export const userRoleSchema = z.enum(["ADMIN", "MEMBER"]);
export const userStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);
export const companyStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export const emailFieldSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Email inválido");

export const loginSchema = z.object({
  email: emailFieldSchema,
  password: z.string().min(1, "Senha é obrigatória").max(200),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const createUserSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter ao menos 2 caracteres").max(120),
  email: emailFieldSchema,
  password: z
    .string()
    .min(8, "Senha deve ter ao menos 8 caracteres")
    .max(72, "Senha deve ter no máximo 72 caracteres"),
  role: userRoleSchema.default("MEMBER"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserStatusSchema = z.object({
  status: userStatusSchema,
});

export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;

export interface SessionUserDto {
  id: string;
  name: string;
  email: string;
  role: z.infer<typeof userRoleSchema>;
  status: z.infer<typeof userStatusSchema>;
}

export interface SessionCompanyDto {
  id: string;
  name: string;
  slug: string;
}

export interface MeResponse {
  user: SessionUserDto;
  company: SessionCompanyDto;
}

// ---------------------------------------------------------------------------
// Etapa 2 — catálogo, estoque e movimentações
// ---------------------------------------------------------------------------

export const recordStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);
export type RecordStatus = z.infer<typeof recordStatusSchema>;

export const productUnitSchema = z.enum([
  "UNIDADE",
  "KG",
  "G",
  "L",
  "ML",
  "CAIXA",
  "PACOTE",
  "ROLLO",
]);
export type ProductUnit = z.infer<typeof productUnitSchema>;

export const stockMovementTypeSchema = z.enum([
  "IN",
  "OUT",
  "ADJUST_POSITIVE",
  "ADJUST_NEGATIVE",
]);
export type StockMovementType = z.infer<typeof stockMovementTypeSchema>;

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

export const stockMovementTypeLabels: Record<StockMovementType, string> = {
  IN: "Entrada",
  OUT: "Saída",
  ADJUST_POSITIVE: "Ajuste positivo",
  ADJUST_NEGATIVE: "Ajuste negativo",
};

function decimalField(places: number, minInclusive: number) {
  return z
    .union([z.number(), z.string()])
    .transform((value) => (typeof value === "number" ? String(value) : value.trim()))
    .refine(
      (value) =>
        new RegExp(`^\\d+(\\.\\d{1,${places}})?$`).test(value) &&
        Number(value) >= minInclusive,
      minInclusive > 0
        ? `Valor deve ser maior que ${minInclusive} (até ${places} decimais)`
        : `Valor inválido ou negativo (até ${places} decimais)`,
    );
}

export const priceFieldSchema = decimalField(2, 0);
export const quantityFieldSchema = decimalField(3, 0);
export const positiveQuantityFieldSchema = decimalField(3, 0).refine(
  (value) => Number(value) > 0,
  "Quantidade deve ser maior que zero",
);

const nameField = z.string().trim().min(2, "Nome deve ter ao menos 2 caracteres").max(120);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .optional()
    .nullable();

export const createCategorySchema = z.object({
  name: nameField,
  description: optionalText(500),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial();
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const updateRecordStatusSchema = z.object({ status: recordStatusSchema });
export type UpdateRecordStatusInput = z.infer<typeof updateRecordStatusSchema>;

export const createSupplierSchema = z.object({
  name: nameField,
  document: optionalText(20),
  email: emailFieldSchema.optional().nullable(),
  phone: optionalText(30),
  notes: optionalText(500),
});
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

export const updateSupplierSchema = createSupplierSchema.partial();
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

export const skuFieldSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine((value) => value.length === 0 || value.length <= 60, "SKU deve ter no máximo 60 caracteres");

export const createProductSchema = z.object({
  name: nameField,
  description: optionalText(1000),
  sku: skuFieldSchema.optional().nullable(),
  barcode: z
    .string()
    .trim()
    .max(80, "Código de barras deve ter no máximo 80 caracteres")
    .optional()
    .nullable(),
  unit: productUnitSchema.default("UNIDADE"),
  costPrice: priceFieldSchema.default("0"),
  salePrice: priceFieldSchema.default("0"),
  minimumStock: quantityFieldSchema.default("0"),
  categoryId: z.string().trim().min(1).max(60).optional().nullable(),
  supplierId: z.string().trim().min(1).max(60).optional().nullable(),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial();
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const listProductsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  categoryId: z.string().trim().max(60).optional(),
  supplierId: z.string().trim().max(60).optional(),
  status: recordStatusSchema.optional(),
  lowStock: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((value) => value === true || value === "true")
    .optional(),
  orderBy: z.enum(["name", "createdAt", "stockQuantity"]).default("name"),
  direction: z.enum(["asc", "desc"]).default("asc"),
});
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;

export const listCatalogQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  status: recordStatusSchema.optional(),
});
export type ListCatalogQuery = z.infer<typeof listCatalogQuerySchema>;

export const createStockMovementSchema = z.object({
  productId: z.string().trim().min(1, "Produto é obrigatório").max(60),
  quantity: positiveQuantityFieldSchema,
  notes: optionalText(500),
  reference: optionalText(120),
});
export type CreateStockMovementInput = z.infer<typeof createStockMovementSchema>;

export const createStockAdjustmentSchema = z.object({
  productId: z.string().trim().min(1, "Produto é obrigatório").max(60),
  type: z.enum(["ADJUST_POSITIVE", "ADJUST_NEGATIVE"]),
  quantity: positiveQuantityFieldSchema,
  reason: z
    .string()
    .trim()
    .min(3, "Justificativa é obrigatória para ajustes")
    .max(500, "Justificativa deve ter no máximo 500 caracteres"),
});
export type CreateStockAdjustmentInput = z.infer<typeof createStockAdjustmentSchema>;

export const listMovementsQuerySchema = paginationQuerySchema.extend({
  productId: z.string().trim().max(60).optional(),
  type: stockMovementTypeSchema.optional(),
});
export type ListMovementsQuery = z.infer<typeof listMovementsQuerySchema>;

// ---------------------------------------------------------------------------
// Etapa 3 — vendas e PDV
// ---------------------------------------------------------------------------

export const paymentMethodSchema = z.enum(["CASH", "CARD", "PIX", "OTHER"]);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const saleStatusSchema = z.enum(["COMPLETED", "CANCELLED"]);
export type SaleStatus = z.infer<typeof saleStatusSchema>;

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: "Dinheiro",
  CARD: "Cartão",
  PIX: "Pix",
  OTHER: "Outro",
};

export const saleStatusLabels: Record<SaleStatus, string> = {
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};

export const createSaleItemSchema = z.object({
  productId: z.string().trim().min(1, "Produto é obrigatório").max(60),
  quantity: positiveQuantityFieldSchema,
});
export type CreateSaleItemInput = z.infer<typeof createSaleItemSchema>;

export const createSaleSchema = z.object({
  items: z
    .array(createSaleItemSchema)
    .min(1, "Informe ao menos um produto")
    .max(100, "Venda pode ter no máximo 100 itens distintos"),
  discount: priceFieldSchema.default("0"),
  paymentMethod: paymentMethodSchema,
  paymentNote: optionalText(300),
  clientRequestId: z
    .string()
    .trim()
    .min(8, "Identificador de requisição inválido")
    .max(64, "Identificador de requisição inválido")
    .optional(),
});
export type CreateSaleInput = z.infer<typeof createSaleSchema>;

export const cancelSaleSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Motivo é obrigatório para cancelamento")
    .max(500, "Motivo deve ter no máximo 500 caracteres"),
});
export type CancelSaleInput = z.infer<typeof cancelSaleSchema>;

const dateField = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD");

export const listSalesQuerySchema = paginationQuerySchema.extend({
  status: saleStatusSchema.optional(),
  search: z.string().trim().max(120).optional(),
  from: dateField.optional(),
  to: dateField.optional(),
});
export type ListSalesQuery = z.infer<typeof listSalesQuerySchema>;

// ---------------------------------------------------------------------------
// Etapa 4 — caixa e financeiro
// ---------------------------------------------------------------------------

export const cashSessionStatusSchema = z.enum(["OPEN", "CLOSED"]);
export type CashSessionStatus = z.infer<typeof cashSessionStatusSchema>;

export const cashMovementTypeSchema = z.enum(["IN", "OUT"]);
export type CashMovementType = z.infer<typeof cashMovementTypeSchema>;

export const cashMovementOriginSchema = z.enum([
  "MANUAL",
  "SALE",
  "SALE_CANCELMENT",
  "REVERSAL",
]);
export type CashMovementOrigin = z.infer<typeof cashMovementOriginSchema>;

export const cashSessionStatusLabels: Record<CashSessionStatus, string> = {
  OPEN: "Aberto",
  CLOSED: "Fechado",
};

export const cashMovementTypeLabels: Record<CashMovementType, string> = {
  IN: "Entrada",
  OUT: "Saída",
};

export const cashMovementOriginLabels: Record<CashMovementOrigin, string> = {
  MANUAL: "Manual",
  SALE: "Venda",
  SALE_CANCELMENT: "Cancelamento",
  REVERSAL: "Estorno",
};

export const positivePriceFieldSchema = priceFieldSchema.refine(
  (value) => Number(value) > 0,
  "Valor deve ser maior que zero",
);

export const openCashSessionSchema = z.object({
  initialAmount: priceFieldSchema,
  notes: optionalText(500),
});
export type OpenCashSessionInput = z.infer<typeof openCashSessionSchema>;

export const closeCashSessionSchema = z.object({
  countedAmount: priceFieldSchema,
  notes: optionalText(500),
});
export type CloseCashSessionInput = z.infer<typeof closeCashSessionSchema>;

export const createCashMovementSchema = z
  .object({
    type: cashMovementTypeSchema,
    amount: positivePriceFieldSchema,
    description: z
      .string()
      .trim()
      .min(2, "Descrição deve ter ao menos 2 caracteres")
      .max(300, "Descrição deve ter no máximo 300 caracteres"),
    justification: optionalText(500),
  })
  .superRefine((value, ctx) => {
    if (value.type === "OUT" && !value.justification) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["justification"],
        message: "Justificativa é obrigatória para saídas",
      });
    }
  });
export type CreateCashMovementInput = z.infer<typeof createCashMovementSchema>;

export const reversalCashMovementSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Motivo é obrigatório para estorno")
    .max(500, "Motivo deve ter no máximo 500 caracteres"),
});
export type ReversalCashMovementInput = z.infer<typeof reversalCashMovementSchema>;

export const listCashMovementsQuerySchema = paginationQuerySchema.extend({
  from: dateField.optional(),
  to: dateField.optional(),
  sessionId: z.string().trim().max(60).optional(),
  type: cashMovementTypeSchema.optional(),
  origin: cashMovementOriginSchema.optional(),
});
export type ListCashMovementsQuery = z.infer<typeof listCashMovementsQuerySchema>;

export const cashSummaryQuerySchema = z.object({
  from: dateField.optional(),
  to: dateField.optional(),
  sessionId: z.string().trim().max(60).optional(),
});
export type CashSummaryQuery = z.infer<typeof cashSummaryQuerySchema>;
