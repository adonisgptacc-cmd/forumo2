import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LegalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  async acceptTos(userId: string, version: string, ipAddress: string | null, userAgent: string | null): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        termsAcceptedAt: new Date(),
        tosVersion: version,
      },
    });
  }

  async initiateAccountDeletion(userId: string): Promise<{ scheduledAt: Date }> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');
    if (user.deletionScheduledAt) {
      throw new BadRequestException('Account deletion is already scheduled');
    }

    const scheduledAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    await this.prisma.user.update({
      where: { id: userId },
      data: { deletionScheduledAt: scheduledAt },
    });

    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    const cancelUrl = `${frontendUrl}/settings/account?action=cancel-deletion`;
    const deletionDate = scheduledAt.toDateString();

    await this.notifications.sendEmail(
      user.email,
      'Your Forumo account is scheduled for deletion',
      `<p>Hi ${user.name ?? 'there'},</p>
<p>We have received a request to permanently delete your Forumo account.</p>
<p><strong>Your account will be deleted on ${deletionDate}.</strong></p>
<p>The following data will be permanently removed:</p>
<ul>
  <li>Your profile and personal information</li>
  <li>Your listings and storefront</li>
  <li>Your messages and notifications</li>
  <li>Your wishlist and saved items</li>
</ul>
<p>Financial records (orders, transactions) will be anonymised and retained for 7 years as required by law.</p>
<p>If you changed your mind, you can cancel this request within 30 days:</p>
<p><a href="${cancelUrl}">Cancel account deletion</a></p>
<p>If you did not request this, please contact support immediately at support@forumo.app</p>`,
    );

    return { scheduledAt };
  }

  async cancelDeletion(userId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.deletionScheduledAt) {
      throw new BadRequestException('No pending deletion to cancel');
    }
    if (user.deletionScheduledAt < new Date()) {
      throw new BadRequestException('Deletion window has already expired');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { deletionScheduledAt: null },
    });

    await this.notifications.sendEmail(
      user.email,
      'Your account deletion has been cancelled',
      `<p>Hi ${user.name ?? 'there'},</p><p>Your Forumo account deletion request has been successfully cancelled. Your account is now active and nothing will be deleted.</p>`,
    );
  }

  async exportData(userId: string): Promise<Record<string, unknown>> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');

    const [profile, addresses, listings, ordersAsBuyer, ordersAsSeller, reviews, messages, savedListings] =
      await this.prisma.$transaction([
        this.prisma.userProfile.findUnique({ where: { userId } }),
        this.prisma.userAddress.findMany({ where: { userId } }),
        this.prisma.listing.findMany({
          where: { sellerId: userId },
          select: { id: true, title: true, priceCents: true, status: true, createdAt: true },
        }),
        this.prisma.order.findMany({
          where: { buyerId: userId },
          select: { id: true, status: true, totalItemCents: true, createdAt: true },
        }),
        this.prisma.order.findMany({
          where: { sellerId: userId },
          select: { id: true, status: true, totalItemCents: true, createdAt: true },
        }),
        this.prisma.review.findMany({
          where: { reviewerId: userId },
          select: { id: true, rating: true, comment: true, createdAt: true },
        }),
        this.prisma.message.findMany({
          where: { authorId: userId },
          select: { id: true, body: true, createdAt: true },
          take: 500,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.savedListing.findMany({
          where: { userId },
          select: { listingId: true, createdAt: true },
        }),
      ]);

    return {
      exportedAt: new Date().toISOString(),
      account: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        createdAt: user.createdAt,
        tosAcceptedAt: user.termsAcceptedAt,
        tosVersion: user.tosVersion,
      },
      profile,
      addresses,
      listings,
      ordersAsBuyer,
      ordersAsSeller,
      reviews,
      messages,
      savedListings,
    };
  }
}
