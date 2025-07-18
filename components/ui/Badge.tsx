import React from 'react';

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 border-transparent bg-blue-600 text-white ${className}`} {...props} />
    );
}