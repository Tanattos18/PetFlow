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
  createPetSchema,
  listPetsQuerySchema,
  updatePetSchema,
  updateRecordStatusSchema,
  type CreatePetInput,
  type ListPetsQuery,
  type UpdatePetInput,
  type UpdateRecordStatusInput,
} from "@petflow/shared";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { PetsService } from "./pets.service";

const listQueryPipe = new ZodValidationPipe(listPetsQuerySchema);

@Controller("pets")
export class PetsController {
  constructor(@Inject(PetsService) private readonly petsService: PetsService) {}

  @Get()
  list(@Auth() auth: AuthContext, @Query(listQueryPipe) query: ListPetsQuery) {
    return this.petsService.list(auth, query);
  }

  @Get(":id")
  get(@Auth() auth: AuthContext, @Param("id") id: string) {
    return this.petsService.get(auth, id);
  }

  @Post()
  create(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(createPetSchema)) body: CreatePetInput,
  ) {
    return this.petsService.create(auth, body);
  }

  @Patch(":id")
  update(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updatePetSchema)) body: UpdatePetInput,
  ) {
    return this.petsService.update(auth, id, body);
  }

  @Patch(":id/status")
  updateStatus(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateRecordStatusSchema)) body: UpdateRecordStatusInput,
  ) {
    return this.petsService.updateStatus(auth, id, body);
  }
}
