// pages/api/interview/create.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma'; // Corrected Import
import { getUserIdFromRequest } from '../../../lib/getUserFromRequest';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const { resumeId } = req.body;
  if (!resumeId) {
    return res.status(400).json({ error: 'Resume ID is required' });
  }
  try {
    const resume = await prisma.resume.findFirst({
        where: { id: resumeId, userId: userId }
    });
    if (!resume) {
        return res.status(404).json({ error: 'Resume not found or access denied' });
    }
    const firstMessage = {
        sender: 'gemini',
        text: "Hello! I'm your friendly AI interviewer. I've reviewed your resume. To start, could you please tell me a little bit about yourself and why you're interested in the type of role you're seeking?"
    };
    const newSession = await prisma.interviewSession.create({
      data: {
        resumeId: resumeId,
        messages: [firstMessage],
      },
    });
    res.status(201).json({ sessionId: newSession.id });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}