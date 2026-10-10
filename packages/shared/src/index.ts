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

export const passwordFieldSchema = z
  .string()
  .min(8, "Senha deve ter ao menos 8 caracteres")
  .max(72, "Senha deve ter no máximo 72 caracteres");

export const resetPasswordSchema = z.object({
  email: emailFieldSchema,
  password: passwordFieldSchema,
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const createUserSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter ao menos 2 caracteres").max(120),
  email: emailFieldSchema,
  password: passwordFieldSchema,
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
  clientId: z.string().trim().min(1, "Cliente inválido").max(60).optional().nullable(),
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

// ---------------------------------------------------------------------------
// Etapa 5 — clientes, pets e serviços
// ---------------------------------------------------------------------------

export const petSpeciesSchema = z.enum([
  "DOG",
  "CAT",
  "BIRD",
  "RODENT",
  "REPTILE",
  "FISH",
  "OTHER",
]);
export type PetSpecies = z.infer<typeof petSpeciesSchema>;

export const petSexSchema = z.enum(["MALE", "FEMALE", "UNKNOWN"]);
export type PetSex = z.infer<typeof petSexSchema>;

export const petSpeciesLabels: Record<PetSpecies, string> = {
  DOG: "Cachorro",
  CAT: "Gato",
  BIRD: "Ave",
  RODENT: "Roedor",
  REPTILE: "Réptil",
  FISH: "Peixe",
  OTHER: "Outro",
};

export const petSexLabels: Record<PetSex, string> = {
  MALE: "Macho",
  FEMALE: "Fêmea",
  UNKNOWN: "Não informado",
};

export function normalizePhone(value: string): string {
  return value.replace(/\D+/g, "");
}

const phoneField = z
  .string()
  .trim()
  .max(30, "Telefone deve ter no máximo 30 caracteres")
  .transform((value) => normalizePhone(value))
  .refine(
    (value) => value.length === 0 || (value.length >= 8 && value.length <= 15),
    "Telefone deve ter de 8 a 15 dígitos",
  );

const cpfField = z
  .string()
  .trim()
  .max(20, "CPF deve ter no máximo 20 caracteres")
  .transform((value) => value.replace(/\D+/g, ""))
  .refine((value) => value.length === 0 || value.length === 11, "CPF deve ter 11 dígitos");

export const createClientSchema = z.object({
  name: nameField,
  phone: phoneField.optional().nullable(),
  mobile: phoneField.optional().nullable(),
  email: emailFieldSchema.optional().nullable(),
  cpf: cpfField.optional().nullable(),
  street: optionalText(120),
  number: optionalText(20),
  complement: optionalText(80),
  district: optionalText(80),
  city: optionalText(80),
  state: optionalText(40),
  zip: optionalText(12),
  notes: optionalText(500),
});
export type CreateClientInput = z.infer<typeof createClientSchema>;

export const updateClientSchema = createClientSchema.partial();
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

export const listClientsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  status: recordStatusSchema.optional(),
  orderBy: z.enum(["name", "createdAt"]).default("name"),
  direction: z.enum(["asc", "desc"]).default("asc"),
});
export type ListClientsQuery = z.infer<typeof listClientsQuerySchema>;

const weightField = z
  .union([z.number(), z.string()])
  .transform((value) => (typeof value === "number" ? String(value) : value.trim()))
  .refine(
    (value) =>
      /^\d+(\.\d{1,2})?$/.test(value) && Number(value) > 0 && Number(value) <= 999.99,
    "Peso inválido (máximo 999,99)",
  );

const petBaseSchema = z.object({
  clientId: z.string().trim().min(1, "Responsável é obrigatório").max(60),
  name: nameField,
  species: petSpeciesSchema,
  breed: optionalText(80),
  sex: petSexSchema.default("UNKNOWN"),
  birthDate: dateField.optional().nullable(),
  weight: weightField.optional().nullable(),
  color: optionalText(60),
  notes: optionalText(500),
});

function checkPetBirthDate(
  value: { birthDate?: string | null },
  ctx: z.RefinementCtx,
) {
  if (value.birthDate && value.birthDate > new Date().toISOString().slice(0, 10)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["birthDate"],
      message: "Data de nascimento não pode ser no futuro",
    });
  }
}

