import type { ExecutionContext } from "@nestjs/common";
import { UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";

import { GoogleAuthGuard } from "./google-auth.guard";

describe("GoogleAuthGuard.handleRequest", () => {
  const buildContext = (redirect: jest.Mock): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getResponse: () => ({ redirect }),
        getRequest: () => ({}),
      }),
    }) as unknown as ExecutionContext;

  const configServiceWithFrontendUrl = (
    frontendUrl: string | undefined,
  ): ConfigService =>
    ({
      get: (key: string) => (key === "FRONTEND_URL" ? frontendUrl : undefined),
    }) as unknown as ConfigService;

  it("redirects to the web login page with an error flag when authentication fails", () => {
    const redirect = jest.fn();
    const guard = new GoogleAuthGuard(
      configServiceWithFrontendUrl("https://forumo.example"),
    );

    expect(() =>
      guard.handleRequest(
        new Error("boom"),
        null,
        undefined,
        buildContext(redirect),
      ),
    ).toThrow(UnauthorizedException);

    expect(redirect).toHaveBeenCalledWith(
      "https://forumo.example/login?error=oauth_failed",
    );
  });

  it("redirects the same way when Google returns no error but also no user (cancellation)", () => {
    const redirect = jest.fn();
    const guard = new GoogleAuthGuard(
      configServiceWithFrontendUrl("https://forumo.example"),
    );

    expect(() =>
      guard.handleRequest(
        null,
        null,
        { message: "cancelled" },
        buildContext(redirect),
      ),
    ).toThrow(UnauthorizedException);

    expect(redirect).toHaveBeenCalledWith(
      "https://forumo.example/login?error=oauth_failed",
    );
  });

  it("falls back to localhost:3000 when FRONTEND_URL is not configured", () => {
    const redirect = jest.fn();
    const guard = new GoogleAuthGuard(configServiceWithFrontendUrl(undefined));

    expect(() =>
      guard.handleRequest(
        new Error("boom"),
        null,
        undefined,
        buildContext(redirect),
      ),
    ).toThrow(UnauthorizedException);

    expect(redirect).toHaveBeenCalledWith(
      "http://localhost:3000/login?error=oauth_failed",
    );
  });

  it("returns the authenticated user without redirecting on success", () => {
    const redirect = jest.fn();
    const guard = new GoogleAuthGuard(configServiceWithFrontendUrl(undefined));
    const user = { id: "user-1" };

    expect(
      guard.handleRequest(null, user, undefined, buildContext(redirect)),
    ).toBe(user);
    expect(redirect).not.toHaveBeenCalled();
  });
});
