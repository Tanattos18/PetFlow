"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../../lib/api";
import { fetchSession, type Session } from "../../lib/session";
import {
  petSexLabels,
  petSpeciesLabels,
  type ClientDto,
  type Paginated,
  type PetDto,
  type PetSex,
  type PetSpecies,
} from "../../lib/types";

const emptyForm = {
  clientId: "",
  name: "",
  species: "DOG" as PetSpecies,
  breed: "",
  sex: "UNKNOWN" as PetSex,
  birthDate: "",
  weight: "",
  color: "",
  notes: "",
};

export default function PetsPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [pets, setPets] = useState<PetDto[]>([]);
  const [clients, setClients] = useState<ClientDto[]>([]);
  const [search, setSearch] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const loadPets = useCallback(
    async (term: string, species: string, status: string) => {
      try {
        const params = new URLSearchParams({ pageSize: "100" });
        if (term.trim()) params.set("search", term.trim());
        if (species) params.set("species", species);
        if (status) params.set("status", status);
        const data = await api<Paginated<PetDto>>(`/api/pets?${params.toString()}`);
        setPets(data.items);
        setListError(null);
      } catch (err) {
        setListError(err instanceof ApiError ? err.message : "Falha ao carregar pets.");
      }
    },
    [],
  );

  const loadClients = useCallback(async () => {
    try {
      const data = await api<Paginated<ClientDto>>(
        "/api/clients?status=ACTIVE&pageSize=100",
      );
      setClients(data.items);
    } catch {
      setClients([]);
    }
  }, []);

  useEffect(() => {
    fetchSession().then((value) => {
      if (!value) {
        router.replace("/login");
        return;
      }
      setSession(value);
      setLoading(false);
    });
  }, [router]);

  useEffect(() => {
    if (session) {
      void loadPets(search, speciesFilter, statusFilter);
      void loadClients();
    }
  }, [session, loadPets, loadClients, search, speciesFilter, statusFilter]);

  function startEdit(pet: PetDto) {
    setEditingId(pet.id);
    setForm({
      clientId: pet.clientId,
      name: pet.name,
      species: pet.species,
      breed: pet.breed ?? "",
      sex: pet.sex,
      birthDate: pet.birthDate ?? "",
      weight: pet.weight ?? "",
      color: pet.color ?? "",
      notes: pet.notes ?? "",
    });
    setFieldErrors({});
    setFormError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setFieldErrors({});
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    if (!form.clientId) {
      setFieldErrors({ clientId: "Selecione o responsável" });
      return;
    }
    if (form.name.trim().length < 2) {
      setFieldErrors({ name: "Nome deve ter ao menos 2 caracteres" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        clientId: form.clientId,
        name: form.name.trim(),
        species: form.species,
        breed: form.breed.trim() || null,
        sex: form.sex,
        birthDate: form.birthDate || null,
        weight: form.weight.trim() || null,
        color: form.color.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (editingId) {
        await api(`/api/pets/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setNotice("Pet atualizado.");
      } else {
        await api("/api/pets", { method: "POST", body: JSON.stringify(payload) });
        setNotice("Pet cadastrado.");
      }
      resetForm();
      await loadPets(search, speciesFilter, statusFilter);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.issues?.length) {
          const mapped: Record<string, string> = {};
          for (const issue of err.issues) mapped[issue.path] = issue.message;
          setFieldErrors(mapped);
        }
        setFormError(err.message);
      } else {
        setFormError("Não foi possível salvar o pet.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(pet: PetDto, status: "ACTIVE" | "INACTIVE") {
    const label = status === "INACTIVE" ? "inativar" : "reativar";
    if (!window.confirm(`Deseja ${label} o pet "${pet.name}"?`)) return;
    setNotice(null);
    try {
      await api(`/api/pets/${pet.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setNotice(`Pet ${status === "INACTIVE" ? "inativado" : "reativado"}.`);
      await loadPets(search, speciesFilter, statusFilter);
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Falha ao atualizar status.");
    }
  }

  if (loading || !session) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  }

  const inputClass =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Pets</h2>
          <p className="text-sm text-slate-500">Empresa {session.company.name}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/clientes"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Clientes
          </Link>
          <Link
            href="/"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Início
          </Link>
        </div>
      </div>

      {notice && (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {notice}
        </div>
      )}
      {listError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {listError}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          {editingId ? "Editar pet" : "Novo pet"}
        </h3>
        <form onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="pet-client" className="mb-1 block text-sm text-slate-700">
              Responsável *
            </label>
            <select
              id="pet-client"
              value={form.clientId}
              onChange={(event) => setForm({ ...form, clientId: event.target.value })}
              className={inputClass}
            >
              <option value="">Selecione...</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            {fieldErrors.clientId && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.clientId}</p>
            )}
          </div>
          <div>
            <label htmlFor="pet-name" className="mb-1 block text-sm text-slate-700">
              Nome *
            </label>
            <input
              id="pet-name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className={inputClass}
            />
            {fieldErrors.name && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>
            )}
          </div>
          <div>
            <label htmlFor="pet-species" className="mb-1 block text-sm text-slate-700">
              Espécie *
            </label>
            <select
              id="pet-species"
              value={form.species}
              onChange={(event) =>
                setForm({ ...form, species: event.target.value as PetSpecies })
              }
              className={inputClass}
            >
              {(Object.keys(petSpeciesLabels) as PetSpecies[]).map((species) => (
                <option key={species} value={species}>
                  {petSpeciesLabels[species]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pet-breed" className="mb-1 block text-sm text-slate-700">
              Raça
            </label>
            <input
              id="pet-breed"
              value={form.breed}
              onChange={(event) => setForm({ ...form, breed: event.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="pet-sex" className="mb-1 block text-sm text-slate-700">
              Sexo
            </label>
            <select
              id="pet-sex"
              value={form.sex}
              onChange={(event) => setForm({ ...form, sex: event.target.value as PetSex })}
              className={inputClass}
            >
              {(Object.keys(petSexLabels) as PetSex[]).map((sex) => (
                <option key={sex} value={sex}>
                  {petSexLabels[sex]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pet-birth" className="mb-1 block text-sm text-slate-700">
              Nascimento
            </label>
            <input
              id="pet-birth"
              type="date"
              value={form.birthDate}
              onChange={(event) => setForm({ ...form, birthDate: event.target.value })}
              className={inputClass}
            />
            {fieldErrors.birthDate && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.birthDate}</p>
            )}
          </div>
          <div>
            <label htmlFor="pet-weight" className="mb-1 block text-sm text-slate-700">
              Peso (kg)
            </label>
            <input
              id="pet-weight"
              inputMode="decimal"
              value={form.weight}
              onChange={(event) => setForm({ ...form, weight: event.target.value })}
              placeholder="12.5"
              className={inputClass}
            />
            {fieldErrors.weight && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.weight}</p>
            )}
          </div>
          <div>
            <label htmlFor="pet-color" className="mb-1 block text-sm text-slate-700">
              Cor
            </label>
            <input
              id="pet-color"
              value={form.color}
              onChange={(event) => setForm({ ...form, color: event.target.value })}
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <label htmlFor="pet-notes" className="mb-1 block text-sm text-slate-700">
              Observações
            </label>
            <textarea
              id="pet-notes"
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              rows={2}
              className={inputClass}
            />
          </div>
          {formError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2 lg:col-span-4">
              {formError}
            </div>
          )}
          <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
            >
              {saving ? "Salvando..." : editingId ? "Salvar" : "Criar"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="pet-search" className="text-sm text-slate-600">
          Buscar
        </label>
        <input
          id="pet-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Nome do pet, raça ou responsável"
          className="w-full max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
        />
        <select
          value={speciesFilter}
          onChange={(event) => setSpeciesFilter(event.target.value)}
          aria-label="Filtrar por espécie"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
        >
          <option value="">Todas as espécies</option>
          {(Object.keys(petSpeciesLabels) as PetSpecies[]).map((species) => (
            <option key={species} value={species}>
              {petSpeciesLabels[species]}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Filtrar por status"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
        >
          <option value="">Todos os status</option>
          <option value="ACTIVE">Ativos</option>
          <option value="INACTIVE">Inativos</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Pet</th>
              <th className="px-4 py-3">Espécie</th>
              <th className="px-4 py-3">Responsável</th>
              <th className="px-4 py-3">Peso</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {pets.map((pet) => (
              <tr key={pet.id} className="border-b border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-800">{pet.name}</td>
                <td className="px-4 py-3 text-slate-600">{petSpeciesLabels[pet.species]}</td>
                <td className="px-4 py-3 text-slate-600">
                  {pet.client ? (
                    <Link
                      href={`/clientes/${pet.client.id}`}
                      className="text-teal-700 hover:underline"
                    >
                      {pet.client.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {pet.weight ? `${pet.weight} kg` : "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      pet.status === "ACTIVE"
                        ? "rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700"
                        : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500"
                    }
                  >
                    {pet.status === "ACTIVE" ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-3 text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => startEdit(pet)}
                      className="text-teal-700 hover:underline"
                    >
                      Editar
                    </button>
                    {pet.status === "ACTIVE" ? (
                      <button
                        type="button"
                        onClick={() => void handleStatus(pet, "INACTIVE")}
                        className="text-red-600 hover:underline"
                      >
                        Inativar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleStatus(pet, "ACTIVE")}
                        className="text-teal-700 hover:underline"
                      >
                        Reativar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {pets.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Nenhum pet encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