export const createPetSchema = petBaseSchema.superRefine(checkPetBirthDate);
export type CreatePetInput = z.infer<typeof createPetSchema>;

export const updatePetSchema = petBaseSchema.partial().superRefine(checkPetBirthDate);
export type UpdatePetInput = z.infer<typeof updatePetSchema>;

export const listPetsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  clientId: z.string().trim().max(60).optional(),
  species: petSpeciesSchema.optional(),
  status: recordStatusSchema.optional(),
  orderBy: z.enum(["name", "createdAt"]).default("name"),
  direction: z.enum(["asc", "desc"]).default("asc"),
});
export type ListPetsQuery = z.infer<typeof listPetsQuerySchema>;

export const createServiceSchema = z.object({
  name: nameField,
  description: optionalText(1000),
  durationMinutes: z.coerce
    .number()
    .int("Duração deve ser um número inteiro de minutos")
    .min(1, "Duração mínima de 1 minuto")
    .max(1440, "Duração máxima de 1440 minutos (24h)")
    .optional()
    .nullable(),
  price: priceFieldSchema,
});
export type CreateServiceInput = z.infer<typeof createServiceSchema>;

export const updateServiceSchema = createServiceSchema.partial();
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

export const listServicesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  status: recordStatusSchema.optional(),
  orderBy: z.enum(["name", "price", "createdAt"]).default("name"),
  direction: z.enum(["asc", "desc"]).default("asc"),
});
export type ListServicesQuery = z.infer<typeof listServicesQuerySchema>;

// ---------------------------------------------------------------------------
// Etapa 6 — integração com WhatsApp
// ---------------------------------------------------------------------------

export const whatsappConfigStatusSchema = z.enum([
  "NOT_CONFIGURED",
  "CONFIGURED",
  "ACTIVE",
  "ERROR",
  "DISCONNECTED",
]);
export type WhatsAppConfigStatus = z.infer<typeof whatsappConfigStatusSchema>;

export const whatsappConfigStatusLabels: Record<WhatsAppConfigStatus, string> = {
  NOT_CONFIGURED: "Não configurado",
  CONFIGURED: "Configurado",
  ACTIVE: "Ativo",
  ERROR: "Erro",
  DISCONNECTED: "Desconectado",
};

export const updateWhatsAppConfigSchema = z.object({
  phoneNumberId: z.string().trim().max(60).optional().nullable(),
  wabaId: z.string().trim().max(60).optional().nullable(),
  displayName: optionalText(120),
  reminderTemplateId: z.string().trim().max(60).optional().nullable(),
  reminderLeadMinutes: z.coerce
    .number()
    .int("Antecedência deve ser um número inteiro de minutos")
    .min(5, "Antecedência mínima de 5 minutos")
    .max(40320, "Antecedência máxima de 28 dias (40320 minutos)")
    .optional(),
});
export type UpdateWhatsAppConfigInput = z.infer<typeof updateWhatsAppConfigSchema>;

export const updateWhatsAppConfigStatusSchema = z.object({
  status: z.enum(["CONFIGURED", "DISCONNECTED"]),
});
export type UpdateWhatsAppConfigStatusInput = z.infer<
  typeof updateWhatsAppConfigStatusSchema
>;

export const whatsappTemplateCategorySchema = z.enum([
  "UTILITY",
  "MARKETING",
  "AUTHENTICATION",
]);
export type WhatsAppTemplateCategory = z.infer<typeof whatsappTemplateCategorySchema>;

export const whatsappTemplateApprovalSchema = z.enum([
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
]);
export type WhatsAppTemplateApproval = z.infer<typeof whatsappTemplateApprovalSchema>;

export const whatsappTemplateApprovalLabels: Record<WhatsAppTemplateApproval, string> = {
  PENDING_APPROVAL: "Aguardando aprovação",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
};

export const whatsappTemplateCategoryLabels: Record<WhatsAppTemplateCategory, string> = {
  UTILITY: "Utilidade",
  MARKETING: "Marketing",
  AUTHENTICATION: "Autenticação",
};

