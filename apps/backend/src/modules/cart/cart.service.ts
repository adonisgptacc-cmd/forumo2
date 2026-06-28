import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const CART_TTL_DAYS = 30;

function cartExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + CART_TTL_DAYS);
  return d;
}

const LISTING_SELECT = {
  id: true,
  title: true,
  priceCents: true,
  currency: true,
  status: true,
  images: { take: 1, select: { url: true } },
  variants: { select: { inventoryCount: true } },
} as const;

function totalStock(variants: { inventoryCount: number }[]): number {
  return variants.reduce((sum, v) => sum + v.inventoryCount, 0);
}

function isInStock(listing: {
  status: string;
  variants: { inventoryCount: number }[];
}): boolean {
  if (listing.status !== 'PUBLISHED') return false;
  if (listing.variants.length === 0) return true;
  return totalStock(listing.variants) > 0;
}

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateCart(userId: string) {
    const existing = await this.prisma.cart.findUnique({ where: { userId } });
    if (existing) {
      return this.prisma.cart.update({
        where: { id: existing.id },
        data: { expiresAt: cartExpiresAt() },
      });
    }
    return this.prisma.cart.create({
      data: { userId, expiresAt: cartExpiresAt() },
    });
  }

  async getCart(userId: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: { listing: { select: LISTING_SELECT } },
          orderBy: { addedAt: 'asc' },
        },
      },
    });

    if (!cart) return { id: null, items: [], total: 0 };

    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { expiresAt: cartExpiresAt() },
    });

    const items = cart.items.map((item) => {
      const { listing } = item;
      const priceChanged = listing.priceCents !== item.priceSnapshot;
      return {
        id: item.id,
        listingId: item.listingId,
        variantId: item.variantId ?? undefined,
        variantLabel: item.variantLabel ?? undefined,
        quantity: item.quantity,
        priceSnapshot: item.priceSnapshot,
        addedAt: item.addedAt,
        listing: {
          title: listing.title,
          images: listing.images,
          currency: listing.currency,
        },
        inStock: isInStock(listing),
        priceChanged,
        currentPrice: listing.priceCents,
      };
    });

    const total = items
      .filter((i) => i.inStock)
      .reduce((sum, i) => sum + i.priceSnapshot * i.quantity, 0);

    return { id: cart.id, expiresAt: cart.expiresAt, items, total };
  }

  async addItem(userId: string, listingId: string, quantity: number, variantId?: string, variantLabel?: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { variants: { select: { id: true, inventoryCount: true, priceCents: true } } },
    });

    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.status !== 'PUBLISHED') {
      throw new BadRequestException('Listing is not available');
    }

    const hasVariants = listing.variants.length > 0;

    if (hasVariants && !variantId) {
      throw new BadRequestException('Please select a variant before adding to cart');
    }

    let priceSnapshot = listing.priceCents;
    let stock: number;

    if (variantId) {
      const variant = listing.variants.find((v) => v.id === variantId);
      if (!variant) throw new BadRequestException('Variant not found on this listing');
      stock = variant.inventoryCount;
      priceSnapshot = variant.priceCents;
    } else {
      stock = totalStock(listing.variants);
      if (hasVariants && stock === 0) {
        throw new BadRequestException('Listing is out of stock');
      }
    }

    const cart = await this.getOrCreateCart(userId);

    const existing = await this.prisma.cartItem.findFirst({
      where: { cartId: cart.id, listingId, variantId: variantId ?? null },
    });

    if (existing) {
      const merged = existing.quantity + quantity;
      const newQty = variantId ? Math.min(merged, stock) : merged;
      return this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: newQty, variantId: variantId ?? null, variantLabel: variantLabel ?? null, priceSnapshot },
      });
    }

    const safeQty = variantId ? Math.min(quantity, stock) : quantity;
    return this.prisma.cartItem.create({
      data: {
        cartId: cart.id,
        listingId,
        variantId: variantId ?? null,
        variantLabel: variantLabel ?? null,
        quantity: safeQty,
        priceSnapshot,
      },
    });
  }

  async removeItem(userId: string, cartItemId: string) {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: cartItemId },
      include: { cart: { select: { userId: true } } },
    });
    if (!item) throw new NotFoundException('Cart item not found');
    if (item.cart.userId !== userId) throw new ForbiddenException();

    await this.prisma.cartItem.delete({ where: { id: cartItemId } });
  }

  async updateQuantity(userId: string, cartItemId: string, quantity: number) {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: cartItemId },
      include: {
        cart: { select: { userId: true } },
        listing: { include: { variants: { select: { inventoryCount: true } } } },
      },
    });
    if (!item) throw new NotFoundException('Cart item not found');
    if (item.cart.userId !== userId) throw new ForbiddenException();

    const stock = totalStock(item.listing.variants);
    const hasVariants = item.listing.variants.length > 0;
    if (hasVariants && quantity > stock) {
      throw new BadRequestException(`Only ${stock} unit(s) available in stock`);
    }

    return this.prisma.cartItem.update({
      where: { id: cartItemId },
      data: { quantity },
    });
  }

  async clearCart(userId: string) {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (!cart) return;
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  }

  async mergeGuestCart(
    userId: string,
    guestItems: { listingId: string; quantity: number }[],
  ) {
    const cart = await this.getOrCreateCart(userId);

    for (const guest of guestItems) {
      const listing = await this.prisma.listing.findUnique({
        where: { id: guest.listingId },
        include: { variants: { select: { inventoryCount: true } } },
      });
      if (!listing || listing.status !== 'PUBLISHED') continue;

      const stock = totalStock(listing.variants);
      const hasVariants = listing.variants.length > 0;
      if (hasVariants && stock === 0) continue;

      const existing = await this.prisma.cartItem.findUnique({
        where: { cartId_listingId: { cartId: cart.id, listingId: guest.listingId } },
      });

      if (existing) {
        const higher = Math.max(existing.quantity, guest.quantity);
        const safe = hasVariants ? Math.min(higher, stock) : higher;
        if (safe !== existing.quantity) {
          await this.prisma.cartItem.update({
            where: { id: existing.id },
            data: { quantity: safe },
          });
        }
      } else {
        const safeQty = hasVariants ? Math.min(guest.quantity, stock) : guest.quantity;
        await this.prisma.cartItem.create({
          data: {
            cartId: cart.id,
            listingId: guest.listingId,
            quantity: safeQty,
            priceSnapshot: listing.priceCents,
          },
        });
      }
    }

    return this.getCart(userId);
  }

  async getPriceChangedItems(userId: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            listing: { select: { id: true, title: true, priceCents: true } },
          },
        },
      },
    });
    if (!cart) return [];

    return cart.items
      .filter((item) => item.listing.priceCents !== item.priceSnapshot)
      .map((item) => ({
        cartItemId: item.id,
        listingId: item.listingId,
        title: item.listing.title,
        priceSnapshot: item.priceSnapshot,
        currentPrice: item.listing.priceCents,
      }));
  }
}
