import type { Auction, SafeOffer, SafeOrder } from '@forumo/shared';

export type AuthStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  Discover: undefined;
  Auctions: undefined;
  Orders: undefined;
  Inbox: undefined;
  Profile: undefined;
};

export type MainStackParamList = {
  Tabs: undefined;
  Thread: { threadId: string; thread?: import('@forumo/shared').SafeMessageThread };
  AuctionDetail: { auctionId: string; auction?: Auction };
  OrderDetail: { orderId: string; order?: SafeOrder };
  ListingDetail: { listingId: string; listing?: import('@forumo/shared').SafeListing };
  Cart: undefined;
  Checkout: { sellerId: string; sellerName?: string };
  Offers: undefined;
  Notifications: undefined;
  Wishlist: undefined;
  CreateListing: undefined;
  MyListings: undefined;
  EditListing: { listingId: string; listing?: import('@forumo/shared').SafeListing };
  Reviews: { sellerId: string; listingId?: string };
  SellerDashboard: undefined;
  KYC: undefined;
};
