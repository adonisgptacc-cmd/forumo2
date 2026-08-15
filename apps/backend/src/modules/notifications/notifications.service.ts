import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { MailtrapClient } from 'mailtrap';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationChannel } from '@prisma/client';

/** Escape HTML special characters to prevent XSS in email templates. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly snsClient?: SNSClient;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const region = config.get<string>('SNS_REGION');
    const accessKeyId = config.get<string>('SNS_ACCESS_KEY_ID');
    const secretAccessKey = config.get<string>('SNS_SECRET_ACCESS_KEY');
    if (region && accessKeyId && secretAccessKey) {
      this.snsClient = new SNSClient({ region, credentials: { accessKeyId, secretAccessKey } });
    }
  }

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    const token = this.config.get<string>('MAILTRAP_API_TOKEN');

    if (!token) {
      this.logger.warn(`[EMAIL SKIPPED] Mailtrap not configured. To=${to} Subject="${subject}"`);
      return;
    }

    const client = new MailtrapClient({ token });

    try {
      await client.send({
        from: { email: 'hello@demomailtrap.co', name: 'Forumo' },
        to: [{ email: to }],
        subject,
        html,
      });
      this.logger.log(`Email sent to ${to}: "${subject}"`);
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}: ${(err as Error).message}`);
    }
  }

  async sendSms(phoneNumber: string, message: string): Promise<void> {
    if (!this.snsClient) {
      this.logger.warn(`[SMS SKIPPED] SNS not configured. To=${phoneNumber}`);
      return;
    }

    const senderId = this.config.get<string>('SNS_SMS_SENDER_ID') ?? 'Forumo';

    try {
      await this.snsClient.send(
        new PublishCommand({
          Message: message,
          PhoneNumber: phoneNumber,
          MessageAttributes: {
            'AWS.SNS.SMS.SenderID': { DataType: 'String', StringValue: senderId },
            'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
          },
        }),
      );
      this.logger.log(`SMS sent to ${phoneNumber}`);
    } catch (err) {
      this.logger.error(`Failed to send SMS to ${phoneNumber}: ${(err as Error).message}`);
    }
  }

  async sendVerificationEmail(toEmail: string, toName: string, verificationLink: string): Promise<void> {
    const html = `<p>Hi ${escapeHtml(toName)},</p>
<p>Thanks for signing up to Forumo. Please verify your email address by clicking the link below:</p>
<p><a href="${escapeHtml(verificationLink)}">Verify my email</a></p>
<p>This link expires in 24 hours. If you did not create an account, you can safely ignore this email.</p>`;
    await this.sendEmail(toEmail, 'Verify your Forumo email address', html);
  }

  async notifyKycDecision(
    toEmail: string,
    toName: string,
    decision: 'APPROVED' | 'REJECTED',
    reason?: string | null,
  ): Promise<void> {
    const approved = decision === 'APPROVED';
    const subject = approved
      ? 'Your identity verification was approved'
      : 'Your identity verification was not approved';
    const html = approved
      ? `<p>Hi ${escapeHtml(toName)},</p><p>Your identity verification has been approved. You can now start selling on Forumo.</p>`
      : `<p>Hi ${escapeHtml(toName)},</p><p>Unfortunately your identity verification was not approved.${reason ? ` Reason: <em>${escapeHtml(reason)}</em>` : ''}</p><p>Please resubmit with the correct documents.</p>`;
    await this.sendEmail(toEmail, subject, html);
  }

  async notifyAuctionWon(
    toEmail: string,
    toName: string,
    orderId: string,
    itemTitle: string,
    amountCents: number,
    currency: string,
  ): Promise<void> {
    const amount = (amountCents / 100).toFixed(2);
    const html = `<p>Hi ${escapeHtml(toName)},</p><p>Congratulations — you won the auction for <strong>${escapeHtml(itemTitle)}</strong> at ${escapeHtml(currency)} ${amount}.</p><p>Please complete your payment. Order reference: <strong>${escapeHtml(orderId)}</strong>.</p>`;
    await this.sendEmail(toEmail, `You won: ${itemTitle}`, html);
  }

  async notifyAuctionSold(
    toEmail: string,
    toName: string,
    orderId: string,
    itemTitle: string,
    amountCents: number,
    currency: string,
  ): Promise<void> {
    const amount = (amountCents / 100).toFixed(2);
    const html = `<p>Hi ${escapeHtml(toName)},</p><p>Your auction for <strong>${escapeHtml(itemTitle)}</strong> has sold for ${escapeHtml(currency)} ${amount}.</p><p>Order reference: <strong>${escapeHtml(orderId)}</strong>. Funds are held in escrow until delivery is confirmed.</p>`;
    await this.sendEmail(toEmail, `Auction sold: ${itemTitle}`, html);
  }

  async notifyEscrowReleased(
    sellerEmail: string,
    sellerName: string,
    orderId: string,
    amountCents: number,
    currency: string,
  ): Promise<void> {
    const amount = (amountCents / 100).toFixed(2);
    const html = `<p>Hi ${escapeHtml(sellerName)},</p><p>The escrow for order <strong>${escapeHtml(orderId)}</strong> has been released. ${escapeHtml(currency)} ${amount} will be transferred to your account shortly.</p>`;
    await this.sendEmail(sellerEmail, `Payment released — Order ${orderId}`, html);
  }

  async notifyEscrowRefunded(
    buyerEmail: string,
    buyerName: string,
    orderId: string,
    amountCents: number,
    currency: string,
  ): Promise<void> {
    const amount = (amountCents / 100).toFixed(2);
    const html = `<p>Hi ${escapeHtml(buyerName)},</p><p>The escrow for order <strong>${escapeHtml(orderId)}</strong> has been refunded. ${escapeHtml(currency)} ${amount} will be returned to your original payment method shortly.</p>`;
    await this.sendEmail(buyerEmail, `Refund processed — Order ${orderId}`, html);
  }

  async notifyAccountSuspended(
    toEmail: string,
    toName: string,
    reason: string,
    suspendedUntil: Date | null,
  ): Promise<void> {
    const duration = suspendedUntil
      ? `until ${suspendedUntil.toUTCString()}`
      : 'indefinitely';
    const html = `<p>Hi ${escapeHtml(toName)},</p><p>Your Forumo account has been suspended ${duration}.</p><p>Reason: <em>${escapeHtml(reason)}</em></p><p>If you believe this is an error, please <a href="https://forumo.app/appeal">submit an appeal</a>.</p>`;
    await this.sendEmail(toEmail, 'Your account has been suspended', html);
  }

  async notifyAccountUnsuspended(toEmail: string, toName: string): Promise<void> {
    const html = `<p>Hi ${escapeHtml(toName)},</p><p>Your Forumo account suspension has been lifted. You can now log in and resume activity.</p>`;
    await this.sendEmail(toEmail, 'Your account suspension has been lifted', html);
  }

  async notifyAccountBanned(toEmail: string, toName: string, reason: string): Promise<void> {
    const html = `<p>Hi ${escapeHtml(toName)},</p><p>Your Forumo account has been permanently banned.</p><p>Reason: <em>${escapeHtml(reason)}</em></p><p>If you believe this is an error, please contact <a href="mailto:support@forumo.app">support@forumo.app</a>.</p>`;
    await this.sendEmail(toEmail, 'Your account has been banned', html);
  }

  async notifyDisputeOpened(orderId: string, disputeId: string, reason: string): Promise<void> {
    const adminEmail = this.config.get<string>('ADMIN_NOTIFICATION_EMAIL');
    if (!adminEmail) {
      this.logger.warn(
        `[NOTIFICATION SKIPPED] ADMIN_NOTIFICATION_EMAIL not set. Dispute ${disputeId} on order ${orderId} requires review.`,
      );
      return;
    }
    const html = `<p>A new dispute has been opened and requires your review.</p><ul><li>Order: <strong>${escapeHtml(orderId)}</strong></li><li>Dispute ID: <strong>${escapeHtml(disputeId)}</strong></li><li>Reason: ${escapeHtml(reason)}</li></ul>`;
    await this.sendEmail(adminEmail, `New dispute opened — Order ${orderId}`, html);
  }

  // ─── IN-APP Notification CRUD ────────────────────────────────────────────────

  async createInApp(userId: string, template: string, payload: Record<string, unknown>) {
    return this.prisma.notification.create({
      data: {
        userId,
        channel: NotificationChannel.IN_APP,
        template,
        payload: payload as any,
        status: 'SENT',
        sentAt: new Date(),
      },
    });
  }

  async findByUser(userId: string, limit = 30) {
    return this.prisma.notification.findMany({
      where: { userId, channel: NotificationChannel.IN_APP },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, channel: NotificationChannel.IN_APP, readAt: null },
    });
  }

  async markAsRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date(), status: 'READ' },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, channel: NotificationChannel.IN_APP, readAt: null },
      data: { readAt: new Date(), status: 'READ' },
    });
  }
}
