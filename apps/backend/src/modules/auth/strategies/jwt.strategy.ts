import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';

import { UsersService } from "../../users/users.service";
import { SafeUser } from "../../users/user.serializer";
import { assertAccountActive } from "../../../common/guards/account-status.guard";

export interface JwtPayload {
  sub: string;
  role: string;
  tokenVersion: number;
  twoFactorPending?: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload): Promise<SafeUser> {
    const user = await this.usersService.findById(payload.sub);
    if (user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Session expired');
    }
    if (payload.twoFactorPending) {
      throw new UnauthorizedException('2FA verification required');
    }
    assertAccountActive(user, req);
    return user;
  }
}
