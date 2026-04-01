'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { apiBaseUrl } from '../../lib/api-client';

interface AuctionItem {
    id: string;
    listingId: string;
    sellerId: string;
    status: string;
    startingBidCents: number;
    buyNowCents?: number | null;
    startAt: string;
    endAt: string;
    bidCount: number;
    listing?: {
        title: string;
        description: string;
        priceCents: number;
        images: { url: string }[];
    };
    seller?: {
        id: string;
        name: string;
    };
}

function formatPrice(cents: number) {
    return new Intl.NumberFormat('en', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function timeLeft(endAt: string) {
    const diff = new Date(endAt).getTime() - Date.now();
    if (diff <= 0) return 'Ended';
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h left`;
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
}

export default function AuctionsPage() {
    const { data, isLoading, isError } = useQuery<{ data: AuctionItem[]; total: number }>({
        queryKey: ['auctions', 'list'],
        queryFn: async () => {
            const res = await fetch(`${apiBaseUrl}/auctions?status=ACTIVE&pageSize=24`);
            if (!res.ok) throw new Error('Failed to fetch auctions');
            return res.json();
        },
    });

    return (
        <div className="px-4 py-6">
            <div className="card-forumo mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Live Auctions</h1>
                        <p className="text-sm text-slate-500 mt-1">Bid on unique items with anti-sniping protection</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-slate-500">
                            {data?.total ?? 0} active auction{(data?.total ?? 0) !== 1 ? 's' : ''}
                        </span>
                        <Link
                            href={'/app/auctions/new' as any}
                            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400"
                        >
                            + Create auction
                        </Link>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="card-forumo animate-pulse space-y-3">
                            <div className="aspect-square bg-slate-200 rounded" />
                            <div className="h-4 bg-slate-200 rounded w-3/4" />
                            <div className="h-4 bg-slate-200 rounded w-1/2" />
                        </div>
                    ))}
                </div>
            ) : isError ? (
                <div className="card-forumo text-center py-12">
                    <p className="text-red-600 font-medium">Failed to load auctions</p>
                    <p className="text-sm text-slate-500 mt-1">The auction service may not be available</p>
                </div>
            ) : data && data.data.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {data.data.map((auction) => (
                        <Link
                            key={auction.id}
                            href={`/auctions/${auction.id}`}
                            className="card-forumo hover:shadow-lg transition-shadow group"
                        >
                            <div className="relative aspect-square bg-slate-100 rounded overflow-hidden mb-3">
                                {auction.listing?.images?.[0]?.url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={auction.listing.images[0].url}
                                        alt={auction.listing?.title ?? 'Auction'}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                )}
                                <div className="absolute top-2 right-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">
                                    {timeLeft(auction.endAt)}
                                </div>
                            </div>
                            <h3 className="font-medium text-sm truncate group-hover:text-forumo-link">
                                {auction.listing?.title ?? 'Untitled Auction'}
                            </h3>
                            <div className="mt-2 space-y-1">
                                <p className="text-lg font-bold text-slate-900">
                                    {formatPrice(auction.listing?.priceCents ?? auction.startingBidCents)}
                                </p>
                                <p className="text-xs text-slate-500">
                                    {auction.bidCount} bid{auction.bidCount !== 1 ? 's' : ''}
                                    {auction.buyNowCents && (
                                        <span className="ml-2 text-forumo-link">Buy Now: {formatPrice(auction.buyNowCents)}</span>
                                    )}
                                </p>
                            </div>
                            {auction.seller && (
                                <p className="text-xs text-slate-400 mt-1">by {auction.seller.name}</p>
                            )}
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="card-forumo text-center py-16 space-y-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-slate-500 font-medium">No active auctions right now</p>
                    <p className="text-sm text-slate-400">Check back soon or create your own auction from a listing</p>
                    <Link href="/listings/new" className="btn-forumo inline-block mt-2">
                        Create a listing
                    </Link>
                </div>
            )}
        </div>
    );
}
