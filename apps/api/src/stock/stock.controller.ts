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
  createStockAdjustmentSchema,
  createStockMovementSchema,
  listMovementsQuerySchema,
  type CreateStockAdjustmentInput,
  type CreateStockMovementInput,
  type ListMovementsQuery,
} from "@petflow/shared";
import { AdminGuard } from "../common/guards/admin.guard";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { StockService } from "./stock.service";

const listMovementsPipe = new ZodValidationPipe(listMovementsQuerySchema);

@Controller("stock")
export class StockController {
  constructor(@Inject(StockService) private readonly stockService: StockService) {}

  @Get("movements")
  movements(
    @Auth() auth: AuthContext,
    @Query(listMovementsPipe) query: ListMovementsQuery,
  ) {
    return this.stockService.movements(auth, query);
  }

  @Get("low-stock")
  lowStock(@Auth() auth: AuthContext) {
    return this.stockService.lowStock(auth);
  }

  @Get("balance/:productId")
  balance(@Auth() auth: AuthContext, @Param("productId") productId: string) {
    return this.stockService.balance(auth, productId);
  }

  @Post("entries")
  entry(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(createStockMovementSchema)) body: CreateStockMovementInput,
  ) {
    return this.stockService.move(auth, body, "IN");
  }

  @Post("exits")
  exit(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(createStockMovementSchema)) body: CreateStockMovementInput,
  ) {
    return this.stockService.move(auth, body, "OUT");
  }

  @Post("adjustments")
  @UseGuards(AdminGuard)
  adjust(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(createStockAdjustmentSchema))
    body: CreateStockAdjustmentInput,
  ) {
    return this.stockService.adjust(auth, body);
  }
}
