"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import {
  productUnitLabels,
  type CategoryDto,
  type Paginated,
  type ProductDto,
  type ProductUnit,
  type SupplierDto,
} from "../lib/types";

interface ProductFormProps {
  initial?: ProductDto;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  submitLabel: string;
}

export function ProductForm({ initial, onSubmit, submitLabel }: ProductFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [sku, setSku] = useState(initial?.sku ?? "");
  const [barcode, setBarcode] = useState(initial?.barcode ?? "");
  const [unit, setUnit] = useState<ProductUnit>(initial?.unit ?? "UNIDADE");
  const [costPrice, setCostPrice] = useState(initial?.costPrice ?? "0");
  const [salePrice, setSalePrice] = useState(initial?.salePrice ?? "0");
  const [minimumStock, setMinimumStock] = useState(initial?.minimumStock ?? "0");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [supplierId, setSupplierId] = useState(initial?.supplierId ?? "");

  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void Promise.all([
      api<Paginated<CategoryDto>>("/api/categories?pageSize=100"),
      api<Paginated<SupplierDto>>("/api/suppliers?pageSize=100"),
    ])
      .then(([categoryPage, supplierPage]) => {
        setCategories(categoryPage.items);
        setSuppliers(supplierPage.items);
      })
      .catch(() => {
        setFormError("Não foi possível carregar categorias/fornecedores.");
      });
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const issues: Record<string, string> = {};
    if (name.trim().length < 2) issues.name = "Nome deve ter ao menos 2 caracteres";
    if (Number(costPrice) < 0) issues.costPrice = "Custo não pode ser negativo";
    if (Number(salePrice) < 0) issues.salePrice = "Preço não pode ser negativo";
    if (Number(minimumStock) < 0) issues.minimumStock = "Estoque mínimo não pode ser negativo";
    if (Object.keys(issues).length > 0) {
      setFieldErrors(issues);
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || null,
        sku: sku.trim() || null,
        barcode: barcode.trim() || null,
        unit,
        costPrice,
        salePrice,
        minimumStock,
        categoryId: categoryId || null,
        supplierId: supplierId || null,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.issues?.length) {
          const mapped: Record<string, string> = {};
          for (const issue of err.issues) mapped[issue.path] = issue.message;
          setFieldErrors(mapped);
        }
        setFormError(err.message);
      } else {
        setFormError("Não foi possível salvar o produto.");
      }
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none";

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      {formError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">
          {formError}
        </div>
      )}
      <div>
        <label htmlFor="product-name" className="mb-1 block text-sm text-slate-700">
          Nome *
        </label>
        <input
          id="product-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={inputClass}
        />
        {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>}
      </div>
      <div>
        <label htmlFor="product-sku" className="mb-1 block text-sm text-slate-700">
          SKU
        </label>
        <input
          id="product-sku"
          value={sku}
          onChange={(event) => setSku(event.target.value)}
          className={inputClass}
        />
        {fieldErrors.sku && <p className="mt-1 text-xs text-red-600">{fieldErrors.sku}</p>}
      </div>
      <div>
        <label htmlFor="product-barcode" className="mb-1 block text-sm text-slate-700">
          Código de barras
        </label>
        <input
          id="product-barcode"
          value={barcode}
          onChange={(event) => setBarcode(event.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="product-unit" className="mb-1 block text-sm text-slate-700">
          Unidade
        </label>
        <select
          id="product-unit"
          value={unit}
          onChange={(event) => setUnit(event.target.value as ProductUnit)}
          className={inputClass}
        >
          {Object.entries(productUnitLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="product-cost" className="mb-1 block text-sm text-slate-700">
          Custo (R$)
        </label>
        <input
          id="product-cost"
          inputMode="decimal"
          value={costPrice}
          onChange={(event) => setCostPrice(event.target.value)}
          className={inputClass}
        />
        {fieldErrors.costPrice && (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.costPrice}</p>
        )}
      </div>
      <div>
        <label htmlFor="product-price" className="mb-1 block text-sm text-slate-700">
          Venda (R$)
        </label>
        <input
          id="product-price"
          inputMode="decimal"
          value={salePrice}
          onChange={(event) => setSalePrice(event.target.value)}
          className={inputClass}
        />
        {fieldErrors.salePrice && (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.salePrice}</p>
        )}
      </div>
      <div>
        <label htmlFor="product-min" className="mb-1 block text-sm text-slate-700">
          Estoque mínimo
        </label>
        <input
          id="product-min"
          inputMode="decimal"
          value={minimumStock}
          onChange={(event) => setMinimumStock(event.target.value)}
          className={inputClass}
        />
        {fieldErrors.minimumStock && (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.minimumStock}</p>
        )}
      </div>
      <div>
        <label htmlFor="product-category" className="mb-1 block text-sm text-slate-700">
          Categoria
        </label>
        <select
          id="product-category"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          className={inputClass}
        >
          <option value="">Sem categoria</option>
          {categories
            .filter((category) => category.status === "ACTIVE" || category.id === categoryId)
            .map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
        </select>
      </div>
      <div>
        <label htmlFor="product-supplier" className="mb-1 block text-sm text-slate-700">
          Fornecedor
        </label>
        <select
          id="product-supplier"
          value={supplierId}
          onChange={(event) => setSupplierId(event.target.value)}
          className={inputClass}
        >
          <option value="">Sem fornecedor</option>
          {suppliers
            .filter((supplier) => supplier.status === "ACTIVE" || supplier.id === supplierId)
            .map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="product-description" className="mb-1 block text-sm text-slate-700">
          Descrição
        </label>
        <textarea
          id="product-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          className={inputClass}
        />
      </div>
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {saving ? "Salvando..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
