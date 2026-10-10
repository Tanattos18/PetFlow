import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Put,
  Query,
} from "@nestjs/common";
import {
  listWhatsAppConsentsQuerySchema,
  upsertWhatsAppConsentSchema,
  type ListWhatsAppConsentsQuery,
  type UpsertWhatsAppConsentInput,
} from "@petflow/shared";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { WhatsAppConsentsService } from "./whatsapp-consents.service";

const listQueryPipe = new ZodValidationPipe(listWhatsAppConsentsQuerySchema);

@Controller("whatsapp/consents")
export class WhatsAppConsentsController {
  constructor(
    @Inject(WhatsAppConsentsService) private readonly consentsService: WhatsAppConsentsService,
  ) {}

  @Get()
  list(@Auth() auth: AuthContext, @Query(listQueryPipe) query: ListWhatsAppConsentsQuery) {
    return this.consentsService.list(auth, query);
  }

  @Get(":clientId")
  get(@Auth() auth: AuthContext, @Param("clientId") clientId: string) {
    return this.consentsService.get(auth, clientId);
  }

  @Put(":clientId")
  upsert(
    @Auth() auth: AuthContext,
    @Param("clientId") clientId: string,
    @Body(new ZodValidationPipe(upsertWhatsAppConsentSchema)) body: UpsertWhatsAppConsentInput,
  ) {
    return this.consentsService.upsert(auth, clientId, body);
  }
}
