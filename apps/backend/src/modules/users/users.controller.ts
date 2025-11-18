import { Body, Controller, Delete, Get, Param, Patch } from '@nestjs/common';

import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { SafeUser } from './user.serializer.js';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(): Promise<SafeUser[]> {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<SafeUser> {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto): Promise<SafeUser> {
    return this.usersService.update(id, dto);
  }

  @Patch(':id/profile')
  updateProfile(@Param('id') id: string, @Body() dto: UpdateProfileDto): Promise<SafeUser> {
    return this.usersService.updateProfile(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.usersService.softDelete(id);
  }
}
