import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { toE164 } from "@petflow/whatsapp";
import {
  APPOINTMENT_BLOCKING_STATUSES,
  APPOINTMENT_REMINDER_LEAD_DEFAULT,
  APPOINTMENT_REMINDER_VARIABLE_COUNT,
  templateVariableCount,
  type CancelAppointmentInput,
  type CreateAppointmentInput,
  type ListAppointmentsQuery,
  type UpdateAppointmentInput,
  type UpdateAppointmentStatusInput,
} from "@petflow/shared";
import { PrismaService } from "../prisma/prisma.module";
import { env } from "../config/env";
import type { AuthContext } from "../common/decorators/auth.decorator";

const appointmentSelect = {
  id: true,
  companyId: true,
  clientId: true,
  petId: true,
  serviceId: true,
  startAt: true,
  endAt: true,
  startLocal: true,
  durationMinutes: true,
  status: true,
  notes: true,
  cancelReason: true,
  cancelledAt: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, name: true, phone: true, mobile: true, status: true } },
  pet: { select: { id: true, name: true, species: true } },
  service: { select: { id: true, name: true, price: true, status: true } },
  createdBy: { select: { id: true, name: true } },
  cancelledBy: { select: { id: true, name: true } },
} as const;

type AppointmentRecord = Prisma.AppointmentGetPayload<{ select: typeof appointmentSelect }>;

function formatAppointment(appointment: AppointmentRecord) {
  return {
    ...appointment,
    service: appointment.service
      ? { ...appointment.service, price: appointment.service.price.toFixed(2) }
      : appointment.service,
  };
}

type AppointmentDto = ReturnType<typeof formatAppointment>;

/**
 * Hora de parede (`startLocal`, sem offset) + offset do criador → instante UTC.
 * Offset no padrão leste-positivo (Brasil: -180), mesmo convenção de
 * `Date.getTimezoneOffset()` invertda no frontend.
 */
function computeStartAt(startLocal: string, utcOffsetMinutes: number): Date {
  const wallAsUtc = Date.parse(`${startLocal}:00.000Z`);
  return new Date(wallAsUtc - utcOffsetMinutes * 60_000);
}

/** Offset (min, leste-positivo) embutido no registro — derivado do par gravado. */
function deriveOffset(appointment: { startLocal: string; startAt: Date }): number {
  const wallAsUtc = Date.parse(`${appointment.startLocal}:00.000Z`);
  return Math.round((wallAsUtc - appointment.startAt.getTime()) / 60_000);
}

function wallWhen(startLocal: string): string {
  const [datePart, timePart] = startLocal.split("T");
  const [year, month, day] = datePart.split("-");
  return `${day}/${month}/${year} às ${timePart}`;
}

