import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @Throttle({ "notifications-list": {} })
  list(@Request() req: { user: { id: string } }) {
    return this.notifications.findByUser(req.user.id);
  }

  @Get("unread-count")
  @Throttle({ "notifications-list": {} })
  unreadCount(@Request() req: { user: { id: string } }) {
    return this.notifications
      .getUnreadCount(req.user.id)
      .then((count) => ({ count }));
  }

  @Patch(":id/read")
  @Throttle({ "notifications-mark": {} })
  markRead(@Param("id") id: string, @Request() req: { user: { id: string } }) {
    return this.notifications.markAsRead(id, req.user.id);
  }

  @Post("mark-all-read")
  @Throttle({ "notifications-mark": {} })
  markAllRead(@Request() req: { user: { id: string } }) {
    return this.notifications.markAllAsRead(req.user.id);
  }
}
