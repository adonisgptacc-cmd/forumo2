import { Controller, Get, UseGuards } from '@nestjs/common';

import { Roles } from "../../common/decorators/roles.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdminService } from "./admin.service";
import type { AdminDisputeSummary, AdminKycSubmission, AdminListingModeration } from '@forumo/shared';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('kyc/submissions')
  listKycSubmissions(): Promise<AdminKycSubmission[]> {
    return this.adminService.listKycSubmissions();
  }

  @Get('moderations/listings')
  listListingsForReview(): Promise<AdminListingModeration[]> {
    return this.adminService.listListingsForReview();
  }

  @Get('disputes')
  listDisputes(): Promise<AdminDisputeSummary[]> {
    return this.adminService.listDisputes();
  }
}
