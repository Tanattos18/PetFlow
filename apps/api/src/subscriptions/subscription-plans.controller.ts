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
  createSubscriptionPlanSchema,
  listSubscriptionPlansQuerySchema,
  updateRecordStatusSchema,
  updateSubscriptionPlanSchema,
  type CreateSubscriptionPlanInput,
  type ListSubscriptionPlansQuery,
  type UpdateRecordStatusInput,
  type UpdateSubscriptionPlanInput,
} from "@petflow/shared";
import { AdminGuard } from "../common/guards/admin.guard";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { SubscriptionPlansService } from "./subscription-plans.service";

const listQueryPipe = new ZodValidationPipe(listSubscriptionPlansQuerySchema);

@Controller("subscription-plans")
export class SubscriptionPlansController {
  constructor(
    @Inject(SubscriptionPlansService)
    private readonly plansService: SubscriptionPlansService,
  ) {}

  @Get()
  list(@Auth() auth: AuthContext, @Query(listQueryPipe) query: ListSubscriptionPlansQuery) {
    return this.plansService.list(auth, query);
  }

  @Get(":id")
  get(@Auth() auth: AuthContext, @Param("id") id: string) {
    return this.plansService.get(auth, id);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(createSubscriptionPlanSchema))
    body: CreateSubscriptionPlanInput,
  ) {
    return this.plansService.create(auth, body);
  }

  @Patch(":id")
  @UseGuards(AdminGuard)
  update(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateSubscriptionPlanSchema))
    body: UpdateSubscriptionPlanInput,
  ) {
    return this.plansService.update(auth, id, body);
  }

  @Patch(":id/status")
  @UseGuards(AdminGuard)
  updateStatus(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateRecordStatusSchema))
    body: UpdateRecordStatusInput,
  ) {
    return this.plansService.updateStatus(auth, id, body);
  }
}
