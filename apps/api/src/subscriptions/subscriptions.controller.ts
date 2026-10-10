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
  cancelSubscriptionSchema,
  createSubscriptionSchema,
  listSubscriptionsQuerySchema,
  type CancelSubscriptionInput,
  type CreateSubscriptionInput,
  type ListSubscriptionsQuery,
} from "@petflow/shared";
import { AdminGuard } from "../common/guards/admin.guard";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { SubscriptionsService } from "./subscriptions.service";

const listQueryPipe = new ZodValidationPipe(listSubscriptionsQuerySchema);

@Controller("subscriptions")
export class SubscriptionsController {
  constructor(
    @Inject(SubscriptionsService)
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @Get()
  list(@Auth() auth: AuthContext, @Query(listQueryPipe) query: ListSubscriptionsQuery) {
    return this.subscriptionsService.list(auth, query);
  }

  @Get(":id")
  get(@Auth() auth: AuthContext, @Param("id") id: string) {
    return this.subscriptionsService.get(auth, id);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(createSubscriptionSchema)) body: CreateSubscriptionInput,
  ) {
    return this.subscriptionsService.create(auth, body);
  }

  @Post(":id/renew")
  @UseGuards(AdminGuard)
  renew(@Auth() auth: AuthContext, @Param("id") id: string) {
    return this.subscriptionsService.renew(auth, id);
  }

  @Post(":id/cancel")
  @UseGuards(AdminGuard)
  cancel(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(cancelSubscriptionSchema)) body: CancelSubscriptionInput,
  ) {
    return this.subscriptionsService.cancel(auth, id, body);
  }
}
