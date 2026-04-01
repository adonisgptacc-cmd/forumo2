import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';

import { Roles } from "../../common/decorators/roles.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdminService } from "./admin.service";
import type { AdminDisputeSummary, AdminKycSubmission, AdminListingModeration, AdminUserDetail, AdminOrderSummary } from '@forumo/shared';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard/stats')
  getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

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

  @Patch('kyc/submissions/:id')
  reviewKycSubmission(
    @Param('id') id: string,
    @Body() body: { status: 'APPROVED' | 'REJECTED'; rejectionReason?: string | null },
  ): Promise<AdminKycSubmission> {
    return this.adminService.reviewKycSubmission(id, body);
  }

  @Patch('moderations/listings/:id')
  reviewListing(
    @Param('id') id: string,
    @Body() body: { moderationStatus: string; moderationNotes?: string | null },
  ): Promise<AdminListingModeration> {
    return this.adminService.reviewListing(id, body);
  }

  @Patch('disputes/:id')
  resolveDispute(
    @Param('id') id: string,
    @Body() body: { status: string; resolution?: string | null },
  ): Promise<AdminDisputeSummary> {
    return this.adminService.resolveDispute(id, body);
  }

  @Get('users')
  listUsers(): Promise<AdminUserDetail[]> {
    return this.adminService.listUsers();
  }

  @Get('orders')
  listOrders(): Promise<AdminOrderSummary[]> {
    return this.adminService.listOrders();
  }
}