function isTerminal(status: string): boolean {
  return status === "COMPLETED" || status === "CANCELLED" || status === "NO_SHOW";
}

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(auth: AuthContext, query: ListAppointmentsQuery) {
    const andConditions: Prisma.AppointmentWhereInput[] = [];

    if (query.from || query.to) {
      andConditions.push({
        startLocal: {
          ...(query.from ? { gte: `${query.from}T00:00` } : {}),
          ...(query.to ? { lte: `${query.to}T23:59` } : {}),
        },
      });
    }
    if (query.status) andConditions.push({ status: query.status });
    if (query.clientId) andConditions.push({ clientId: query.clientId });
    if (query.petId) andConditions.push({ petId: query.petId });
    if (query.serviceId) andConditions.push({ serviceId: query.serviceId });
    if (query.search) {
      andConditions.push({
        OR: [
          { client: { name: { contains: query.search, mode: "insensitive" } } },
          { pet: { name: { contains: query.search, mode: "insensitive" } } },
          { service: { name: { contains: query.search, mode: "insensitive" } } },
        ],
      });
    }

    const where: Prisma.AppointmentWhereInput = {
      companyId: auth.companyId,
      ...(andConditions.length > 0 ? { AND: andConditions } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        select: appointmentSelect,
        orderBy: [{ startAt: "asc" }, { createdAt: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return {
      items: items.map(formatAppointment),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(auth: AuthContext, id: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, companyId: auth.companyId },
      select: appointmentSelect,
    });

    if (!appointment) {
      throw new NotFoundException("Agendamento não encontrado");
    }

    return formatAppointment(appointment);
  }

  async create(auth: AuthContext, input: CreateAppointmentInput) {
    const startAt = computeStartAt(input.startLocal, input.utcOffsetMinutes);
    const endAt = new Date(startAt.getTime() + input.durationMinutes * 60_000);

    if (startAt.getTime() < Date.now() - 60_000) {
      throw new BadRequestException("Não é possível agendar em horário no passado");
    }

    await this.assertReferences(auth, {
      clientId: input.clientId,
      petId: input.petId ?? null,
      serviceId: input.serviceId,
    });

    const created = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Company" WHERE id = ${auth.companyId} FOR UPDATE`;
      await this.assertNoConflict(tx, auth.companyId, startAt, endAt);
      return tx.appointment.create({
        data: {
          companyId: auth.companyId,
          clientId: input.clientId,
          petId: input.petId || null,
          serviceId: input.serviceId,
          startAt,
          endAt,
          startLocal: input.startLocal,
          durationMinutes: input.durationMinutes,
          notes: input.notes || null,
          createdByUserId: auth.userId,
        },
        select: appointmentSelect,
      });
    });

    const appointment = formatAppointment(created);
    await this.syncReminder(appointment, "sync", auth.userId);
    return appointment;
  }

  async update(auth: AuthContext, id: string, input: UpdateAppointmentInput) {
    const existing = await this.prisma.appointment.findFirst({
      where: { id, companyId: auth.companyId },
      select: appointmentSelect,
    });

    if (!existing) {
      throw new NotFoundException("Agendamento não encontrado");
    }
    if (isTerminal(existing.status)) {
      throw new ConflictException("Agendamento encerrado não pode ser editado");
    }

    const clientId = input.clientId ?? existing.clientId;
    const serviceId = input.serviceId ?? existing.serviceId;
    const petId = input.petId !== undefined ? input.petId || null : existing.petId;

    const refsChanged =
      input.clientId !== undefined || input.petId !== undefined || input.serviceId !== undefined;
    if (refsChanged) {
      await this.assertReferences(auth, { clientId, petId, serviceId });
    }

    let startAt = existing.startAt;
    let startLocal = existing.startLocal;
    const timeTouched =
      input.startLocal !== undefined ||
      input.utcOffsetMinutes !== undefined ||
      input.durationMinutes !== undefined;

    if (input.startLocal !== undefined || input.utcOffsetMinutes !== undefined) {
      startLocal = input.startLocal ?? existing.startLocal;
      const offset = input.utcOffsetMinutes ?? deriveOffset(existing);
      startAt = computeStartAt(startLocal, offset);
    }
    const durationMinutes = input.durationMinutes ?? existing.durationMinutes;
    const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);

    if (startAt.getTime() < Date.now() - 60_000) {
      throw new BadRequestException("Não é possível reagendar para horário no passado");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Company" WHERE id = ${auth.companyId} FOR UPDATE`;

      if (
        startAt.getTime() !== existing.startAt.getTime() ||
        endAt.getTime() !== existing.endAt.getTime()
      ) {
        await this.assertNoConflict(tx, auth.companyId, startAt, endAt, existing.id);
      }

      return tx.appointment.update({
        where: { id: existing.id },
        data: {
          ...(refsChanged
            ? { clientId, serviceId, petId }
            : {}),
          ...(timeTouched
            ? { startAt, endAt, startLocal, durationMinutes }
            : {}),
          ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
        },
        select: appointmentSelect,
      });
    });

    const appointment = formatAppointment(updated);
    if (timeTouched || refsChanged) {
      await this.syncReminder(appointment, "sync", auth.userId);
    }
    return appointment;
  }

  async updateStatus(
    auth: AuthContext,
    id: string,
    input: UpdateAppointmentStatusInput,
  ) {
    const existing = await this.prisma.appointment.findFirst({
      where: { id, companyId: auth.companyId },
      select: appointmentSelect,
    });

    if (!existing) {
      throw new NotFoundException("Agendamento não encontrado");
    }
    if (isTerminal(existing.status)) {
      throw new ConflictException(
        `Agendamento já encerrado (${existing.status}) — nenhuma transição é aceita`,
      );
    }

    const updated = await this.prisma.appointment.update({
      where: { id: existing.id },
      data: { status: input.status },
      select: appointmentSelect,
    });

    const appointment = formatAppointment(updated);
    await this.syncReminder(
      appointment,
      isTerminal(appointment.status) ? "cancel" : "sync",
      auth.userId,
    );
    return appointment;
  }

  async cancel(auth: AuthContext, id: string, input: CancelAppointmentInput) {
    const existing = await this.prisma.appointment.findFirst({
      where: { id, companyId: auth.companyId },
      select: { id: true, status: true },
    });

    if (!existing) {
      throw new NotFoundException("Agendamento não encontrado");
    }
    if (isTerminal(existing.status)) {
      throw new ConflictException(
        existing.status === "CANCELLED"
          ? "Agendamento já cancelado"
          : "Agendamento já encerrado — cancele antes de concluir",
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.appointment.updateMany({
        where: { id: existing.id, status: { in: [...APPOINTMENT_BLOCKING_STATUSES] } },
        data: {
          status: "CANCELLED",
          cancelReason: input.reason,
          cancelledAt: new Date(),
          cancelledByUserId: auth.userId,
        },
      });

      if (updated.count === 0) {
        throw new ConflictException("Agendamento já encerrado");
      }

      return tx.appointment.findFirst({
        where: { id: existing.id },
        select: appointmentSelect,
      });
    });

    if (!result) {
      throw new NotFoundException("Agendamento não encontrado");
    }

    const appointment = formatAppointment(result);
    await this.syncReminder(appointment, "cancel", auth.userId);
    return appointment;
  }

  private async assertReferences(
    auth: AuthContext,
    refs: { clientId: string; petId: string | null; serviceId: string },
  ) {
    const client = await this.prisma.client.findFirst({
      where: { id: refs.clientId, companyId: auth.companyId },
      select: { id: true, status: true },
    });
    if (!client) {
      throw new BadRequestException("Cliente não encontrado");
    }
    if (client.status !== "ACTIVE") {
      throw new BadRequestException("Cliente está inativo");
    }

    if (refs.petId) {
      const pet = await this.prisma.pet.findFirst({
        where: { id: refs.petId, companyId: auth.companyId },
        select: { id: true, clientId: true, status: true },
      });
      if (!pet) {
        throw new BadRequestException("Pet não encontrado");
      }
      if (pet.clientId !== refs.clientId) {
        throw new BadRequestException("Pet não pertence ao cliente informado");
      }
      if (pet.status !== "ACTIVE") {
        throw new BadRequestException("Pet está inativo");
      }
    }

    const service = await this.prisma.service.findFirst({
      where: { id: refs.serviceId, companyId: auth.companyId },
      select: { id: true, status: true },
    });
    if (!service) {
      throw new BadRequestException("Serviço não encontrado");
    }
    if (service.status !== "ACTIVE") {
      throw new BadRequestException("Serviço está inativo");
    }
  }

  /**
   * Conflito de empresa inteira: qualquer SCHEDULED/CONFIRMED sobreposto
   * bloqueia (fim-início exato permitido). Exige lock da `Company` na
   * transação chamadora (mesmo padrão da sessão de caixa).
   */
  private async assertNoConflict(
    tx: Prisma.TransactionClient,
    companyId: string,
    startAt: Date,
    endAt: Date,
    excludeId?: string,
  ) {
    const clash = await tx.appointment.findFirst({
      where: {
        companyId,
        status: { in: [...APPOINTMENT_BLOCKING_STATUSES] },
        ...(excludeId ? { id: { not: excludeId } } : {}),
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
      select: { id: true, startLocal: true },
    });

    if (clash) {
      throw new ConflictException(
        "Horário indisponível: já existe um agendamento ocupando este período",
      );
    }
  }

  /**
   * Lembrete automático (fila WhatsApp existente — worker sem alteração).
   * Chaves: `appointment-reminder:<id>`; reagendar atualiza a pendente;
   * cancelar/concluir cancela a pendente. Falhas aqui nunca derrubam o
   * CRUD de agendamentos (apenas logam).
   */
  private async syncReminder(
    appointment: AppointmentDto,
    action: "sync" | "cancel",
    actingUserId: string,
  ): Promise<void> {
    try {
      const idempotencyKey = `appointment-reminder:${appointment.id}`;
      const existing = await this.prisma.whatsAppMessage.findUnique({
        where: {
          companyId_idempotencyKey: {
            companyId: appointment.companyId,
            idempotencyKey,
          },
        },
        select: { id: true, status: true },
      });

      const cancelPending = async (reason: string) => {
        if (existing && existing.status === "PENDING") {
          await this.prisma.whatsAppMessage.update({
            where: { id: existing.id },
            data: {
              status: "CANCELLED",
              cancelReason: reason,
              cancelledByUserId: actingUserId,
              nextAttemptAt: null,
            },
          });
        }
      };

      if (action === "cancel" || isTerminal(appointment.status)) {
        await cancelPending(
          appointment.status === "CANCELLED"
            ? "Agendamento cancelado"
            : "Agendamento encerrado",
        );
        return;
      }

      const eligibility = await this.evaluateReminder(appointment);
      if (!eligibility.ok) {
        await cancelPending(eligibility.reason);
        return;
      }

      const leadMinutes =
        eligibility.config.reminderLeadMinutes ?? APPOINTMENT_REMINDER_LEAD_DEFAULT;
      const scheduled = appointment.startAt.getTime() - leadMinutes * 60_000;
      const nextAttemptAt = new Date(Math.max(Date.now(), scheduled));
      const variables = [
        appointment.pet?.name || appointment.client.name,
        appointment.service?.name ?? "",
        wallWhen(appointment.startLocal),
      ];

      if (existing) {
        if (existing.status === "PENDING") {
          await this.prisma.whatsAppMessage.update({
            where: { id: existing.id },
            data: {
              nextAttemptAt,
              variables,
              templateNameSnapshot: eligibility.template.name,
              templateLanguageSnapshot: eligibility.template.language,
              templateBodySnapshot: eligibility.template.body,
            },
          });
        }
        return;
      }

      await this.prisma.whatsAppMessage.create({
        data: {
          companyId: appointment.companyId,
          clientId: appointment.client.id,
          templateId: eligibility.template.id,
          consentId: eligibility.consent.id,
          toPhone: eligibility.toPhone,
          variables,
          templateNameSnapshot: eligibility.template.name,
          templateLanguageSnapshot: eligibility.template.language,
          templateBodySnapshot: eligibility.template.body,
          origin: "SERVICE_REMINDER",
          idempotencyKey,
          nextAttemptAt,
          createdByUserId: appointment.createdBy?.id ?? actingUserId,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Falha ao sincronizar lembrete do agendamento ${appointment.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async evaluateReminder(appointment: AppointmentDto): Promise<
    | { ok: false; reason: string }
    | {
        ok: true;
        config: { reminderLeadMinutes: number };
        template: { id: string; name: string; language: string; body: string };
        consent: { id: string };
        toPhone: string;
      }
  > {
    const ineligible = (reason: string) => ({ ok: false as const, reason });

    if (appointment.startAt.getTime() <= Date.now()) {
      return ineligible("Agendamento sem horário futuro");
    }

    const config = await this.prisma.whatsAppConfig.findUnique({
      where: { companyId: appointment.companyId },
      select: {
        status: true,
        phoneNumberId: true,
        reminderTemplateId: true,
        reminderLeadMinutes: true,
      },
    });
    if (!config) return ineligible("Integração WhatsApp não configurada");
    if (config.status === "DISCONNECTED") return ineligible("Integração desconectada");
    if (!config.phoneNumberId) return ineligible("Número de telefone não configurado");
    if (!config.reminderTemplateId) return ineligible("Template de lembrete não selecionado");

    const template = await this.prisma.whatsAppTemplate.findFirst({
      where: { id: config.reminderTemplateId, companyId: appointment.companyId },
      select: { id: true, name: true, language: true, body: true, status: true, approval: true },
    });
    if (!template) return ineligible("Template de lembrete não encontrado");
    if (template.status !== "ACTIVE") return ineligible("Template de lembrete inativo");
    if (template.approval !== "APPROVED") return ineligible("Template de lembrete não aprovado");
    if (templateVariableCount(template.body) !== APPOINTMENT_REMINDER_VARIABLE_COUNT) {
      return ineligible("Template de lembrete deve ter exatamente 3 variáveis");
    }

    const phone = appointment.client.phone || appointment.client.mobile || "";
    const toPhone = toE164(phone, env.WHATSAPP_COUNTRY_CODE);
    if (!toPhone) return ineligible("Cliente sem telefone válido para WhatsApp");

    const consent = await this.prisma.whatsAppConsent.findFirst({
      where: { clientId: appointment.client.id, companyId: appointment.companyId },
      select: { id: true, status: true },
    });
    if (!consent) return ineligible("Cliente sem consentimento registrado");
    if (consent.status === "OPTED_OUT") return ineligible("Cliente realizou descadastro");

    return {
      ok: true,
      config: { reminderLeadMinutes: config.reminderLeadMinutes },
      template: {
        id: template.id,
        name: template.name,
        language: template.language,
        body: template.body,
      },
      consent: { id: consent.id },
      toPhone,
    };
  }
}
