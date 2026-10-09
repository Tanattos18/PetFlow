import { describe, expect, it } from "vitest";
import request from "supertest";
import { NestFactory } from "@nestjs/core";
import { INestApplication } from "@nestjs/common";
import { AppModule } from "../apps/api/src/app.module";
import { AllExceptionsFilter } from "../apps/api/src/common/filters/all-exceptions.filter";

async function createTestApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();
  return app;
}

describe("PetFlow API - health check", () => {
  let app: INestApplication;

  it("GET /health retorna status ok", async () => {
    app = await createTestApp();
    const response = await request(app.getHttpServer()).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "ok",
      service: "petflow-api",
    });
    expect(typeof response.body.timestamp).toBe("string");
    expect(typeof response.body.uptimeSeconds).toBe("number");

    await app.close();
  });

  it("GET inexistente retorna 404 tratado", async () => {
    app = await createTestApp();
    const response = await request(app.getHttpServer()).get("/nao-existe");

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ statusCode: 404 });
    expect(typeof response.body.timestamp).toBe("string");

    await app.close();
  });
});
