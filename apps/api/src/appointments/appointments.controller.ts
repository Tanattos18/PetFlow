import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  cancelAppointmentSchema,
  createAppointmentSchema,
  listAppointmentsQuerySchema,
  updateAppointmentSchema,
  updateAppointmentStatusSchema,
  type CancelAppointmentInput,
  type CreateAppointmentInput,
  type ListAppointmentsQuery,
  type UpdateAppointmentInput,
  type UpdateAppointmentStatusInput,
} from "@petflow/shared";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { AppointmentsService } from "./appointments.service";

const listQueryPipe = new ZodValidationPipe(listAppointmentsQuerySchema);

/**
 * Operação diária: leitura e escrita com sessão autenticada (MEMBER
 * pode agendar); nenhum endpoint público e nenhuma escrita restrita a
 * ADMIN — mesma política de clientes/pets.
 */
@Controller("appointments")
export class AppointmentsController {
  constructor(
    @Inject(AppointmentsService) private readonly appointmentsService: AppointmentsService,
  ) {}

  @Get()
  list(@Auth() auth: AuthContext, @Query(listQueryPipe) query: ListAppointmentsQuery) {
    return this.appointmentsService.list(auth, query);
  }

  @Get(":id")
  get(@Auth() auth: AuthContext, @Param("id") id: string) {
    return this.appointmentsService.get(auth, id);
  }

  @Post()
  create(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(createAppointmentSchema)) body: CreateAppointmentInput,
  ) {
    return this.appointmentsService.create(auth, body);
  }

  @Patch(":id")
  update(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateAppointmentSchema)) body: UpdateAppointmentInput,
  ) {
    return this.appointmentsService.update(auth, id, body);
  }

  @Patch(":id/status")
  updateStatus(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateAppointmentStatusSchema)) body: UpdateAppointmentStatusInput,
  ) {
    return this.appointmentsService.updateStatus(auth, id, body);
  }

  @Post(":id/cancel")
  cancel(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(cancelAppointmentSchema)) body: CancelAppointmentInput,
  ) {
    return this.appointmentsService.cancel(auth, id, body);
  }
}
