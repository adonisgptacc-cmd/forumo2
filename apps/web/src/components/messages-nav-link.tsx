'use client';

import Link from 'next/link';
import { useUnreadMessageCount } from '../lib/react-query/hooks';

export function MessagesNavLink() {
  const count = useUnreadMessageCount();

  return (
    <Link
      href={'/app/messages' as any}
      className="relative rounded-full border border-slate-700 px-4 py-1 text-slate-300 hover:border-amber-400"
    >
      Messages
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-black">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
