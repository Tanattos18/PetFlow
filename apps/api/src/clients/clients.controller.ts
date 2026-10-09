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
  createClientSchema,
  listClientsQuerySchema,
  updateClientSchema,
  updateRecordStatusSchema,
  type CreateClientInput,
  type ListClientsQuery,
  type UpdateClientInput,
  type UpdateRecordStatusInput,
} from "@petflow/shared";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { ClientsService } from "./clients.service";

const listQueryPipe = new ZodValidationPipe(listClientsQuerySchema);

@Controller("clients")
export class ClientsController {
  constructor(@Inject(ClientsService) private readonly clientsService: ClientsService) {}

  @Get()
  list(
    @Auth() auth: AuthContext,
    @Query(listQueryPipe) query: ListClientsQuery,
  ) {
    return this.clientsService.list(auth, query);
  }

  @Get(":id")
  get(@Auth() auth: AuthContext, @Param("id") id: string) {
    return this.clientsService.get(auth, id);
  }

  @Get(":id/pets")
  listPets(@Auth() auth: AuthContext, @Param("id") id: string) {
    return this.clientsService.listPets(auth, id);
  }

  @Post()
  create(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(createClientSchema)) body: CreateClientInput,
  ) {
    return this.clientsService.create(auth, body);
  }

  @Patch(":id")
  update(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateClientSchema)) body: UpdateClientInput,
  ) {
    return this.clientsService.update(auth, id, body);
  }

  @Patch(":id/status")
  updateStatus(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateRecordStatusSchema)) body: UpdateRecordStatusInput,
  ) {
    return this.clientsService.updateStatus(auth, id, body);
  }
}
