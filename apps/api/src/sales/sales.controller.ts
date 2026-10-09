import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  cancelSaleSchema,
  createSaleSchema,
  listSalesQuerySchema,
  type CancelSaleInput,
  type CreateSaleInput,
  type ListSalesQuery,
} from "@petflow/shared";
import { AdminGuard } from "../common/guards/admin.guard";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { SalesService } from "./sales.service";

const listSalesPipe = new ZodValidationPipe(listSalesQuerySchema);

@Controller("sales")
export class SalesController {
  constructor(@Inject(SalesService) private readonly salesService: SalesService) {}

  @Post()
  create(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(createSaleSchema)) body: CreateSaleInput,
  ) {
    return this.salesService.create(auth, body);
  }

  @Get()
  list(@Auth() auth: AuthContext, @Query(listSalesPipe) query: ListSalesQuery) {
    return this.salesService.list(auth, query);
  }

  @Get(":id")
  detail(@Auth() auth: AuthContext, @Param("id") id: string) {
    return this.salesService.detail(auth, id);
  }

  @Post(":id/cancel")
  @UseGuards(AdminGuard)
  cancel(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(cancelSaleSchema)) body: CancelSaleInput,
  ) {
    return this.salesService.cancel(auth, id, body);
  }
}
