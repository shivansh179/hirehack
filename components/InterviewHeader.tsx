// components/InterviewHeader.tsx
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

export const InterviewHeader = ({ userEmail }: {userEmail: string}) => {
    const router = useRouter();
    const handleSignOut = async () => {
        await fetch('/api/auth/signout');
        router.push('/sign-in');
    };
    return (
        <header className="flex-shrink-0 p-4 flex justify-between items-center border-b border-gray-700/50">
            <Link href="/dashboard"><a className="text-blue-400 hover:underline">← Dashboard</a></Link>
            <h1 className="text-xl md:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-pink-500">
                AI Interview in Progress
            </h1>
            <div className="flex items-center gap-4">
                <span className="text-gray-300 hidden sm:inline">{userEmail}</span>
                <button onClick={handleSignOut} className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded-md text-sm">Sign Out</button>
            </div>
      </header>
    );
};