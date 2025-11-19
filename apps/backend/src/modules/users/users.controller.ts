import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { CreateTrustSeedDto } from './dto/create-trust-seed.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { SafeUser } from './user.serializer.js';
import { UsersService, UserProfileResponse } from './users.service.js';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  findAll(): Promise<SafeUser[]> {
    return this.usersService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  findOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<SafeUser> {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateUserDto): Promise<SafeUser> {
    return this.usersService.update(id, dto);
  }

  @Patch(':id/profile')
  @Roles(UserRole.ADMIN)
  updateProfile(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateProfileDto): Promise<SafeUser> {
    return this.usersService.updateProfile(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    return this.usersService.softDelete(id);
  }

  @Get('me/profile')
  getOwnProfile(@Req() req: any): Promise<UserProfileResponse> {
    return this.usersService.getProfile(req.user.id);
  }

  @Patch('me/profile')
  updateOwnProfile(@Req() req: any, @Body() dto: UpdateProfileDto): Promise<SafeUser> {
    return this.usersService.updateProfile(req.user.id, dto);
  }

  @Delete('me/avatar')
  deleteOwnAvatar(@Req() req: any): Promise<SafeUser> {
    return this.usersService.removeAvatar(req.user.id);
  }

  @Get(':id/trust-seeds')
  @Roles(UserRole.ADMIN)
  listTrustSeeds(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.usersService.listTrustSeeds(id);
  }

  @Post(':id/trust-seeds')
  @Roles(UserRole.ADMIN)
  createTrustSeed(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateTrustSeedDto,
    @Req() req: any,
  ) {
    return this.usersService.createTrustSeed(id, dto, req.user.id);
  }

  @Delete(':id/trust-seeds/:seedId')
  @Roles(UserRole.ADMIN)
  deleteTrustSeed(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('seedId', new ParseUUIDPipe()) seedId: string,
  ) {
    return this.usersService.deleteTrustSeed(id, seedId);
  }
}
