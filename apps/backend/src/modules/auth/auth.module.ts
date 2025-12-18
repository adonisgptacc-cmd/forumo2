import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { PrismaModule } from "../../prisma/prisma.module";
import { UsersModule } from "../users/users.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { OtpDeliveryService } from "./otp-delivery.service";
import { RolesGuard } from "../../common/guards/roles.guard";
import { RateLimitService } from "../../common/services/rate-limit.service";
import { ObservabilityModule } from "../observability/observability.module";

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    UsersModule,
    ObservabilityModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const ttlValue = Number(configService.get<string>('JWT_TTL') ?? 86400);
        const expiresIn = Number.isNaN(ttlValue) ? 86400 : ttlValue;
        return {
          secret: configService.getOrThrow<string>('JWT_SECRET'),
          signOptions: { expiresIn },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, OtpDeliveryService, RolesGuard, RateLimitService],
  exports: [AuthService],
})
export class AuthModule {}
