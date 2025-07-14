import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';
import { getUserIdFromRequest } from '../../../lib/getUserFromRequest';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { sessionId, messages } = req.body;

  if (!sessionId || !messages) {
    return res.status(400).json({ error: 'Session ID and messages are required' });
  }

  try {
    // A robust check to ensure the user owns the session is important
    const session = await prisma.interviewSession.findFirst({
        where: {
            id: sessionId,
            resume: {
                userId: userId,
            },
        },
    });

    if (!session) {
        return res.status(403).json({ error: 'Access denied.' });
    }

    await prisma.interviewSession.update({
      where: { id: sessionId },
      data: { messages: messages },
    });

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}