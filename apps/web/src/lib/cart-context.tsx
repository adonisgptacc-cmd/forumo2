'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

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

const STORAGE_KEY = 'forumo.cart';

function loadFromStorage(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CartItem[];
  } catch {
    return [];
  }
}

function saveToStorage(items: CartItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

function itemKey(listingId: string, variantId?: string) {
  return variantId ? `${listingId}:${variantId}` : listingId;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(loadFromStorage());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveToStorage(items);
  }, [items, hydrated]);

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
  }, []);

  const removeItem = useCallback((listingId: string, variantId?: string) => {
    const key = itemKey(listingId, variantId);
    setItems((prev) => prev.filter((i) => itemKey(i.listingId, i.variantId) !== key));
  }, []);

  const updateQuantity = useCallback((listingId: string, quantity: number, variantId?: string) => {
    const key = itemKey(listingId, variantId);
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => itemKey(i.listingId, i.variantId) !== key));
    } else {
      setItems((prev) =>
        prev.map((i) => (itemKey(i.listingId, i.variantId) === key ? { ...i, quantity } : i)),
      );
    }
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const clearSellerItems = useCallback((sellerId: string) => {
    setItems((prev) => prev.filter((i) => i.sellerId !== sellerId));
  }, []);

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
