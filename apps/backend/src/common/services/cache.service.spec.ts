import { CacheService } from "./cache.service";

const CACHE_NAMESPACE = "forumo:cache:v1:";

function createRedisMock() {
  return {
    status: "ready",
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    unlink: jest.fn(),
    scan: jest.fn(),
    connect: jest.fn(),
    quit: jest.fn(),
    disconnect: jest.fn(),
  };
}

describe("CacheService", () => {
  it("shares JSON values through Redis with millisecond expiry", async () => {
    const redis = createRedisMock();
    redis.set.mockResolvedValue("OK");
    redis.get.mockResolvedValue(JSON.stringify({ id: "listing-1" }));
    const cache = new CacheService(redis as never);

    await cache.set("listings:search:all", { id: "listing-1" }, 1_500);

    expect(redis.set).toHaveBeenCalledWith(
      `${CACHE_NAMESPACE}listings:search:all`,
      JSON.stringify({ id: "listing-1" }),
      "PX",
      1_500,
    );
    await expect(cache.get("listings:search:all")).resolves.toEqual({
      id: "listing-1",
    });
  });

  it("removes an exact key and invalidates a prefix without using KEYS", async () => {
    const redis = createRedisMock();
    redis.del.mockResolvedValue(1);
    redis.scan
      .mockResolvedValueOnce([
        "7",
        [
          `${CACHE_NAMESPACE}messages:threads:user-1:a`,
          `${CACHE_NAMESPACE}messages:threads:user-1:b`,
        ],
      ])
      .mockResolvedValueOnce([
        "0",
        [`${CACHE_NAMESPACE}messages:threads:user-1:c`],
      ]);
    redis.unlink.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    const cache = new CacheService(redis as never);

    await expect(cache.delete("one")).resolves.toBe(1);
    await expect(
      cache.deleteByPrefix("messages:threads:user-1:"),
    ).resolves.toBe(3);

    expect(redis.del).toHaveBeenCalledWith(`${CACHE_NAMESPACE}one`);
    expect(redis.scan).toHaveBeenCalledWith(
      "0",
      "MATCH",
      `${CACHE_NAMESPACE}messages:threads:user-1:*`,
      "COUNT",
      100,
    );
    expect(redis.unlink).toHaveBeenNthCalledWith(
      1,
      `${CACHE_NAMESPACE}messages:threads:user-1:a`,
      `${CACHE_NAMESPACE}messages:threads:user-1:b`,
    );
  });

  it("fails open when Redis is unavailable", async () => {
    const redis = createRedisMock();
    redis.get.mockRejectedValue(new Error("connection refused"));
    redis.set.mockRejectedValue(new Error("connection refused"));
    redis.del.mockRejectedValue(new Error("connection refused"));
    redis.scan.mockRejectedValue(new Error("connection refused"));
    const cache = new CacheService(redis as never);

    await expect(cache.get("key")).resolves.toBeUndefined();
    await expect(
      cache.set("key", { value: true }, 100),
    ).resolves.toBeUndefined();
    await expect(cache.delete("key")).resolves.toBe(0);
    await expect(cache.deleteByPrefix("key")).resolves.toBe(0);
  });

  it("evicts malformed JSON and treats non-positive TTLs as deletion", async () => {
    const redis = createRedisMock();
    redis.get.mockResolvedValue("{malformed");
    redis.del.mockResolvedValue(1);
    const cache = new CacheService(redis as never);

    await expect(cache.get("broken")).resolves.toBeUndefined();
    expect(redis.del).toHaveBeenCalledWith(`${CACHE_NAMESPACE}broken`);

    await cache.set("expired", { value: true }, 0);
    expect(redis.set).not.toHaveBeenCalled();
    expect(redis.del).toHaveBeenCalledWith(`${CACHE_NAMESPACE}expired`);
  });

  it("closes the shared Redis connection during shutdown", async () => {
    const redis = createRedisMock();
    redis.quit.mockResolvedValue("OK");
    const cache = new CacheService(redis as never);

    await cache.onModuleDestroy();

    expect(redis.quit).toHaveBeenCalledTimes(1);
  });

  it("connects the lazy Redis client during module initialization", async () => {
    const redis = { ...createRedisMock(), status: "wait" };
    redis.connect.mockResolvedValue(undefined);
    const cache = new CacheService(redis as never);

    await cache.onModuleInit();

    expect(redis.connect).toHaveBeenCalledTimes(1);
  });

  it("does not connect an unused lazy Redis client during shutdown", async () => {
    const redis = { ...createRedisMock(), status: "wait" };
    const cache = new CacheService(redis as never);

    await cache.onModuleDestroy();

    expect(redis.disconnect).toHaveBeenCalledTimes(1);
    expect(redis.quit).not.toHaveBeenCalled();
  });
});
