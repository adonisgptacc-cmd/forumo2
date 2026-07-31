import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("combines conditional class names", () => {
    expect(cn("base", { active: true, disabled: false })).toBe("base active");
  });

  it("keeps the last conflicting Tailwind utility", () => {
    expect(cn("px-2 text-sm", "px-4 text-lg")).toBe("px-4 text-lg");
  });
});