const whatsappTemplateNameSchema = z
  .string()
  .trim()
  .min(3, "Nome do template deve ter ao menos 3 caracteres")
  .max(64, "Nome do template deve ter no máximo 64 caracteres")
  .regex(
    /^[a-z0-9_]+$/,
    "Nome do template deve conter apenas minúsculas, números e sublinhado",
  );

const whatsappLanguageSchema = z
  .string()
  .trim()
  .regex(/^[a-z]{2}([_-][A-Z]{2})?$/, "Idioma inválido (ex.: pt_BR, en_US)");

/** Conta as variáveis {{1}}, {{2}}... exigidas pelo corpo do template. */
export function templateVariableCount(body: string): number {
  const matches = [...body.matchAll(/\{\{(\d+)\}\}/g)].map((match) => Number(match[1]));
  if (matches.length === 0) return 0;
  return Math.max(...matches);
}

function checkTemplateBody(body: string, ctx: z.RefinementCtx) {
  const numbers = [...body.matchAll(/\{\{(\d+)\}\}/g)]
    .map((match) => Number(match[1]))
    .sort((a, b) => a - b);
  const unique = [...new Set(numbers)];
  const contiguous = unique.every((value, index) => value === index + 1);
  if (!contiguous) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["body"],
      message: "Variáveis devem ser {{1}}, {{2}}... sequenciais",
    });
  }
}

const whatsappTemplateBodySchema = z
  .string()
  .trim()
  .min(1, "Corpo do template é obrigatório")
  .max(1024, "Corpo do template deve ter no máximo 1024 caracteres")
  .superRefine(checkTemplateBody);

export const createWhatsAppTemplateSchema = z.object({
  name: whatsappTemplateNameSchema,
  language: whatsappLanguageSchema.default("pt_BR"),
  category: whatsappTemplateCategorySchema.default("UTILITY"),
  body: whatsappTemplateBodySchema,
  providerReference: optionalText(120),
});
export type CreateWhatsAppTemplateInput = z.infer<typeof createWhatsAppTemplateSchema>;

export const updateWhatsAppTemplateSchema = createWhatsAppTemplateSchema
  .partial()
  .extend({
    approval: whatsappTemplateApprovalSchema.optional(),
    status: recordStatusSchema.optional(),
  });
export type UpdateWhatsAppTemplateInput = z.infer<typeof updateWhatsAppTemplateSchema>;

export const listWhatsAppTemplatesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  status: recordStatusSchema.optional(),
  approval: whatsappTemplateApprovalSchema.optional(),
  orderBy: z.enum(["name", "createdAt"]).default("createdAt"),
  direction: z.enum(["asc", "desc"]).default("desc"),
});
export type ListWhatsAppTemplatesQuery = z.infer<typeof listWhatsAppTemplatesQuerySchema>;

export const whatsappConsentStatusSchema = z.enum(["OPTED_IN", "OPTED_OUT"]);
export type WhatsAppConsentStatus = z.infer<typeof whatsappConsentStatusSchema>;

export const whatsappConsentSourceSchema = z.enum(["MANUAL", "REPLY", "IMPORT"]);
export type WhatsAppConsentSource = z.infer<typeof whatsappConsentSourceSchema>;

export const whatsappConsentStatusLabels: Record<WhatsAppConsentStatus, string> = {
  OPTED_IN: "Com consentimento",
  OPTED_OUT: "Descadastrado",
};

export const whatsappConsentSourceLabels: Record<WhatsAppConsentSource, string> = {
  MANUAL: "Registro manual",
  REPLY: "Resposta no WhatsApp",
  IMPORT: "Importação",
};

export const upsertWhatsAppConsentSchema = z.object({
  status: whatsappConsentStatusSchema,
  source: whatsappConsentSourceSchema.default("MANUAL"),
  notes: optionalText(500),
});
export type UpsertWhatsAppConsentInput = z.infer<typeof upsertWhatsAppConsentSchema>;

export const listWhatsAppConsentsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  status: whatsappConsentStatusSchema.optional(),
  clientId: z.string().trim().max(60).optional(),
});
export type ListWhatsAppConsentsQuery = z.infer<typeof listWhatsAppConsentsQuerySchema>;

