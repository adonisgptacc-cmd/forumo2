import "reflect-metadata";
import type { ExecutionContext } from "@nestjs/common";
import { Controller, Get } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { skipUnlessOptedIn } from "./throttle-opt-in";

class Plain {
  @Get()
  index() {}

  @Throttle({ "auth-resend": {} })
  @Get()
  resend() {}
}

@Throttle({ payments: {} })
@Controller()
class ClassLevel {
  @Get()
  index() {}
}

const ctx = (cls: any, method: string) =>
  ({
    getClass: () => cls,
    getHandler: () => cls.prototype[method],
  }) as unknown as ExecutionContext;

describe("skipUnlessOptedIn", () => {
  it("skips a named throttler on routes that did not opt in", () => {
    expect(skipUnlessOptedIn("auth-resend")(ctx(Plain, "index"))).toBe(true);
  });

  it("applies it on a handler that opted in", () => {
    expect(skipUnlessOptedIn("auth-resend")(ctx(Plain, "resend"))).toBe(false);
  });

  it("does not apply other named throttlers to that handler", () => {
    expect(skipUnlessOptedIn("auth-login")(ctx(Plain, "resend"))).toBe(true);
  });

  it("applies a class-level opt-in to its handlers", () => {
    expect(skipUnlessOptedIn("payments")(ctx(ClassLevel, "index"))).toBe(false);
  });
});
