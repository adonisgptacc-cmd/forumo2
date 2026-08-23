import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import type { Response } from "express";

@Injectable()
export class GoogleAuthGuard extends AuthGuard("google") {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const activate = (await super.canActivate(context)) as boolean;
    const request = context.switchToHttp().getRequest();
    await super.logIn(request);
    return activate;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Passport's handleRequest signature is generic over the strategy's user type.
  handleRequest<TUser = any>(
    err: unknown,
    user: TUser,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Passport supplies strategy-specific info we don't need to type here.
    info: any,
    context: ExecutionContext,
  ): TUser {
    if (err || !user) {
      // The callback is a full-page browser navigation from Google, not an
      // XHR — a JSON error response here would strand the user on the
      // backend's own origin. Redirect back to a safe web route instead.
      const response = context.switchToHttp().getResponse<Response>();
      const frontendUrl =
        this.configService.get<string>("FRONTEND_URL") ||
        "http://localhost:3000";
      response.redirect(`${frontendUrl}/login?error=oauth_failed`);
      throw new UnauthorizedException("Google authentication failed");
    }
    return user;
  }
}
