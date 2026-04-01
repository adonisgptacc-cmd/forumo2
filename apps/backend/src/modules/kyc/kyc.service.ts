import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { KycStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class KycService {
    private readonly logger = new Logger(KycService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly notifications: NotificationsService,
    ) { }

    async submitKyc(userId: string, documents: { type: string; url: string; bucket: string; storageKey: string; metadata?: any }[]) {
        // Check if user already has a pending or approved KYC
        const existing = await this.prisma.kycSubmission.findFirst({
            where: {
                userId,
                status: { in: ['PENDING', 'APPROVED'] },
            },
        });

        if (existing?.status === 'APPROVED') {
            throw new BadRequestException('KYC already approved');
        }

        if (existing?.status === 'PENDING') {
            throw new BadRequestException('KYC submission already pending review');
        }

        // Create new submission
        const submission = await this.prisma.kycSubmission.create({
            data: {
                userId,
                status: 'PENDING',
                submittedAt: new Date(),
                documents: {
                    create: documents.map((doc) => ({
                        type: doc.type,
                        url: doc.url,
                        bucket: doc.bucket,
                        storageKey: doc.storageKey,
                        status: 'PENDING',
                        metadata: doc.metadata || {},
                    })),
                },
            },
            include: {
                documents: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
            },
        });

        // Update user KYC status
        await this.prisma.user.update({
            where: { id: userId },
            data: { kycStatus: 'PENDING' },
        });

        return submission;
    }

    async getSubmission(userId: string) {
        const submission = await this.prisma.kycSubmission.findFirst({
            where: { userId },
            orderBy: { submittedAt: 'desc' },
            include: {
                documents: true,
                reviewer: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
            },
        });

        if (!submission) {
            throw new NotFoundException('No KYC submission found');
        }

        return submission;
    }

    async listPendingSubmissions() {
        return this.prisma.kycSubmission.findMany({
            where: { status: 'PENDING' },
            include: {
                documents: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
            },
            orderBy: { submittedAt: 'asc' },
        });
    }

    async reviewSubmission(
        submissionId: string,
        reviewerId: string,
        decision: 'APPROVED' | 'REJECTED',
        rejectionReason?: string,
    ) {
        const submission = await this.prisma.kycSubmission.findUnique({
            where: { id: submissionId },
            include: { user: true },
        });

        if (!submission) {
            throw new NotFoundException('Submission not found');
        }

        if (submission.status !== 'PENDING') {
            throw new BadRequestException('Submission already reviewed');
        }

        // Update submission
        const updated = await this.prisma.kycSubmission.update({
            where: { id: submissionId },
            data: {
                status: decision,
                reviewerId,
                reviewedAt: new Date(),
                rejectionReason: decision === 'REJECTED' ? rejectionReason : null,
            },
            include: {
                documents: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
                reviewer: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
            },
        });

        // Update user KYC status
        await this.prisma.user.update({
            where: { id: submission.userId },
            data: { kycStatus: decision },
        });

        await this.notifications.notifyKycDecision(
            updated.user.email,
            updated.user.name ?? 'User',
            decision,
            updated.rejectionReason,
        );

        return updated;
    }

    async getSubmissionById(id: string) {
        const submission = await this.prisma.kycSubmission.findUnique({
            where: { id },
            include: {
                documents: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
                reviewer: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
            },
        });

        if (!submission) {
            throw new NotFoundException('Submission not found');
        }

        return submission;
    }
}
