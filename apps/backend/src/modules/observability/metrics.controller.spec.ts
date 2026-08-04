import { UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";

import { MetricsController } from "./metrics.controller";
import type { MetricsService } from "./metrics.service";

function createController(values: Record<string, string | undefined>) {
  const metricsService = {
    getSnapshot: jest.fn().mockResolvedValue("metrics"),
  } as unknown as MetricsService;
  const configService = {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;

  return {
    controller: new MetricsController(metricsService, configService),
    metricsService,
  };
}

describe("MetricsController", () => {
  it("allows unauthenticated local development scrapes", async () => {
    const { controller } = createController({ NODE_ENV: "development" });

    await expect(controller.metrics()).resolves.toBe("metrics");
  });

  it("fails closed outside development when the configured key is missing", async () => {
    const { controller, metricsService } = createController({
      NODE_ENV: "production",
    });

    await expect(controller.metrics()).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(metricsService.getSnapshot).not.toHaveBeenCalled();
  });

  it("rejects an invalid API key", async () => {
    const { controller } = createController({
      NODE_ENV: "production",
      METRICS_API_KEY: "m".repeat(32),
    });

    await expect(controller.metrics("wrong-key")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("returns metrics for the configured x-api-key", async () => {
    const key = "m".repeat(32);
    const { controller } = createController({
      NODE_ENV: "production",
      METRICS_API_KEY: key,
    });

    await expect(controller.metrics(key)).resolves.toBe("metrics");
  });
});
