import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import {
  cancelTenantSubscriptionSchema,
  updateTenantSubscriptionSchema,
  type CancelTenantSubscriptionInput,
  type UpdateTenantSubscriptionInput,
} from "@petflow/shared";
import { AdminGuard } from "../common/guards/admin.guard";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { BillingService } from "./billing.service";

@Controller("billing")
export class BillingController {
  constructor(@Inject(BillingService) private readonly billingService: BillingService) {}

  @Get("plans")
  listPlans() {
    return this.billingService.listPlans();
  }

  @Get("subscription")
  getSubscription(@Auth() auth: AuthContext) {
    return this.billingService.getSubscription(auth);
  }

  @Put("subscription")
  @UseGuards(AdminGuard)
  upsertSubscription(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(updateTenantSubscriptionSchema))
    body: UpdateTenantSubscriptionInput,
  ) {
    return this.billingService.upsertSubscription(auth, body);
  }

  @Post("subscription/renew")
  @UseGuards(AdminGuard)
  renew(@Auth() auth: AuthContext) {
    return this.billingService.renew(auth);
  }

  @Post("subscription/cancel")
  @UseGuards(AdminGuard)
  cancel(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(cancelTenantSubscriptionSchema))
    body: CancelTenantSubscriptionInput,
  ) {
    return this.billingService.cancel(auth, body);
  }
}
