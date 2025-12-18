import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel, User } from '@prisma/client';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { randomUUID } from 'crypto';

import { RequestOtpDto } from "./dto/request-otp.dto";

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
  private readonly snsClient?: SNSClient;
  private readonly mailgunConfig?: { apiKey: string; domain: string; from: string; apiBase: string };

  constructor(private readonly configService: ConfigService) {
    if (this.hasMailgunConfig()) {
      this.mailgunConfig = {
        apiKey: this.configService.getOrThrow('MAILGUN_API_KEY'),
        domain: this.configService.getOrThrow('MAILGUN_DOMAIN'),
        from: this.configService.get<string>('MAILGUN_EMAIL_FROM') ?? 'no-reply@forumo.dev',
        apiBase: this.configService.get<string>('MAILGUN_API_BASE') ?? 'https://api.mailgun.net',
      };
    }

    if (this.hasSnsConfig()) {
      this.snsClient = new SNSClient({
        region: this.configService.getOrThrow('SNS_REGION'),
        credentials: {
          accessKeyId: this.configService.getOrThrow('SNS_ACCESS_KEY_ID'),
          secretAccessKey: this.configService.getOrThrow('SNS_SECRET_ACCESS_KEY'),
        },
      });
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
    if (this.mailgunConfig) {
      const body = new URLSearchParams({
        from: this.mailgunConfig.from,
        to: recipient,
        subject: 'Your one-time passcode',
        text: `Your Forumo verification code is ${code}. It will expire soon.`,
      });

      try {
        const response = await fetch(`${this.mailgunConfig.apiBase}/v3/${this.mailgunConfig.domain}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`api:${this.mailgunConfig.apiKey}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body,
        });

        if (!response.ok) {
          const message = await response.text();
          this.logger.warn(`Mailgun delivery failed: ${message || response.statusText}`);
          return this.simulateDelivery(NotificationChannel.EMAIL, recipient, code);
        }

        const payload = (await response.json()) as { id?: string; message?: string };

        return {
          channel: NotificationChannel.EMAIL,
          provider: 'mailgun',
          referenceId: payload.id,
          deliveredAt: new Date(),
          metadata: { message: payload.message },
        };
      } catch (error) {
        this.logger.error(`Mailgun delivery threw: ${(error as Error).message}`);
        return this.simulateDelivery(NotificationChannel.EMAIL, recipient, code);
      }
    }

    this.logger.debug(`Mailgun credentials missing, simulating email delivery to ${recipient}`);
    return this.simulateDelivery(NotificationChannel.EMAIL, recipient, code);
  }

  private async sendSms(recipient: string, code: string): Promise<OtpDeliveryResult> {
    if (this.snsClient) {
      const senderId = this.configService.get<string>('SNS_SMS_SENDER_ID');
      const command = new PublishCommand({
        Message: `Your Forumo verification code is ${code}`,
        PhoneNumber: recipient,
        ...(senderId
          ? {
              MessageAttributes: {
                'AWS.SNS.SMS.SenderID': { DataType: 'String', StringValue: senderId },
              },
            }
          : {}),
      });

      try {
        const result = await this.snsClient.send(command);

        return {
          channel: NotificationChannel.SMS,
          provider: 'sns',
          referenceId: result.MessageId,
          deliveredAt: new Date(),
          metadata: {
            messageId: result.MessageId,
          },
        };
      } catch (error) {
        this.logger.error(`SNS delivery threw: ${(error as Error).message}`);
        return this.simulateDelivery(NotificationChannel.SMS, recipient, code);
      }
    }

    this.logger.debug(`SNS credentials missing, simulating SMS delivery to ${recipient}`);
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

  private hasMailgunConfig(): boolean {
    return Boolean(this.configService.get<string>('MAILGUN_API_KEY') && this.configService.get<string>('MAILGUN_DOMAIN'));
  }

  private hasSnsConfig(): boolean {
    return Boolean(
      this.configService.get<string>('SNS_REGION') &&
        this.configService.get<string>('SNS_ACCESS_KEY_ID') &&
        this.configService.get<string>('SNS_SECRET_ACCESS_KEY'),
    );
  }
}
