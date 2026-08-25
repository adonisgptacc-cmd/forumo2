import { validate } from "class-validator";

import { RegisterDto } from "../dto/register.dto";

describe("AtLeastOneIdentifierConstraint (via RegisterDto)", () => {
  const base = { name: "Zuri", password: "hunter2!Aa" };

  it("rejects a registration with neither email nor phone", async () => {
    const dto = Object.assign(new RegisterDto(), base);
    const errors = await validate(dto);
    expect(errors.some((e) => e.constraints?.atLeastOneIdentifier)).toBe(
      true,
    );
  });

  it("accepts email only", async () => {
    const dto = Object.assign(new RegisterDto(), {
      ...base,
      email: "zuri@example.com",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.constraints?.atLeastOneIdentifier)).toBe(
      false,
    );
  });

  it("accepts phone only", async () => {
    const dto = Object.assign(new RegisterDto(), {
      ...base,
      phone: "+27821234567",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.constraints?.atLeastOneIdentifier)).toBe(
      false,
    );
  });

  it("accepts both", async () => {
    const dto = Object.assign(new RegisterDto(), {
      ...base,
      email: "zuri@example.com",
      phone: "+27821234567",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.constraints?.atLeastOneIdentifier)).toBe(
      false,
    );
  });
});
