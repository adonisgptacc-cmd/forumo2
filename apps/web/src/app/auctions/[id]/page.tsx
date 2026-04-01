'use client';

import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { formatCurrency } from '../../../lib/format-currency';
import Image from 'next/image';
import { useAuctionSocket } from '../../../lib/realtime/use-auction-socket';
import { PlaceBidForm } from '../../../components/auctions/place-bid-form';
import { useEffect, useState } from 'react';

// Define types based on backend response
interface Bid {
    id: string;
    amountCents: number;
    createdAt: string;
    bidder: {
        id: string;
        name: string;
        avatarUrl?: string;
    };
}

interface AuctionDetail {
    id: string;
    startingBidCents: number;
    endAt: string;
    status: string;
    seller: {
        id: string;
        name: string;
    };
    listing: {
        id: string;
        title: string;
        description: string;
        images: { url: string }[];
    };
    bids: Bid[];
}

export default function AuctionDetailPage() {
    const params = useParams();
    const auctionId = params.id as string;
    const queryClient = useQueryClient();
    const socket = useAuctionSocket(auctionId);
    const [lastEvent, setLastEvent] = useState<string | null>(null);

    const { data: auction, isLoading, error } = useQuery<AuctionDetail>({
        queryKey: ['auction', auctionId],
        queryFn: () => apiClient.get(`/auctions/${auctionId}`),
        enabled: !!auctionId,
    });

    // Listen for real-time updates
    useEffect(() => {
        if (!socket) return;

        socket.on('auction:bid', (newBid: any) => {
            console.log('Real-time bid received:', newBid);
            setLastEvent('New bid placed!');
            // Ideally optimistic update or just invalidate to refetch full state
            queryClient.invalidateQueries({ queryKey: ['auction', auctionId] });

            // Clear message after 3s
            setTimeout(() => setLastEvent(null), 3000);
        });

        return () => {
            socket.off('auction:bid');
        };
    }, [socket, auctionId, queryClient]);


    if (isLoading) return <div className="p-8 text-center">Loading auction...</div>;
    if (error) return <div className="p-8 text-center text-red-500">Error loading auction</div>;
    if (!auction) return null;

    const currentPrice = auction.bids.length > 0
        ? auction.bids[0].amountCents
        : auction.startingBidCents;

    const minNextBid = currentPrice + (currentPrice < 500 ? 25 : currentPrice < 2500 ? 50 : 100);

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Left Col: Images */}
                <div className="space-y-4">
                    <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border relative">
                        {auction.listing.images[0] ? (
                            <Image src={auction.listing.images[0].url} alt={auction.listing.title} fill className="object-cover" />
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-400">No Image</div>
                        )}
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                        {auction.listing.images.slice(1).map((img, idx) => (
                            <div key={idx} className="aspect-square bg-gray-100 rounded-md overflow-hidden border relative">
                                <Image src={img.url} alt="" fill className="object-cover" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Col: Details & Bidding */}
                <div className="space-y-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">{auction.listing.title}</h1>
                        <p className="text-gray-500">Sold by {auction.seller.name}</p>
                    </div>

                    <div className="bg-gray-50 p-6 rounded-xl border space-y-4">
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-sm text-gray-500 font-medium uppercase tracking-wide">Current Price</p>
                                <p className="text-4xl font-bold text-gray-900 font-mono mt-1">
                                    {formatCurrency(currentPrice)}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-gray-500 font-medium uppercase tracking-wide">Ends In</p>
                                <AuctionTimer endAt={auction.endAt} />
                            </div>
                        </div>

                        {lastEvent && (
                            <div className="bg-blue-100 text-blue-800 text-sm py-2 px-3 rounded animate-pulse">
                                {lastEvent}
                            </div>
                        )}

                        <div className="pt-4 border-t border-gray-200">
                            <PlaceBidForm auctionId={auctionId} minBidCents={minNextBid} />
                        </div>
                    </div>

                    <div>
                        <h3 className="text-xl font-bold mb-4">Description</h3>
                        <div className="prose max-w-none text-gray-700">
                            {auction.listing.description}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-xl font-bold mb-4">Bid History</h3>
                        <div className="space-y-3">
                            {auction.bids.length === 0 ? (
                                <p className="text-gray-500 italic">No bids yet. Be the first!</p>
                            ) : (
                                auction.bids.map(bid => (
                                    <div key={bid.id} className="flex justify-between items-center py-2 border-b last:border-0 border-gray-100">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                                                {bid.bidder.name.charAt(0)}
                                            </div>
                                            <span className="font-medium text-gray-700">{bid.bidder.name}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-mono font-bold text-gray-900">{formatCurrency(bid.amountCents)}</span>
                                            <p className="text-xs text-gray-400">{new Date(bid.createdAt).toLocaleTimeString()}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function AuctionTimer({ endAt }: { endAt: string }) {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        const update = () => {
            const now = new Date().getTime();
            const end = new Date(endAt).getTime();
            const diff = end - now;

            if (diff <= 0) {
                setTimeLeft('Ended');
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
        };

        const timer = setInterval(update, 1000);
        update();
        return () => clearInterval(timer);
    }, [endAt]);

    return <span className="text-xl font-medium text-red-600">{timeLeft}</span>;
}
