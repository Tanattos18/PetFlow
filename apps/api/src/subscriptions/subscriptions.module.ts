import { Module } from "@nestjs/common";
import { SubscriptionPlansController } from "./subscription-plans.controller";
import { SubscriptionPlansService } from "./subscription-plans.service";
import { SubscriptionsController } from "./subscriptions.controller";
import { SubscriptionsService } from "./subscriptions.service";

@Module({
  controllers: [SubscriptionPlansController, SubscriptionsController],
  providers: [SubscriptionPlansService, SubscriptionsService],
  exports: [SubscriptionPlansService, SubscriptionsService],
})
export class SubscriptionsModule {}
