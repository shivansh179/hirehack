import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { getUserIdFromRequest } from '../../../lib/getUserFromRequest';
import { InterviewSession } from '@prisma/client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    const { sessionId } = req.body;
    if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
    }

    const session = await prisma.interviewSession.findFirst({
        where: { id: sessionId },
        include: { resume: { select: { userId: true } } }
    });

    if (!session || session.resume.userId !== userId) {
        return res.status(404).json({ error: 'Session not found or access denied.' });
    }
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Server config error.' });

    const systemPrompt = `You are an expert hiring manager. Analyze the provided interview transcript. Respond with ONLY a valid JSON object with a "score" (integer 1-10) and a "feedback" (string, 3-4 sentences of constructive feedback). Transcript: ${JSON.stringify(session.messages)}`;

    try {
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
            body: JSON.stringify({
                contents: [{ parts: [{ text: systemPrompt }] }],
                generationConfig: { responseMimeType: "application/json", temperature: 0.4 }
            }),
        });
        if (!geminiRes.ok) throw new Error('Evaluation failed');
        const data = await geminiRes.json();
        const evaluationJson = JSON.parse(data.candidates[0].content.parts[0].text);
        
        const { score, feedback } = evaluationJson;

        const updatedSession = await prisma.interviewSession.update({
            where: { id: sessionId },
            // This is the data structure Prisma expects, now correctly formatted
            data: {
                status: 'COMPLETED',
                score: parseInt(score, 10),
                feedback: feedback,
            },
        });
        return res.status(200).json(updatedSession);
    } catch (error) {
        console.error("Completion Error:", error);
        return res.status(500).json({ error: 'Failed to complete and score the interview.' });
    }
}