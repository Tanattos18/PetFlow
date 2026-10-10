import { Controller, Get, Headers, Header, Post, Query, Req, Inject } from "@nestjs/common";
import { Body } from "@nestjs/common";
import type { Request } from "express";
import { Public } from "../common/decorators/public.decorator";
import { WhatsAppWebhookService } from "./whatsapp-webhook.service";

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

@Public()
@Controller("webhooks")
export class WhatsAppWebhookController {
  constructor(
    @Inject(WhatsAppWebhookService) private readonly webhookService: WhatsAppWebhookService,
  ) {}

  @Get("whatsapp")
  @Header("Content-Type", "text/plain; charset=utf-8")
  verify(@Query() query: Record<string, unknown>): string {
    return this.webhookService.verify(query);
  }

  @Post("whatsapp")
  handle(
    @Req() req: RequestWithRawBody,
    @Headers("x-hub-signature-256") signature: string | undefined,
    @Body() body: unknown,
  ) {
    return this.webhookService.handle({
      rawBody: req.rawBody ?? Buffer.from(JSON.stringify(body ?? {})),
      body,
      signature,
    });
  }
}
