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
  cancelWhatsAppMessageSchema,
  createWhatsAppMessageSchema,
  listWhatsAppMessagesQuerySchema,
  type CancelWhatsAppMessageInput,
  type CreateWhatsAppMessageInput,
  type ListWhatsAppMessagesQuery,
} from "@petflow/shared";
import { AdminGuard } from "../common/guards/admin.guard";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { WhatsAppMessagesService } from "./whatsapp-messages.service";

const listQueryPipe = new ZodValidationPipe(listWhatsAppMessagesQuerySchema);

@Controller("whatsapp/messages")
export class WhatsAppMessagesController {
  constructor(
    @Inject(WhatsAppMessagesService) private readonly messagesService: WhatsAppMessagesService,
  ) {}

  @Get()
  list(@Auth() auth: AuthContext, @Query(listQueryPipe) query: ListWhatsAppMessagesQuery) {
    return this.messagesService.list(auth, query);
  }

  @Get(":id")
  get(@Auth() auth: AuthContext, @Param("id") id: string) {
    return this.messagesService.get(auth, id);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(createWhatsAppMessageSchema)) body: CreateWhatsAppMessageInput,
  ) {
    return this.messagesService.create(auth, body);
  }

  @Post(":id/cancel")
  @UseGuards(AdminGuard)
  cancel(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(cancelWhatsAppMessageSchema)) body: CancelWhatsAppMessageInput,
  ) {
    return this.messagesService.cancel(auth, id, body);
  }
}
