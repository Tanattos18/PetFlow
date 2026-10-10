import {
  Body,
  Controller,
  Get,
  Inject,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import {
  updateWhatsAppConfigSchema,
  updateWhatsAppConfigStatusSchema,
  type UpdateWhatsAppConfigInput,
  type UpdateWhatsAppConfigStatusInput,
} from "@petflow/shared";
import { AdminGuard } from "../common/guards/admin.guard";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { WhatsAppConfigService } from "./whatsapp-config.service";

@Controller("whatsapp/config")
export class WhatsAppConfigController {
  constructor(
    @Inject(WhatsAppConfigService) private readonly configService: WhatsAppConfigService,
  ) {}

  @Get()
  get(@Auth() auth: AuthContext) {
    return this.configService.get(auth);
  }

  @Put()
  @UseGuards(AdminGuard)
  update(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(updateWhatsAppConfigSchema)) body: UpdateWhatsAppConfigInput,
  ) {
    return this.configService.update(auth, body);
  }

  @Post("health")
  @UseGuards(AdminGuard)
  health(@Auth() auth: AuthContext) {
    return this.configService.health(auth);
  }

  @Patch("status")
  @UseGuards(AdminGuard)
  updateStatus(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(updateWhatsAppConfigStatusSchema))
    body: UpdateWhatsAppConfigStatusInput,
  ) {
    return this.configService.updateStatus(auth, body);
  }
}
