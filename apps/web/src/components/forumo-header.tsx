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
        <header>
            {/* Top bar */}
            <div className="forumo-header" style={{ padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 20 }}>
                {/* Brand */}
                <Link href="/" style={{ display: 'flex', alignItems: 'baseline', gap: 1, textDecoration: 'none', color: 'var(--ink)', flexShrink: 0 }}>
                    <span style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, fontStyle: 'italic', letterSpacing: '-0.04em' }}>forumo</span>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', marginBottom: 3, marginLeft: 1 }} />
                    <span style={{ fontSize: 12, color: 'var(--ink-3)', letterSpacing: '0.02em' }}>africa</span>
                </Link>

                {/* Search */}
                <form onSubmit={handleSearch} style={{ flex: 1, display: 'flex', alignItems: 'center', height: 40, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--line-2)' }}>
                    <select
                        value={searchCategory}
                        onChange={(e) => setSearchCategory(e.target.value)}
                        style={{ background: 'var(--surface-2)', color: 'var(--ink-2)', height: '100%', padding: '0 10px', borderRight: '1px solid var(--line-2)', fontSize: 13, outline: 'none', cursor: 'pointer' }}
                    >
                        <option value="all">All</option>
                        <option value="electronics">Electronics</option>
                        <option value="fashion">Fashion</option>
                        <option value="home">Home</option>
                    </select>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search Forumo"
                        style={{ flex: 1, height: '100%', padding: '0 14px', color: 'var(--ink)', background: 'var(--surface)', outline: 'none', fontSize: 14 }}
                    />
                    <button type="submit" style={{ background: 'var(--accent)', height: '100%', padding: '0 18px', color: 'white', display: 'flex', alignItems: 'center', border: 'none', cursor: 'pointer' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </button>
                </form>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                    <Link href={(user ? '/app' : '/login') as any} className="hidden sm:flex" style={{ flexDirection: 'column', color: 'var(--ink)', textDecoration: 'none' }}>
                        <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{user ? `Hello, ${user.name}` : 'Hello, sign in'}</span>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>Account & Lists</span>
                    </Link>

                    <Link href={'/app/orders' as any} className="hidden sm:flex" style={{ flexDirection: 'column', color: 'var(--ink)', textDecoration: 'none' }}>
                        <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Returns</span>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>& Orders</span>
                    </Link>

                    {user && <NotificationBell />}

                    <Link href={'/app/cart' as any} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink)', textDecoration: 'none' }}>
                        <div style={{ position: 'relative' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width={26} height={26} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <span style={{
                                position: 'absolute', top: -4, right: -6,
                                background: 'var(--accent)', color: 'white',
                                fontSize: 11, fontWeight: 700, borderRadius: 999,
                                minWidth: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px'
                            }}>
                                {itemCount > 99 ? '99+' : itemCount}
                            </span>
                        </div>
                        <span className="hidden lg:inline" style={{ fontSize: 13, fontWeight: 600 }}>Cart</span>
                    </Link>

                    {user && <SignOutButton />}
                </div>
            </div>

            {/* Sub-nav */}
            <div className="forumo-sub-header scrollbar-none" style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '4px 24px', overflowX: 'auto' }}>
                <Link href={'/listings' as any} style={{ flexShrink: 0, padding: '4px 10px', fontSize: 13, color: 'var(--ink-2)', borderRadius: 6, whiteSpace: 'nowrap', textDecoration: 'none' }}>All Listings</Link>
                <Link href={'/auctions' as any} style={{ flexShrink: 0, padding: '4px 10px', fontSize: 13, color: 'var(--ink-2)', borderRadius: 6, whiteSpace: 'nowrap', textDecoration: 'none' }}>Auctions</Link>
                <Link href={'/app/messages' as any} style={{ flexShrink: 0, padding: '4px 10px', fontSize: 13, color: 'var(--ink-2)', borderRadius: 6, whiteSpace: 'nowrap', textDecoration: 'none' }}>Messages</Link>
                <Link href={'/listings/new' as any} style={{ flexShrink: 0, padding: '4px 10px', fontSize: 13, fontWeight: 600, color: 'var(--accent)', borderRadius: 6, whiteSpace: 'nowrap', textDecoration: 'none' }}>Sell on Forumo</Link>
                {user && (user as any).role === 'ADMIN' && (
                    <Link href={'/admin' as any} style={{ flexShrink: 0, padding: '4px 10px', fontSize: 13, color: 'var(--escrow)', borderRadius: 6, whiteSpace: 'nowrap', textDecoration: 'none' }}>Admin</Link>
                )}
            </div>
        </header>
    );
}
