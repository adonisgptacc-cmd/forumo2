import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../prisma/prisma.service.js';
import { UsersService } from '../users/users.service.js';
import { SafeUser, sanitizeUser } from '../users/user.serializer.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

interface AuthResponse {
  user: SafeUser;
  accessToken: string;
}

@Injectable()
export class AuthService {
  private readonly saltRounds = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const normalizedEmail = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.saltRounds);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: normalizedEmail,
        passwordHash,
        phone: dto.phone,
      },
    });

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthResponse(user);
  }

  async me(userId: string): Promise<AuthResponse> {
    const user = await this.usersService.findById(userId);
    return this.buildAuthResponse(user);
  }

  private async buildAuthResponse(user: SafeUser | { passwordHash: string } & SafeUser): Promise<AuthResponse> {
    const safeUser = sanitizeUser(user)!;
    const secret = this.configService.getOrThrow<string>('JWT_SECRET');
    const ttlValue = Number(this.configService.get<string>('JWT_TTL') ?? 86400);
    const expiresIn = Number.isNaN(ttlValue) ? 86400 : ttlValue;
    const token = await this.jwtService.signAsync(
      { sub: safeUser.id, role: safeUser.role },
      {
        secret,
        expiresIn,
      },
    );
    return { user: safeUser, accessToken: token };
  }
}