export const whatsappMessageStatusSchema = z.enum([
  "PENDING",
  "PROCESSING",
  "ACCEPTED",
  "SENT",
  "DELIVERED",
  "READ",
  "FAILED",
  "CANCELLED",
]);
export type WhatsAppMessageStatus = z.infer<typeof whatsappMessageStatusSchema>;

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

export const whatsappMessageOriginSchema = z.enum(["MANUAL", "SERVICE_REMINDER"]);
export type WhatsAppMessageOrigin = z.infer<typeof whatsappMessageOriginSchema>;

export const createWhatsAppMessageSchema = z.object({
  clientId: z.string().trim().min(1, "Cliente é obrigatório").max(60),
  templateId: z.string().trim().min(1, "Template é obrigatório").max(60),
  variables: z
    .array(z.string().trim().max(1024, "Variável deve ter no máximo 1024 caracteres"))
    .max(10, "Máximo de 10 variáveis")
    .default([]),
  idempotencyKey: z.string().trim().min(6).max(64).optional(),
});
export type CreateWhatsAppMessageInput = z.infer<typeof createWhatsAppMessageSchema>;

export const listWhatsAppMessagesQuerySchema = paginationQuerySchema.extend({
  from: dateField.optional(),
  to: dateField.optional(),
  status: whatsappMessageStatusSchema.optional(),
  origin: whatsappMessageOriginSchema.optional(),
  clientId: z.string().trim().max(60).optional(),
  templateId: z.string().trim().max(60).optional(),
  search: z.string().trim().max(40).optional(),
});
export type ListWhatsAppMessagesQuery = z.infer<typeof listWhatsAppMessagesQuerySchema>;

export const cancelWhatsAppMessageSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Motivo é obrigatório para cancelamento")
    .max(300, "Motivo deve ter no máximo 300 caracteres"),
});
export type CancelWhatsAppMessageInput = z.infer<typeof cancelWhatsAppMessageSchema>;

// ---------------------------------------------------------------------------
// Etapa 7 — dashboard e relatórios
// ---------------------------------------------------------------------------

export const REPORT_TIMEZONE = "UTC" as const;
export const REPORT_MAX_RANGE_DAYS = 366;
export const REPORT_DEFAULT_RANGE_DAYS = 30;
export const REPORT_CSV_MAX_ROWS = 5000;

export const reportDateField = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD")
  .refine(
    (value) =>
      !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) &&
      new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value,
    "Data inválida",
  );

function checkReportPeriod(
  value: { from?: string; to?: string },
  ctx: z.RefinementCtx,
): void {
  if (!value.from || !value.to) return;
  const fromMs = Date.parse(`${value.from}T00:00:00.000Z`);
  const toMs = Date.parse(`${value.to}T00:00:00.000Z`);
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) return;
  if (fromMs > toMs) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["from"],
      message: "Data inicial não pode ser posterior à final",
    });
    return;
  }
  const days = Math.round((toMs - fromMs) / 86_400_000) + 1;
  if (days > REPORT_MAX_RANGE_DAYS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["from"],
      message: `Intervalo máximo é de ${REPORT_MAX_RANGE_DAYS} dias`,
    });
  }
}

const reportPeriodBase = z.object({
  from: reportDateField.optional(),
  to: reportDateField.optional(),
});

export const dashboardSummaryQuerySchema = reportPeriodBase.superRefine(checkReportPeriod);
export type DashboardSummaryQuery = z.infer<typeof dashboardSummaryQuerySchema>;

export const reportFormatSchema = z.enum(["json", "csv"]).default("json");
export type ReportFormat = z.infer<typeof reportFormatSchema>;

export const salesReportQuerySchema = reportPeriodBase
  .extend(paginationQuerySchema.shape)
  .extend({
    status: saleStatusSchema.optional(),
    paymentMethod: paymentMethodSchema.optional(),
    format: reportFormatSchema,
  })
  .superRefine(checkReportPeriod);
export type SalesReportQuery = z.infer<typeof salesReportQuerySchema>;

