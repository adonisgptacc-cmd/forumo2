import { validate } from "class-validator";

import { RecoverOAuthAccountConfirmDto } from "./recover-oauth-account-confirm.dto";

describe("RecoverOAuthAccountConfirmDto", () => {
  const base = {
    email: "zuri@example.com",
    code: "555666",
  };

  it("rejects a weak newPassword before it ever reaches the service layer", async () => {
    const dto = Object.assign(new RecoverOAuthAccountConfirmDto(), {
      ...base,
      newPassword: "short",
    });

    const errors = await validate(dto);

    const newPasswordError = errors.find((e) => e.property === "newPassword");
    expect(newPasswordError).toBeDefined();
    expect(
      Object.values(newPasswordError?.constraints ?? {}).some((message) =>
        /upper and lower case letters, a number and a special character/.test(
          message,
        ),
      ),
    ).toBe(true);
  });

  it("accepts a newPassword that meets the complexity rule", async () => {
    const dto = Object.assign(new RecoverOAuthAccountConfirmDto(), {
      ...base,
      newPassword: "NewHunter2!Aa",
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === "newPassword")).toBe(false);
  });
});
