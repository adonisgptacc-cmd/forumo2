import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { SafeUser, sanitizeUser } from './user.serializer.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<SafeUser[]> {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return users.map((user) => sanitizeUser(user)!);
  }

  async findById(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return sanitizeUser(user)!;
  }

  async update(id: string, dto: UpdateUserDto): Promise<SafeUser> {
    await this.ensureExists(id);
    const updated = await this.prisma.user.update({
      where: { id },
      data: dto,
    });
    return sanitizeUser(updated)!;
  }

  async softDelete(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!exists) {
      throw new NotFoundException('User not found');
    }
  }
}
