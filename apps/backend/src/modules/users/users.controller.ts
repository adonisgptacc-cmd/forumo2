import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { SafeUser } from "@forumo/shared";

import {
  CreateTrustSeedDto,
  UpdateProfileDto,
  UpdateUserDto,
} from "../../common/dtos/users.dto";
import { UsersService, UserProfileResponse } from "./users.service";
import type { Request as ExpressRequest } from "express";

@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ── "me" routes must come before ":id" routes to prevent ParseUUIDPipe collision ──

  @Get("me/profile")
  getOwnProfile(
    @Req()
    req: ExpressRequest &
      Record<string, unknown> & { user: { id: string; role: string } },
  ): Promise<UserProfileResponse> {
    return this.usersService.getProfile(req.user.id);
  }

  @Patch("me/profile")
  updateOwnProfile(
    @Req()
    req: ExpressRequest &
      Record<string, unknown> & { user: { id: string; role: string } },
    @Body() dto: UpdateProfileDto,
  ): Promise<SafeUser> {
    return this.usersService.updateProfile(req.user.id, dto);
  }

  @Delete("me/avatar")
  deleteOwnAvatar(
    @Req()
    req: ExpressRequest &
      Record<string, unknown> & { user: { id: string; role: string } },
  ): Promise<SafeUser> {
    return this.usersService.removeAvatar(req.user.id);
  }

  @Get("me/export")
  exportMyData(
    @Req()
    req: ExpressRequest &
      Record<string, unknown> & { user: { id: string; role: string } },
  ) {
    return this.usersService.exportUserData(req.user.id);
  }

  @Post("me/accept-terms")
  @HttpCode(HttpStatus.NO_CONTENT)
  acceptTerms(
    @Req()
    req: ExpressRequest &
      Record<string, unknown> & { user: { id: string; role: string } },
  ) {
    return this.usersService.recordConsent(req.user.id);
  }

  @Post("me/become-seller")
  @HttpCode(HttpStatus.OK)
  becomeSeller(
    @Req()
    req: ExpressRequest &
      Record<string, unknown> & { user: { id: string; role: string } },
  ): Promise<SafeUser> {
    return this.usersService.becomeSeller(req.user.id);
  }

  @Get("me/addresses")
  listAddresses(
    @Req()
    req: ExpressRequest &
      Record<string, unknown> & { user: { id: string; role: string } },
  ) {
    return this.usersService.listAddresses(req.user.id);
  }

  @Post("me/addresses")
  createAddress(
    @Req()
    req: ExpressRequest &
      Record<string, unknown> & { user: { id: string; role: string } },
    @Body() body: unknown,
  ) {
    return this.usersService.createAddress(
      req.user.id,
      body as {
        label?: string;
        fullName: string;
        phone?: string;
        line1: string;
        line2?: string;
        city: string;
        state?: string;
        postalCode?: string;
        country: string;
        type?: string;
        isDefault?: boolean;
      },
    );
  }

  @Patch("me/addresses/:id")
  updateAddress(
    @Req()
    req: ExpressRequest &
      Record<string, unknown> & { user: { id: string; role: string } },
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.usersService.updateAddress(
      req.user.id,
      id,
      body as {
        label?: string;
        fullName?: string;
        phone?: string;
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
        isDefault?: boolean;
      },
    );
  }

  @Delete("me/addresses/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteAddress(
    @Req()
    req: ExpressRequest &
      Record<string, unknown> & { user: { id: string; role: string } },
    @Param("id") id: string,
  ) {
    return this.usersService.deleteAddress(req.user.id, id);
  }

  // ── Admin routes ──

  @Get()
  @Roles("ADMIN")
  findAll(): Promise<SafeUser[]> {
    return this.usersService.findAll();
  }

  @Get(":id")
  @Roles("ADMIN")
  findOne(@Param("id", new ParseUUIDPipe()) id: string): Promise<SafeUser> {
    return this.usersService.findById(id);
  }

  @Patch(":id")
  @Roles("ADMIN")
  update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<SafeUser> {
    return this.usersService.update(id, dto);
  }

  @Patch(":id/profile")
  @Roles("ADMIN")
  updateProfile(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<SafeUser> {
    return this.usersService.updateProfile(id, dto);
  }

  @Delete(":id")
  @Roles("ADMIN")
  remove(@Param("id", new ParseUUIDPipe()) id: string): Promise<void> {
    return this.usersService.softDelete(id);
  }

  @Get(":id/trust-seeds")
  @Roles("ADMIN")
  listTrustSeeds(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.usersService.listTrustSeeds(id);
  }

  @Post(":id/trust-seeds")
  @Roles("ADMIN")
  createTrustSeed(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: CreateTrustSeedDto,
    @Req()
    req: ExpressRequest &
      Record<string, unknown> & { user: { id: string; role: string } },
  ) {
    return this.usersService.createTrustSeed(id, dto, req.user.id);
  }

  @Delete(":id/trust-seeds/:seedId")
  @Roles("ADMIN")
  deleteTrustSeed(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("seedId", new ParseUUIDPipe()) seedId: string,
  ) {
    return this.usersService.deleteTrustSeed(id, seedId);
  }
}
