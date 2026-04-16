import { Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { RateLimitService } from '../../common/services/rate-limit.service';

// Allow 60 list/unread-count calls per user per minute
const LIST_LIMIT = 60;
const LIST_WINDOW_MS = 60_000;
// Allow 30 mark-read actions per user per minute
const MARK_LIMIT = 30;
const MARK_WINDOW_MS = 60_000;

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly rateLimit: RateLimitService,
  ) {}

  @Get()
  list(@Request() req: { user: { id: string } }) {
    this.rateLimit.enforce(`notif:list:${req.user.id}`, LIST_LIMIT, LIST_WINDOW_MS);
    return this.notifications.findByUser(req.user.id);
  }

  @Get('unread-count')
  unreadCount(@Request() req: { user: { id: string } }) {
    this.rateLimit.enforce(`notif:unread:${req.user.id}`, LIST_LIMIT, LIST_WINDOW_MS);
    return this.notifications.getUnreadCount(req.user.id).then((count) => ({ count }));
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @Request() req: { user: { id: string } }) {
    this.rateLimit.enforce(`notif:mark:${req.user.id}`, MARK_LIMIT, MARK_WINDOW_MS);
    return this.notifications.markAsRead(id, req.user.id);
  }

  @Post('mark-all-read')
  markAllRead(@Request() req: { user: { id: string } }) {
    this.rateLimit.enforce(`notif:mark:${req.user.id}`, MARK_LIMIT, MARK_WINDOW_MS);
    return this.notifications.markAllAsRead(req.user.id);
  }
}
