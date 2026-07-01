import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

export interface TwoFactorPendingPayload {
  sub: string;
  twoFactorPending: true;
  twoFactorSetupRequired?: boolean;
}

@Injectable()
export class TwoFactorPendingGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const auth: string | undefined = req.headers?.['authorization'];
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Missing 2FA token');

    const token = auth.slice(7);
    const secret = this.configService.getOrThrow<string>('JWT_SECRET');

    let payload: TwoFactorPendingPayload;
    try {
      payload = await this.jwtService.verifyAsync<TwoFactorPendingPayload>(token, { secret });
    } catch {
      throw new UnauthorizedException('Invalid or expired 2FA token');
    }

    if (!payload.twoFactorPending) {
      throw new UnauthorizedException('Not a 2FA pending token');
    }

    req.twoFactorUserId = payload.sub;
    req.twoFactorSetupRequired = payload.twoFactorSetupRequired ?? false;
    return true;
  }
}
