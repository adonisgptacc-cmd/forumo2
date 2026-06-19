import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { ReviewsService } from "./reviews.service";

const mockVoteUpsert = jest.fn();
const mockFlagCreate = jest.fn();
const mockReviewFindFirst = jest.fn();
const mockVoteCount = jest.fn();
const mockReviewDelete = jest.fn();
const mockTransaction = jest.fn();

const mockPrisma = {
  review: { findFirst: mockReviewFindFirst, delete: mockReviewDelete },
  reviewVote: { upsert: mockVoteUpsert, count: mockVoteCount },
  reviewFlag: { create: mockFlagCreate },
  $transaction: mockTransaction,
} as any;

const mockModeration = {} as any;

describe('ReviewsService — vote and flag', () => {
  let service: ReviewsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReviewsService(mockPrisma, mockModeration);
  });

  describe('voteReview', () => {
    it('upserts a helpful vote and returns updated count', async () => {
      mockReviewFindFirst.mockResolvedValue({ id: 'r1', recipientId: 'seller1' });
      mockVoteUpsert.mockResolvedValue({});
      mockVoteCount.mockResolvedValue(3);

      const result = await service.voteReview('r1', 'user1');

      expect(mockVoteUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { reviewId_userId: { reviewId: 'r1', userId: 'user1' } },
          create: { reviewId: 'r1', userId: 'user1', isHelpful: true },
        }),
      );
      expect(result).toEqual({ helpfulCount: 3, userVoted: true });
    });

    it('throws NotFoundException when review does not exist', async () => {
      mockReviewFindFirst.mockResolvedValue(null);

      await expect(service.voteReview('missing', 'user1')).rejects.toThrow(NotFoundException);
      expect(mockVoteUpsert).not.toHaveBeenCalled();
    });
  });

  describe('flagReview', () => {
    it('creates a flag record for the review', async () => {
      mockReviewFindFirst.mockResolvedValue({ id: 'r1' });
      mockFlagCreate.mockResolvedValue({});

      await service.flagReview('r1', 'Spam or fake review');

      expect(mockFlagCreate).toHaveBeenCalledWith({
        data: { reviewId: 'r1', reason: 'Spam or fake review' },
      });
    });

    it('throws NotFoundException when review does not exist', async () => {
      mockReviewFindFirst.mockResolvedValue(null);

      await expect(service.flagReview('missing', 'spam')).rejects.toThrow(NotFoundException);
      expect(mockFlagCreate).not.toHaveBeenCalled();
    });
  });

  describe('update authorization', () => {
    it('rejects a non-author, non-privileged actor', async () => {
      mockReviewFindFirst.mockResolvedValue({ id: 'r1', reviewerId: 'owner', recipientId: 'seller1' });

      await expect(
        service.update('r1', { rating: 1 }, { id: 'attacker', role: 'BUYER' }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when review does not exist', async () => {
      mockReviewFindFirst.mockResolvedValue(null);

      await expect(
        service.update('missing', { rating: 1 }, { id: 'owner', role: 'BUYER' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove authorization', () => {
    it('rejects a non-author, non-privileged actor', async () => {
      mockReviewFindFirst.mockResolvedValue({ id: 'r1', reviewerId: 'owner', recipientId: 'seller1' });

      await expect(
        service.remove('r1', { id: 'attacker', role: 'BUYER' }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('allows a MODERATOR to remove any review', async () => {
      mockReviewFindFirst.mockResolvedValue({ id: 'r1', reviewerId: 'owner', recipientId: 'seller1' });
      mockTransaction.mockResolvedValue(undefined);

      await service.remove('r1', { id: 'mod-1', role: 'MODERATOR' });
      expect(mockTransaction).toHaveBeenCalled();
    });
  });
});
