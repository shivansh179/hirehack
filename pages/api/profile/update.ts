// pages/api/profile/update.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { getUserIdFromRequest } from '../../../lib/getUserFromRequest';
import { User } from '@prisma/client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const userId = await getUserIdFromRequest(req);
    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const { name, experienceLevel, careerGoal } = req.body;

    try {
        const updatedUser: User = await prisma.user.update({
            where: { id: userId },
            // These fields will now match the regenerated client's expectations
            data: {
                name: name,
                experienceLevel: experienceLevel,
                careerGoal: careerGoal,
            },
        });
        return res.status(200).json(updatedUser);
    } catch (error) {
        console.error("Profile update error:", error)
        return res.status(500).json({ error: 'Failed to update profile.' });
    }
}