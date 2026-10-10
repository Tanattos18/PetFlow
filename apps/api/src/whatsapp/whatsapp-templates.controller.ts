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
  createWhatsAppTemplateSchema,
  listWhatsAppTemplatesQuerySchema,
  updateRecordStatusSchema,
  updateWhatsAppTemplateSchema,
  type CreateWhatsAppTemplateInput,
  type ListWhatsAppTemplatesQuery,
  type UpdateRecordStatusInput,
  type UpdateWhatsAppTemplateInput,
} from "@petflow/shared";
import { AdminGuard } from "../common/guards/admin.guard";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { WhatsAppTemplatesService } from "./whatsapp-templates.service";

const listQueryPipe = new ZodValidationPipe(listWhatsAppTemplatesQuerySchema);

@Controller("whatsapp/templates")
export class WhatsAppTemplatesController {
  constructor(
    @Inject(WhatsAppTemplatesService) private readonly templatesService: WhatsAppTemplatesService,
  ) {}

  @Get()
  list(@Auth() auth: AuthContext, @Query(listQueryPipe) query: ListWhatsAppTemplatesQuery) {
    return this.templatesService.list(auth, query);
  }

  @Get(":id")
  get(@Auth() auth: AuthContext, @Param("id") id: string) {
    return this.templatesService.get(auth, id);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(createWhatsAppTemplateSchema)) body: CreateWhatsAppTemplateInput,
  ) {
    return this.templatesService.create(auth, body);
  }

  @Patch(":id")
  @UseGuards(AdminGuard)
  update(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateWhatsAppTemplateSchema)) body: UpdateWhatsAppTemplateInput,
  ) {
    return this.templatesService.update(auth, id, body);
  }

  @Patch(":id/status")
  @UseGuards(AdminGuard)
  updateStatus(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateRecordStatusSchema)) body: UpdateRecordStatusInput,
  ) {
    return this.templatesService.update(auth, id, { status: body.status });
  }
}
