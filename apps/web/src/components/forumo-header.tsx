'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useCurrentUser } from '../lib/react-query/hooks';
import { useCart } from '../lib/cart-context';
import { NotificationBell } from './notification-bell';
import { SignOutButton } from './signout-button';

export function ForumoHeader() {
    const { user } = useCurrentUser();
    const { itemCount } = useCart();
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchCategory, setSearchCategory] = useState('all');

    function handleSearch(event: React.FormEvent) {
        event.preventDefault();
        const parts = [];
        if (searchCategory !== 'all') parts.push(searchCategory);
        if (searchQuery.trim()) parts.push(searchQuery.trim());
        const keyword = parts.join(' ');
        const params = new URLSearchParams();
        if (keyword) params.set('keyword', keyword);
        router.push(`/listings${params.toString() ? `?${params.toString()}` : ''}` as any);
    }

    return (
        <header className="flex flex-col">
            {/* Top Header */}
            <div className="forumo-header flex items-center gap-4 px-4 py-2">
                {/* Logo */}
                <Link href="/" className="flex items-center hover:outline outline-1 outline-white p-1">
                    <span className="text-2xl font-bold italic tracking-tighter">forumo</span>
                    <span className="text-xs mt-1 ml-0.5 text-forumo-gold">.africa</span>
                </Link>

                {/* Deliver to */}
                <div className="hidden md:flex flex-col hover:outline outline-1 outline-white p-1 cursor-pointer">
                    <span className="text-xs text-slate-300">Deliver to</span>
                    <span className="text-sm font-bold">Lagos, NG</span>
                </div>

                {/* Search Bar */}
                <form onSubmit={handleSearch} className="flex-1 flex items-center h-10">
                    <select
                        className="bg-slate-100 text-slate-700 h-full px-2 rounded-l-md border-r border-slate-300 text-sm focus:outline-none"
                        value={searchCategory}
                        onChange={(e) => setSearchCategory(e.target.value)}
                    >
                        <option value="all">All</option>
                        <option value="electronics">Electronics</option>
                        <option value="fashion">Fashion</option>
                        <option value="home">Home</option>
                    </select>
                    <input
                        type="text"
                        className="flex-1 h-full px-4 text-slate-900 focus:outline-none"
                        placeholder="Search Forumo"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <button type="submit" className="bg-forumo-gold hover:bg-forumo-gold-hover h-full px-5 rounded-r-md transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </button>
                </form>

                {/* Account & Orders */}
                <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                    <Link href={(user ? "/app" : "/login") as any} className="hidden sm:flex flex-col hover:outline outline-1 outline-white p-1">
                        <span className="text-xs">{user ? `Hello, ${user.name}` : 'Hello, sign in'}</span>
                        <span className="text-sm font-bold">Account & Lists</span>
                    </Link>

                    <Link href={"/app/orders" as any} className="hidden sm:flex flex-col hover:outline outline-1 outline-white p-1">
                        <span className="text-xs">Returns</span>
                        <span className="text-sm font-bold">& Orders</span>
                    </Link>

                    {user && <NotificationBell />}

                    <Link href={"/app/cart" as any} className="flex items-end hover:outline outline-1 outline-white p-1">
                        <div className="relative">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <span className="absolute -top-1 -right-1 bg-forumo-orange text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">{itemCount > 99 ? '99+' : itemCount}</span>
                        </div>
                        <span className="text-sm font-bold mb-1 ml-1 hidden lg:inline">Cart</span>
                    </Link>

                    {user && (
                        <div className="hover:outline outline-1 outline-white p-1">
                            <SignOutButton />
                        </div>
                    )}
                </div>
            </div>

            {/* Navigation Bar */}
            <div className="forumo-sub-header flex items-center gap-4 px-4 py-1 text-sm font-medium overflow-x-auto scrollbar-none">
                <button className="flex shrink-0 items-center gap-1 hover:outline outline-1 outline-white px-2 py-1 whitespace-nowrap">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                    All
                </button>
                <Link href={"/listings" as any} className="shrink-0 hover:outline outline-1 outline-white px-2 py-1 whitespace-nowrap">All Listings</Link>
                <Link href={"/auctions" as any} className="shrink-0 hover:outline outline-1 outline-white px-2 py-1 whitespace-nowrap">Auctions</Link>
                <Link href={"/app/messages" as any} className="shrink-0 hover:outline outline-1 outline-white px-2 py-1 whitespace-nowrap">Messages</Link>
                <Link href={"/listings/new" as any} className="shrink-0 hover:outline outline-1 outline-white px-2 py-1 font-bold whitespace-nowrap">Sell on Forumo</Link>
                {user && (user as any).role === 'ADMIN' && (
                    <Link href={"/admin" as any} className="shrink-0 hover:outline outline-1 outline-white px-2 py-1 text-forumo-gold whitespace-nowrap">Admin</Link>
                )}
            </div>
        </header>
    );
}
