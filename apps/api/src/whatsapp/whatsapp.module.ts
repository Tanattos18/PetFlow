import { Module } from "@nestjs/common";
import { WhatsAppConfigController } from "./whatsapp-config.controller";
import { WhatsAppConfigService } from "./whatsapp-config.service";
import { WhatsAppConsentsController } from "./whatsapp-consents.controller";
import { WhatsAppConsentsService } from "./whatsapp-consents.service";
import { WhatsAppMessagesController } from "./whatsapp-messages.controller";
import { WhatsAppMessagesService } from "./whatsapp-messages.service";
import { WhatsAppProviderService } from "./whatsapp-provider.service";
import { WhatsAppTemplatesController } from "./whatsapp-templates.controller";
import { WhatsAppTemplatesService } from "./whatsapp-templates.service";
import { WhatsAppWebhookController } from "./whatsapp-webhook.controller";
import { WhatsAppWebhookService } from "./whatsapp-webhook.service";

@Module({
  controllers: [
    WhatsAppConfigController,
    WhatsAppTemplatesController,
    WhatsAppConsentsController,
    WhatsAppMessagesController,
    WhatsAppWebhookController,
  ],
  providers: [
    WhatsAppConfigService,
    WhatsAppTemplatesService,
    WhatsAppConsentsService,
    WhatsAppMessagesService,
    WhatsAppWebhookService,
    WhatsAppProviderService,
  ],
  exports: [WhatsAppProviderService],
})
export class WhatsAppModule {}
