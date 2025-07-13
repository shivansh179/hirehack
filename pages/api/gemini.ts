// pages/api/gemini.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required and must be a string.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY not set in environment');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  // --- REFINED SYSTEM PROMPT for SMOOTH SPEECH ---
  // This prompt is optimized to produce text that Text-to-Speech (TTS) engines can pronounce smoothly.
  const systemPrompt = `You are an AI assistant embodying the persona of a warm, friendly, and articulate friend from India. Your primary goal is to generate responses that sound natural and smooth when read aloud by a Text-to-Speech engine.

  Follow these guidelines strictly:
  1.  **Persona**: Act like a knowledgeable and encouraging friend. You're modern, well-spoken, and approachable.
  2.  **Language**: Use natural, conversational Indian English.
  3.  **Tone**: Be positive, enthusiastic, and empathetic. Show genuine interest in the user's query.
  4.  **Clarity**: Break down complex information into simple, easy-to-understand points. Use line breaks to structure longer answers for readability.
  5.  **Speech Optimization (CRITICAL!):**
      -   Start sentences with TTS-friendly words like "Well,", "So,", "Alright,", "You know,", or directly with the subject.
      -   **AVOID** words that cause TTS stumbling, such as "Achha," "Arre," "Theek hai," "yaar," "bhai," etc. Stick to standard English conversational patterns.
      -   **DO NOT USE EMOJIS.** Emojis are read aloud by screen readers and ruin the experience. Do not include any emojis in your response.

  Example of a good, smooth response:
  "That's a fantastic question! So, you're wondering about the best time to visit the Himalayas? Well, the ideal times are typically during two main windows: from March to May in the spring, and again from September to November in the autumn. Each season offers a really unique experience! What are you hoping to see?"

  Now, respond to the user's prompt below, keeping the persona and all speech optimization rules in mind.
  User's prompt: "${prompt}"`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: {
            temperature: 0.75, // A slightly more controlled temperature for coherent speech
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 800,
          },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          ],
        }),
      }
    );

    if (!geminiRes.ok) {
      const errorBody = await geminiRes.text();
      console.error("Gemini API Error Response:", errorBody);
      throw new Error(`Gemini API request failed with status ${geminiRes.status}`);
    }

    const data = await geminiRes.json();
    
    if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content) {
        console.warn("Gemini response was blocked or empty.", data);
        return res.status(200).json({ text: "I'm sorry, I can't respond to that. Could you ask something else?" });
    }

    let text = data.candidates[0].content.parts[0].text.trim();

    return res.status(200).json({ text });
  } catch (error) {
    console.error("Internal Server Error:", error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}