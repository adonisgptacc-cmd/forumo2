import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SkipTosCheck } from "../../common/decorators/skip-tos-check.decorator";
import { LegalService } from "./legal.service";
import type { Request as ExpressRequest } from "express";

@Controller("legal")
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  @Post("accept-tos")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @SkipTosCheck()
  acceptTos(
    @Req()
    req: ExpressRequest &
      Record<string, unknown> & { user: { id: string; role: string } },
    @Body() body: { version: string },
  ) {
    return this.legalService.acceptTos(
      req.user.id,
      body.version,
      req.ip ?? null,
      req.headers?.["user-agent"] ?? null,
    );
  }

  @Post("delete-account")
  @UseGuards(JwtAuthGuard)
  initiateAccountDeletion(
    @Req()
    req: ExpressRequest &
      Record<string, unknown> & { user: { id: string; role: string } },
  ) {
    return this.legalService.initiateAccountDeletion(req.user.id);
  }

  @Post("cancel-deletion")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  cancelDeletion(
    @Req()
    req: ExpressRequest &
      Record<string, unknown> & { user: { id: string; role: string } },
  ) {
    return this.legalService.cancelDeletion(req.user.id);
  }

  @Get("data-export")
  @UseGuards(JwtAuthGuard)
  @SkipTosCheck()
  exportData(
    @Req()
    req: ExpressRequest &
      Record<string, unknown> & { user: { id: string; role: string } },
  ) {
    return this.legalService.exportData(req.user.id);
  }
}
