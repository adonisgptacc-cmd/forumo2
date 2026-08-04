'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createApiClient } from './api-client';
import { useCurrentUser, type BackendCart, type BackendCartItem } from './react-query/hooks';

export interface CartItem {
  listingId: string;
  variantId?: string;
  variantLabel?: string;
  sellerId: string;
  sellerName?: string;
  title: string;
  priceCents: number;
  currency: string;
  quantity: number;
  imageUrl?: string;
}

interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  totalCents: number;
  groupedBySeller: Map<string, CartItem[]>;
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (listingId: string, variantId?: string) => void;
  updateQuantity: (listingId: string, quantity: number, variantId?: string) => void;
  clearCart: () => void;
  clearSellerItems: (sellerId: string) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const BASE_KEY = 'forumo.cart';

function storageKey(userId?: string | null) {
  return userId ? `${BASE_KEY}.${userId}` : BASE_KEY;
}

function loadFromStorage(userId?: string | null): CartItem[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    return JSON.parse(raw) as CartItem[];
  } catch {
    return [];
  }
}

function saveToStorage(items: CartItem[], userId?: string | null) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(items));
  } catch {
    // ignore
  }
}

function itemKey(listingId: string, variantId?: string) {
  return variantId ? `${listingId}:${variantId}` : listingId;
}

// Maps a backend cart row (CartService.getCart()) into the local shape.
function fromBackendItem(item: BackendCartItem): CartItem {
  return {
    listingId: item.listingId,
    variantId: item.variantId,
    variantLabel: item.variantLabel,
    sellerId: item.listing.sellerId,
    title: item.listing.title,
    priceCents: item.priceSnapshot,
    currency: item.listing.currency,
    quantity: item.quantity,
    imageUrl: item.listing.images[0]?.url,
  };
}

// Best-effort fallback when a backend merge/fetch fails (e.g. offline) — keeps
// both sets of items rather than silently dropping the guest cart.
function mergeLocalItems(base: CartItem[], extra: CartItem[]): CartItem[] {
  const map = new Map<string, CartItem>();
  for (const item of base) map.set(itemKey(item.listingId, item.variantId), item);
  for (const item of extra) {
    const key = itemKey(item.listingId, item.variantId);
    const existing = map.get(key);
    map.set(key, existing ? { ...existing, quantity: Math.max(existing.quantity, item.quantity) } : item);
  }
  return Array.from(map.values());
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user, accessToken } = useCurrentUser();
  const userId = user?.id as string | undefined;
  const api = useMemo(() => createApiClient(accessToken), [accessToken]);
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const prevUserIdRef = useRef<string | undefined>(undefined);

  // Reconciles the local cart with the backend the moment a guest becomes
  // signed in (or a signed-in session is established on load): any guest
  // cart is merged into the account's backend cart, then the merged result
  // (or the account's existing backend cart, if there was no guest cart)
  // becomes the local state. Falls back to plain local-storage behavior if
  // the backend call fails, so the cart still works offline.
  const hydrateFromBackend = useCallback(async (uid: string) => {
    const guestItems = loadFromStorage(undefined);
    try {
      if (guestItems.length > 0) {
        const merged = (await api.cart.merge(
          guestItems.map((i) => ({
            listingId: i.listingId,
            quantity: i.quantity,
            variantId: i.variantId,
            variantLabel: i.variantLabel,
          })),
        )) as BackendCart;
        setItems(merged.items.map(fromBackendItem));
        try {
          localStorage.removeItem(storageKey(undefined));
        } catch {
          // ignore
        }
      } else {
        const backendCart = (await api.cart.get()) as BackendCart;
        setItems(backendCart.items.length > 0 ? backendCart.items.map(fromBackendItem) : loadFromStorage(uid));
      }
    } catch {
      setItems(mergeLocalItems(loadFromStorage(uid), guestItems));
    } finally {
      setHydrated(true);
    }
  }, [api]);

  useEffect(() => {
    const changed = prevUserIdRef.current !== userId;
    if (!changed && hydrated) return;

    const previousUserId = prevUserIdRef.current;
    prevUserIdRef.current = userId;

    if (changed && !previousUserId && userId) {
      void hydrateFromBackend(userId);
    } else {
      setItems(loadFromStorage(userId));
      setHydrated(true);
    }
  }, [userId, hydrated, hydrateFromBackend]);

  useEffect(() => {
    if (hydrated) saveToStorage(items, userId);
  }, [items, hydrated, userId]);

  const addItem = useCallback((item: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
    setItems((prev) => {
      const key = itemKey(item.listingId, item.variantId);
      const existing = prev.find((i) => itemKey(i.listingId, i.variantId) === key);
      if (existing) {
        return prev.map((i) =>
          itemKey(i.listingId, i.variantId) === key
            ? { ...i, quantity: i.quantity + (item.quantity ?? 1) }
            : i,
        );
      }
      return [...prev, { ...item, quantity: item.quantity ?? 1 }];
    });
    if (userId) {
      api.cart.addItem(item.listingId, item.quantity ?? 1, item.variantId, item.variantLabel).catch(() => {});
    }
  }, [userId, api]);

  const removeItem = useCallback((listingId: string, variantId?: string) => {
    const key = itemKey(listingId, variantId);
    setItems((prev) => prev.filter((i) => itemKey(i.listingId, i.variantId) !== key));
    if (userId) {
      api.cart.removeItem(listingId, variantId).catch(() => {});
    }
  }, [userId, api]);

  const updateQuantity = useCallback((listingId: string, quantity: number, variantId?: string) => {
    const key = itemKey(listingId, variantId);
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => itemKey(i.listingId, i.variantId) !== key));
      if (userId) api.cart.removeItem(listingId, variantId).catch(() => {});
    } else {
      setItems((prev) =>
        prev.map((i) => (itemKey(i.listingId, i.variantId) === key ? { ...i, quantity } : i)),
      );
      if (userId) api.cart.updateItem(listingId, quantity, variantId).catch(() => {});
    }
  }, [userId, api]);

  const clearCart = useCallback(() => {
    setItems([]);
    if (userId) api.cart.clear().catch(() => {});
  }, [userId, api]);

  const clearSellerItems = useCallback((sellerId: string) => {
    if (userId) {
      for (const item of items) {
        if (item.sellerId === sellerId) {
          api.cart.removeItem(item.listingId, item.variantId).catch(() => {});
        }
      }
    }
    setItems((prev) => prev.filter((i) => i.sellerId !== sellerId));
  }, [userId, api, items]);

  const itemCount = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);
  const totalCents = useMemo(() => items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0), [items]);
  const groupedBySeller = useMemo(() => {
    const map = new Map<string, CartItem[]>();
    for (const item of items) {
      const group = map.get(item.sellerId) ?? [];
      group.push(item);
      map.set(item.sellerId, group);
    }
    return map;
  }, [items]);

  return (
    <CartContext.Provider value={{ items, itemCount, totalCents, groupedBySeller, addItem, removeItem, updateQuantity, clearCart, clearSellerItems }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
