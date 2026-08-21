import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { Observable } from "rxjs";
import { SKIP_TOS_CHECK } from "../decorators/skip-tos-check.decorator";

@Injectable()
export class TosInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TOS_CHECK, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return next.handle();

    const req = context.switchToHttp().getRequest<{
      user?: { termsAcceptedAt?: Date | null; tosVersion?: string | null };
    }>();
    const user = req.user;
    if (!user) return next.handle();

    const currentVersion =
      this.config.get<string>("TOS_VERSION") ?? "2024-01-01";
    if (!user.termsAcceptedAt || user.tosVersion !== currentVersion) {
      throw new ForbiddenException({
        code: "TOS_REQUIRED",
        message: "You must accept the Terms of Service to continue",
      });
    }

    return next.handle();
  }
}
