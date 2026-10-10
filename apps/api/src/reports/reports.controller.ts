import {
  Controller,
  Get,
  Inject,
  Query,
  Res,
  StreamableFile,
} from "@nestjs/common";
import type { Response } from "express";
import {
  cashReportQuerySchema,
  clientsReportQuerySchema,
  dashboardSummaryQuerySchema,
  salesReportQuerySchema,
  stockAlertsReportQuerySchema,
  stockMovementsReportQuerySchema,
  whatsappReportQuerySchema,
  type CashReportQuery,
  type ClientsReportQuery,
  type DashboardSummaryQuery,
  type SalesReportQuery,
  type StockAlertsReportQuery,
  type StockMovementsReportQuery,
  type WhatsAppReportQuery,
} from "@petflow/shared";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { ReportsService, type CsvResult } from "./reports.service";

const summaryPipe = new ZodValidationPipe(dashboardSummaryQuerySchema);
const salesPipe = new ZodValidationPipe(salesReportQuerySchema);
const stockAlertsPipe = new ZodValidationPipe(stockAlertsReportQuerySchema);
const stockMovementsPipe = new ZodValidationPipe(stockMovementsReportQuerySchema);
const cashPipe = new ZodValidationPipe(cashReportQuerySchema);
const clientsPipe = new ZodValidationPipe(clientsReportQuerySchema);
const whatsappPipe = new ZodValidationPipe(whatsappReportQuerySchema);

function isCsvResult(result: object | CsvResult): result is CsvResult {
  return typeof (result as CsvResult).csv === "string";
}

@Controller("reports")
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reports: ReportsService) {}

  private sendCsv(res: Response, result: CsvResult): StreamableFile {
    res.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    });
    return new StreamableFile(Buffer.from(result.csv, "utf8"));
  }

  @Get("summary")
  summary(
    @Auth() auth: AuthContext,
    @Query(summaryPipe) query: DashboardSummaryQuery,
  ) {
    return this.reports.summary(auth, query);
  }

  @Get("sales")
  async sales(
    @Auth() auth: AuthContext,
    @Query(salesPipe) query: SalesReportQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.reports.sales(auth, query);
    if (isCsvResult(result)) return this.sendCsv(res, result);
    return result;
  }

  @Get("stock/alerts")
  async stockAlerts(
    @Auth() auth: AuthContext,
    @Query(stockAlertsPipe) query: StockAlertsReportQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.reports.stockAlerts(auth, query);
    if (isCsvResult(result)) return this.sendCsv(res, result);
    return result;
  }

  @Get("stock/movements")
  async stockMovements(
    @Auth() auth: AuthContext,
    @Query(stockMovementsPipe) query: StockMovementsReportQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.reports.stockMovements(auth, query);
    if (isCsvResult(result)) return this.sendCsv(res, result);
    return result;
  }

  @Get("cash")
  cash(@Auth() auth: AuthContext, @Query(cashPipe) query: CashReportQuery) {
    return this.reports.cash(auth, query);
  }

  @Get("clients")
  clients(
    @Auth() auth: AuthContext,
    @Query(clientsPipe) query: ClientsReportQuery,
  ) {
    return this.reports.clients(auth, query);
  }

  @Get("whatsapp")
  whatsapp(
    @Auth() auth: AuthContext,
    @Query(whatsappPipe) query: WhatsAppReportQuery,
  ) {
    return this.reports.whatsapp(auth, query);
  }
}
