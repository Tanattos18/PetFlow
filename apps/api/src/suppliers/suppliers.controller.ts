import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  createSupplierSchema,
  listCatalogQuerySchema,
  updateRecordStatusSchema,
  updateSupplierSchema,
  type CreateSupplierInput,
  type ListCatalogQuery,
  type UpdateRecordStatusInput,
  type UpdateSupplierInput,
} from "@petflow/shared";
import { AdminGuard } from "../common/guards/admin.guard";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { SuppliersService } from "./suppliers.service";

const listQueryPipe = new ZodValidationPipe(listCatalogQuerySchema);

@Controller("suppliers")
export class SuppliersController {
  constructor(
    @Inject(SuppliersService) private readonly suppliersService: SuppliersService,
  ) {}

  @Get()
  list(
    @Auth() auth: AuthContext,
    @Query(listQueryPipe) query: ListCatalogQuery,
  ) {
    return this.suppliersService.list(auth, query);
  }

  @Get(":id")
  get(@Auth() auth: AuthContext, @Param("id") id: string) {
    return this.suppliersService.get(auth, id);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(createSupplierSchema)) body: CreateSupplierInput,
  ) {
    return this.suppliersService.create(auth, body);
  }

  @Patch(":id")
  @UseGuards(AdminGuard)
  update(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateSupplierSchema)) body: UpdateSupplierInput,
  ) {
    return this.suppliersService.update(auth, id, body);
  }

  @Patch(":id/status")
  @UseGuards(AdminGuard)
  updateStatus(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateRecordStatusSchema)) body: UpdateRecordStatusInput,
  ) {
    return this.suppliersService.updateStatus(auth, id, body);
  }
}
