import Image from 'next/image';
import { formatCurrency } from '../../lib/format-currency';
import { Card } from '@forumo/design-system';
import Link from 'next/link';

interface AuctionCardProps {
    id: string;
    title: string;
    imageUrl?: string;
    currentBidCents: number;
    endTime: string;
}

export function AuctionCard({ id, title, imageUrl, currentBidCents, endTime }: AuctionCardProps) {
    return (
        <Link href={`/auctions/${id}`} className="block group">
            <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
                <div className="aspect-square bg-gray-100 relative overflow-hidden">
                    {imageUrl ? (
                        <Image
                            src={imageUrl}
                            alt={title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">No Image</div>
                    )}
                </div>
                <div className="p-4">
                    <h3 className="font-medium text-lg leading-snug mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
                        {title}
                    </h3>
                    <div className="flex justify-between items-end mt-4">
                        <div>
                            <p className="text-sm text-gray-500">Current Bid</p>
                            <p className="text-xl font-bold font-mono">{formatCurrency(currentBidCents)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-gray-500">Ends</p>
                            <p className="text-sm font-medium text-red-600">
                                {new Date(endTime).toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                </div>
            </Card>
        </Link>
    );
}
