import { NextRequest, NextResponse } from 'next/server';
import { verifyJwtToken } from './lib/auth';

const AUTH_PAGES = ['/sign-in', '/sign-up'];

const isAuthPages = (url: string) => AUTH_PAGES.some(page => page.startsWith(url));

export async function middleware(request: NextRequest) {
    const { url, nextUrl, cookies } = request;
    const { value: token } = cookies.get('token') ?? { value: undefined };

    const hasVerifiedToken = token && await verifyJwtToken(token);
    const isAuthPageRequested = isAuthPages(nextUrl.pathname);

    if (isAuthPageRequested) {
        if (!hasVerifiedToken) {
            return NextResponse.next();
        }
        return NextResponse.redirect(new URL('/dashboard', url));
    }
    
    if (!hasVerifiedToken) {
        const searchParams = new URLSearchParams(nextUrl.searchParams);
        searchParams.set('next', nextUrl.pathname);
        return NextResponse.redirect(new URL(`/sign-in?${searchParams}`, url));
    }
    
    return NextResponse.next();
}

export const config = {
     matcher: ['/dashboard/:path*', '/interview/:path*', '/sign-in', '/sign-up'],
};