// pages/api/auth/signin.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma'; // Corrected Import
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { getJwtSecretKey } from '../../../lib/auth';
import { serialize } from 'cookie';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.password) {
        return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const passwordIsValid = await bcrypt.compare(password, user.password);

    if (!passwordIsValid) {
        return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const token = await new SignJWT({
        userId: user.id,
        email: user.email
    })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d')
    .sign(getJwtSecretKey());

    const cookie = serialize('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24,
        path: '/',
    });
    res.setHeader('Set-Cookie', cookie);
    return res.status(200).json({ success: true });
}