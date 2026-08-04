import { configSchema } from "./config.schema";

const validConfig = {
  DATABASE_URL: "postgresql://localhost:5432/forumo",
  JWT_SECRET: "development-secret",
  STRIPE_SECRET_KEY: "stripe-test-key",
};

describe("configSchema production secrets", () => {
  it("allows short local-only secrets outside production", () => {
    expect(
      configSchema.safeParse({ ...validConfig, NODE_ENV: "test" }).success,
    ).toBe(true);
  });

  it("rejects unknown environment names that could bypass production checks", () => {
    expect(
      configSchema.safeParse({ ...validConfig, NODE_ENV: "prod" }).success,
    ).toBe(false);
  });

  it("rejects a production JWT secret shorter than 32 characters", () => {
    const result = configSchema.safeParse({
      ...validConfig,
      NODE_ENV: "production",
      METRICS_API_KEY: "m".repeat(32),
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ["JWT_SECRET"] }),
      ]),
    );
  });

  it("requires a strong metrics API key in production", () => {
    const result = configSchema.safeParse({
      ...validConfig,
      NODE_ENV: "production",
      JWT_SECRET: "j".repeat(32),
      METRICS_API_KEY: "short",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ["METRICS_API_KEY"] }),
      ]),
    );
  });

  it("accepts strong production JWT and metrics secrets", () => {
    expect(
      configSchema.safeParse({
        ...validConfig,
        NODE_ENV: "production",
        JWT_SECRET: "j".repeat(32),
        METRICS_API_KEY: "m".repeat(32),
      }).success,
    ).toBe(true);
  });
});