export const stockAlertsReportQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  format: reportFormatSchema,
});
export type StockAlertsReportQuery = z.infer<typeof stockAlertsReportQuerySchema>;

export const stockMovementsReportQuerySchema = reportPeriodBase
  .extend(paginationQuerySchema.shape)
  .extend({
    productId: z.string().trim().max(60).optional(),
    type: stockMovementTypeSchema.optional(),
    format: reportFormatSchema,
  })
  .superRefine(checkReportPeriod);
export type StockMovementsReportQuery = z.infer<typeof stockMovementsReportQuerySchema>;

export const cashReportQuerySchema = reportPeriodBase.superRefine(checkReportPeriod);
export type CashReportQuery = z.infer<typeof cashReportQuerySchema>;

export const clientsReportQuerySchema = reportPeriodBase.superRefine(checkReportPeriod);
export type ClientsReportQuery = z.infer<typeof clientsReportQuerySchema>;

export const whatsappReportQuerySchema = reportPeriodBase.superRefine(checkReportPeriod);
export type WhatsAppReportQuery = z.infer<typeof whatsappReportQuerySchema>;

// ---------------------------------------------------------------------------
// Etapa 8 — agendamentos
// ---------------------------------------------------------------------------

export const appointmentStatusSchema = z.enum([
  "SCHEDULED",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
]);
export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>;

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  SCHEDULED: "Agendado",
  CONFIRMED: "Confirmado",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  NO_SHOW: "Não compareceu",
};

/** Status que ocupam horário (bloqueiam conflito na empresa inteira). */
export const APPOINTMENT_BLOCKING_STATUSES: readonly AppointmentStatus[] = [
  "SCHEDULED",
  "CONFIRMED",
];

/** Status finais — nenhuma transição posterior é aceita. */
export const APPOINTMENT_TERMINAL_STATUSES: readonly AppointmentStatus[] = [
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
];

/** Lembrete de agendamento exige template com exatamente 3 variáveis. */
export const APPOINTMENT_REMINDER_VARIABLE_COUNT = 3;
export const APPOINTMENT_REMINDER_LEAD_MIN = 5;
export const APPOINTMENT_REMINDER_LEAD_MAX = 40320;
export const APPOINTMENT_REMINDER_LEAD_DEFAULT = 1440;

const localDateTimeField = z
  .string()
  .trim()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
    "Data e hora devem estar no formato YYYY-MM-DDTHH:mm",
  )
  .refine(
    (value) =>
      !Number.isNaN(Date.parse(`${value}:00.000Z`)) &&
      new Date(`${value}:00.000Z`).toISOString().slice(0, 16) === value,
    "Data e hora inválidas",
  );

export const createAppointmentSchema = z.object({
  clientId: z.string().trim().min(1, "Cliente é obrigatório").max(60),
  petId: z.string().trim().max(60).optional().nullable(),
  serviceId: z.string().trim().min(1, "Serviço é obrigatório").max(60),
  startLocal: localDateTimeField,
  utcOffsetMinutes: z.coerce
    .number()
    .int("Fuso horário deve ser um número inteiro de minutos")
    .min(-840, "Fuso horário inválido (mínimo −14h)")
    .max(840, "Fuso horário inválido (máximo +14h)"),
  durationMinutes: z.coerce
    .number()
    .int("Duração deve ser um número inteiro de minutos")
    .min(1, "Duração mínima de 1 minuto")
    .max(1440, "Duração máxima de 1440 minutos (24h)"),
  notes: optionalText(1000),
});
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export const updateAppointmentSchema = createAppointmentSchema.partial();
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;

export const updateAppointmentStatusSchema = z.object({
  status: z.enum(["CONFIRMED", "COMPLETED", "NO_SHOW"]),
});
export type UpdateAppointmentStatusInput = z.infer<
  typeof updateAppointmentStatusSchema
>;

export const cancelAppointmentSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Motivo é obrigatório para cancelamento")
    .max(500, "Motivo deve ter no máximo 500 caracteres"),
});
export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;

