// pages/api/auth/signup.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';

type ApiResponse =
  | { ok: true; data: { email: string } }
  | { ok: false; error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'POST')
    return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { email = '', password = '' } = req.body ?? {};

  if (!email || !password || password.length < 6)
    return res.status(400).json({
      ok: false,
      error: 'Email and a password of at least 6 characters are required.',
    });

  try {
    // 1⃣ Check for existing user
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing)
      return res
        .status(400)
        .json({ ok: false, error: 'User with this email already exists.' });

    // 2⃣ Hash & create
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashed },
    });

    return res.status(201).json({ ok: true, data: { email: user.email } });
  } catch (err) {
    console.error('Signup API error:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'Could not create user. Please try again.' });
  } finally {
    // Helps prevent hot‑reload “too many connections” during dev
    await prisma.$disconnect().catch(() => {});
  }
}
