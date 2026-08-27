import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { RegisterDto } from "./register.dto";

// `ValidationPipe({ transform: true })` (set on AuthController) runs
// class-transformer's plainToInstance before class-validator's validate —
// mirror that pipeline here rather than `Object.assign(new RegisterDto(), ...)`,
// which would skip the @Transform() a phone-normalization fix relies on.
const build = (plain: Record<string, unknown>) =>
  plainToInstance(RegisterDto, plain);

describe("RegisterDto phone normalization", () => {
  const base = { name: "Thabo", password: "hunter2!Aa" };

  it("normalizes a South African national-format number to E.164 and passes validation", async () => {
    const dto = build({ ...base, phone: "0821234567" });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === "phone")).toBe(false);
    expect(dto.phone).toBe("+27821234567");
  });

  it("accepts an already-E.164 number unchanged", async () => {
    const dto = build({ ...base, phone: "+27821234567" });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === "phone")).toBe(false);
    expect(dto.phone).toBe("+27821234567");
  });

  it("still rejects a value that isn't a plausible phone number", async () => {
    const dto = build({ ...base, phone: "not-a-phone" });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === "phone")).toBe(true);
  });
});
