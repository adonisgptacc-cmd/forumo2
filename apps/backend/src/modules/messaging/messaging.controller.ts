import type { Express } from 'express';
import { Body, Controller, Get, Param, Post, Query, Request, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

import { CreateThreadDto } from "./dto/create-thread.dto";
import { SendMessageDto } from "./dto/send-message.dto";
import { ThreadQueryDto } from "./dto/thread-query.dto";
import { SafeMessageThread } from "./message.serializer";
import { MessagingService } from "./messaging.service";

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get('threads')
  listThreads(
    @Query() query: ThreadQueryDto,
    @Request() req: { user: { id: string } },
  ): Promise<{ data: SafeMessageThread[]; total: number; page: number; pageSize: number; pageCount: number }> {
    return this.messagingService.listThreads(query, req.user.id);
  }

  @Get('threads/:id')
  getThread(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ): Promise<SafeMessageThread> {
    return this.messagingService.getThread(id, req.user.id);
  }

  @Post('threads')
  createThread(
    @Body() dto: CreateThreadDto,
    @Request() req: { user: { id: string } },
  ): Promise<SafeMessageThread> {
    return this.messagingService.createThread(dto, req.user.id);
  }

  @Post('threads/:id/messages')
  @UseInterceptors(FilesInterceptor('attachments'))
  sendMessage(
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @Request() req: { user: { id: string } },
    @UploadedFiles() attachments?: Express.Multer.File[],
  ): Promise<SafeMessageThread> {
    return this.messagingService.addMessage(id, { ...dto, authorId: req.user.id }, attachments ?? []);
  }
}
