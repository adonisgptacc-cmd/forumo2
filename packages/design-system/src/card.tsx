import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

export const Card = ({ className, children, ...props }: CardProps) => {
    return (
        <div
            className={cn(
                'rounded-lg border bg-white text-gray-900 shadow-sm',
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
};
