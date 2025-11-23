import type { Express } from 'express';
import { Body, Controller, Get, Param, Post, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';

import { CreateThreadDto } from './dto/create-thread.dto.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import { ThreadQueryDto } from './dto/thread-query.dto.js';
import { SafeMessageThread } from './message.serializer.js';
import { MessagingService } from './messaging.service.js';

@Controller('messages')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get('threads')
  listThreads(
    @Query() query: ThreadQueryDto,
  ): Promise<{ data: SafeMessageThread[]; total: number; page: number; pageSize: number; pageCount: number }> {
    return this.messagingService.listThreads(query);
  }

  @Get('threads/:id')
  getThread(@Param('id') id: string): Promise<SafeMessageThread> {
    return this.messagingService.getThread(id);
  }

  @Post('threads')
  createThread(@Body() dto: CreateThreadDto): Promise<SafeMessageThread> {
    return this.messagingService.createThread(dto);
  }

  @Post('threads/:id/messages')
  @UseInterceptors(FilesInterceptor('attachments'))
  sendMessage(
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @UploadedFiles() attachments?: Express.Multer.File[],
  ): Promise<SafeMessageThread> {
    return this.messagingService.addMessage(id, dto, attachments ?? []);
  }
}
