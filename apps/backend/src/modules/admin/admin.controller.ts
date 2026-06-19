import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { Roles } from "../../common/decorators/roles.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdminService } from "./admin.service";
import { OrdersService } from "../orders/orders.service";
import type { AdminDisputeSummary, AdminKycSubmission, AdminListingModeration, AdminUserDetail, AdminOrderSummary } from '@forumo/shared';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly ordersService: OrdersService,
  ) {}

  @Get('dashboard/stats')
  getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('dashboard/analytics')
  getAnalytics() {
    return this.adminService.getAnalytics();
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
  listUsers(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('role') role?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<AdminUserDetail[]> {
    return this.adminService.listUsers({
      search,
      status,
      role,
      page: page != null ? Number(page) : undefined,
      limit: limit != null ? Number(limit) : undefined,
    });
  }

  @Get('orders')
  listOrders(): Promise<AdminOrderSummary[]> {
    return this.adminService.listOrders();
  }

  @Get('orders/:id')
  getOrder(@Param('id') id: string) {
    // No userId param → skips ownership check, admin can view any order
    return this.ordersService.findById(id);
  }

  // ─── Account Status ───────────────────────────────────────────────────────

  @Post('users/:id/suspend')
  @HttpCode(HttpStatus.NO_CONTENT)
  suspendUser(
    @Param('id') id: string,
    @Body() body: { reason: string; durationDays?: number | null },
  ): Promise<void> {
    return this.adminService.suspendUser(id, body.reason, body.durationDays ?? null);
  }

  @Post('users/:id/unsuspend')
  @HttpCode(HttpStatus.NO_CONTENT)
  unsuspendUser(@Param('id') id: string): Promise<void> {
    return this.adminService.unsuspendUser(id);
  }

  @Post('users/:id/ban')
  @HttpCode(HttpStatus.NO_CONTENT)
  banUser(
    @Param('id') id: string,
    @Body() body: { reason: string },
  ): Promise<void> {
    return this.adminService.banUser(id, body.reason);
  }
}