export const listAppointmentsQuerySchema = paginationQuerySchema
  .extend({
    from: reportDateField.optional(),
    to: reportDateField.optional(),
    status: appointmentStatusSchema.optional(),
    clientId: z.string().trim().max(60).optional(),
    petId: z.string().trim().max(60).optional(),
    serviceId: z.string().trim().max(60).optional(),
    search: z.string().trim().max(120).optional(),
  })
  .superRefine(checkReportPeriod);
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuerySchema>;

// ---------------------------------------------------------------------------
// Etapa 9 — assinaturas e gestão comercial
// ---------------------------------------------------------------------------

export const subscriptionStatusSchema = z.enum(["ACTIVE", "EXPIRED", "CANCELLED"]);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

export const subscriptionStatusLabels: Record<SubscriptionStatus, string> = {
  ACTIVE: "Ativa",
  EXPIRED: "Expirada",
  CANCELLED: "Cancelada",
};

export const tenantSubscriptionStatusSchema = z.enum([
  "ACTIVE",
  "EXPIRED",
  "CANCELLED",
]);
export type TenantSubscriptionStatus = z.infer<
  typeof tenantSubscriptionStatusSchema
>;

export const tenantSubscriptionStatusLabels: Record<
  TenantSubscriptionStatus,
  string
> = {
  ACTIVE: "Ativa",
  EXPIRED: "Expirada",
  CANCELLED: "Cancelada",
};

export const SUBSCRIPTION_MIN_DURATION_DAYS = 1;
export const SUBSCRIPTION_MAX_DURATION_DAYS = 3650;
export const TENANT_PLAN_DEFAULT_DURATION_DAYS = 30;

export const createSubscriptionPlanSchema = z.object({
  name: nameField,
  description: optionalText(1000),
  price: priceFieldSchema,
  durationDays: z.coerce
    .number()
    .int("Duração deve ser um número inteiro de dias")
    .min(SUBSCRIPTION_MIN_DURATION_DAYS, "Duração mínima de 1 dia")
    .max(SUBSCRIPTION_MAX_DURATION_DAYS, "Duração máxima de 3650 dias (10 anos)"),
});
export type CreateSubscriptionPlanInput = z.infer<
  typeof createSubscriptionPlanSchema
>;

export const updateSubscriptionPlanSchema = createSubscriptionPlanSchema.partial();
export type UpdateSubscriptionPlanInput = z.infer<
  typeof updateSubscriptionPlanSchema
>;

export const listSubscriptionPlansQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  status: recordStatusSchema.optional(),
  orderBy: z.enum(["name", "price", "createdAt"]).default("name"),
  direction: z.enum(["asc", "desc"]).default("asc"),
});
export type ListSubscriptionPlansQuery = z.infer<
  typeof listSubscriptionPlansQuerySchema
>;

export const createSubscriptionSchema = z.object({
  clientId: z.string().trim().min(1, "Cliente é obrigatório").max(60),
  planId: z.string().trim().min(1, "Plano é obrigatório").max(60),
  startAt: z.string().trim().datetime({ offset: true }).optional(),
  registerPayment: z.boolean().optional(),
});
export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;

export const cancelSubscriptionSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Motivo é obrigatório para cancelamento")
    .max(500, "Motivo deve ter no máximo 500 caracteres"),
});
export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionSchema>;

export const listSubscriptionsQuerySchema = paginationQuerySchema.extend({
  status: subscriptionStatusSchema.optional(),
  clientId: z.string().trim().max(60).optional(),
  search: z.string().trim().max(120).optional(),
  orderBy: z.enum(["endAt", "createdAt"]).default("endAt"),
  direction: z.enum(["asc", "desc"]).default("asc"),
});
export type ListSubscriptionsQuery = z.infer<typeof listSubscriptionsQuerySchema>;

export const updateTenantSubscriptionSchema = z.object({
  planId: z.string().trim().min(1, "Plano é obrigatório").max(60),
});
export type UpdateTenantSubscriptionInput = z.infer<
  typeof updateTenantSubscriptionSchema
>;

export const cancelTenantSubscriptionSchema = z.object({
  reason: optionalText(500),
});
export type CancelTenantSubscriptionInput = z.infer<
  typeof cancelTenantSubscriptionSchema
>;
