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
  cashSummaryQuerySchema,
  closeCashSessionSchema,
  createCashMovementSchema,
  listCashMovementsQuerySchema,
  openCashSessionSchema,
  reversalCashMovementSchema,
  type CashSummaryQuery,
  type CloseCashSessionInput,
  type CreateCashMovementInput,
  type ListCashMovementsQuery,
  type OpenCashSessionInput,
  type ReversalCashMovementInput,
} from "@petflow/shared";
import { AdminGuard } from "../common/guards/admin.guard";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CashService } from "./cash.service";

const listMovementsPipe = new ZodValidationPipe(listCashMovementsQuerySchema);
const summaryPipe = new ZodValidationPipe(cashSummaryQuerySchema);

@Controller("cash")
export class CashController {
  constructor(@Inject(CashService) private readonly cashService: CashService) {}

  @Post("sessions")
  @UseGuards(AdminGuard)
  open(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(openCashSessionSchema)) body: OpenCashSessionInput,
  ) {
    return this.cashService.open(auth, body);
  }

  @Get("sessions/current")
  current(@Auth() auth: AuthContext) {
    return this.cashService.current(auth);
  }

  @Get("sessions")
  sessions(@Auth() auth: AuthContext) {
    return this.cashService.sessions(auth);
  }

  @Get("sessions/:id/summary")
  sessionSummary(@Auth() auth: AuthContext, @Param("id") id: string) {
    return this.cashService.sessionSummary(auth, id);
  }

  @Post("sessions/:id/close")
  @UseGuards(AdminGuard)
  close(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(closeCashSessionSchema)) body: CloseCashSessionInput,
  ) {
    return this.cashService.close(auth, id, body);
  }

  @Post("movements")
  @UseGuards(AdminGuard)
  createMovement(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(createCashMovementSchema)) body: CreateCashMovementInput,
  ) {
    return this.cashService.createManualMovement(auth, body);
  }

  @Get("movements")
  movements(@Auth() auth: AuthContext, @Query(listMovementsPipe) query: ListCashMovementsQuery) {
    return this.cashService.movements(auth, query);
  }

  @Post("movements/:id/reversal")
  @UseGuards(AdminGuard)
  reversal(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(reversalCashMovementSchema)) body: ReversalCashMovementInput,
  ) {
    return this.cashService.reversal(auth, id, body);
  }

  @Get("summary")
  summary(@Auth() auth: AuthContext, @Query(summaryPipe) query: CashSummaryQuery) {
    return this.cashService.summary(auth, query);
  }
}
