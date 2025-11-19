import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel, User } from '@prisma/client';
import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses';
import twilio, { Twilio } from 'twilio';
import { randomUUID } from 'crypto';

import { RequestOtpDto } from './dto/request-otp.dto.js';

export interface OtpDeliveryResult {
  channel: NotificationChannel;
  provider: string;
  referenceId?: string;
  deliveredAt: Date;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class OtpDeliveryService {
  private readonly logger = new Logger(OtpDeliveryService.name);
  private readonly sesClient?: SESClient;
  private readonly twilioClient?: Twilio;

  constructor(private readonly configService: ConfigService) {
    if (this.hasSesConfig()) {
      this.sesClient = new SESClient({
        region: this.configService.getOrThrow('SES_REGION'),
        credentials: {
          accessKeyId: this.configService.getOrThrow('SES_ACCESS_KEY_ID'),
          secretAccessKey: this.configService.getOrThrow('SES_SECRET_ACCESS_KEY'),
        },
      });
    }

    if (this.hasTwilioConfig()) {
      const accountSid = this.configService.getOrThrow('TWILIO_ACCOUNT_SID');
      const authToken = this.configService.getOrThrow('TWILIO_AUTH_TOKEN');
      this.twilioClient = twilio(accountSid, authToken);
    }
  }

  async deliver(user: User, dto: RequestOtpDto, code: string): Promise<OtpDeliveryResult> {
    const explicitChannel = dto.channel;
    const inferredChannel = user.phone ? NotificationChannel.SMS : NotificationChannel.EMAIL;
    const channel = explicitChannel ?? inferredChannel;

    if (channel === NotificationChannel.SMS && user.phone) {
      return this.sendSms(user.phone, code);
    }

    return this.sendEmail(user.email, code);
  }

  private async sendEmail(recipient: string, code: string): Promise<OtpDeliveryResult> {
    if (this.sesClient) {
      const fromAddress = this.configService.get<string>('SES_EMAIL_FROM') ?? 'no-reply@example.com';
      const message = new SendEmailCommand({
        Source: fromAddress,
        Destination: { ToAddresses: [recipient] },
        Message: {
          Subject: { Data: 'Your one-time passcode' },
          Body: {
            Text: { Data: `Your Forumo verification code is ${code}. It will expire soon.` },
          },
        },
      });
      const response = await this.sesClient.send(message);
      return {
        channel: NotificationChannel.EMAIL,
        provider: 'ses',
        referenceId: response.MessageId,
        deliveredAt: new Date(),
        metadata: { messageId: response.MessageId },
      };
    }

    this.logger.debug(`SES credentials missing, simulating email delivery to ${recipient}`);
    return this.simulateDelivery(NotificationChannel.EMAIL, recipient, code);
  }

  private async sendSms(recipient: string, code: string): Promise<OtpDeliveryResult> {
    if (this.twilioClient) {
      const from = this.configService.getOrThrow<string>('TWILIO_FROM_NUMBER');
      const result = await this.twilioClient.messages.create({
        to: recipient,
        from,
        body: `Your Forumo verification code is ${code}`,
      });

      return {
        channel: NotificationChannel.SMS,
        provider: 'twilio',
        referenceId: result.sid,
        deliveredAt: result.dateCreated ? new Date(result.dateCreated) : new Date(),
        metadata: {
          accountSid: result.accountSid,
          status: result.status,
        },
      };
    }

    this.logger.debug(`Twilio credentials missing, simulating SMS delivery to ${recipient}`);
    return this.simulateDelivery(NotificationChannel.SMS, recipient, code);
  }

  private simulateDelivery(channel: NotificationChannel, recipient: string, code: string): OtpDeliveryResult {
    return {
      channel,
      provider: 'dev-simulator',
      referenceId: randomUUID(),
      deliveredAt: new Date(),
      metadata: { recipient, code, simulated: true },
    };
  }

  private hasSesConfig(): boolean {
    return Boolean(
      this.configService.get<string>('SES_REGION') &&
        this.configService.get<string>('SES_ACCESS_KEY_ID') &&
        this.configService.get<string>('SES_SECRET_ACCESS_KEY'),
    );
  }

  private hasTwilioConfig(): boolean {
    return Boolean(
      this.configService.get<string>('TWILIO_ACCOUNT_SID') &&
        this.configService.get<string>('TWILIO_AUTH_TOKEN') &&
        this.configService.get<string>('TWILIO_FROM_NUMBER'),
    );
  }
}
