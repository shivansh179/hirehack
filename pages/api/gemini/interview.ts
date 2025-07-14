// pages/api/gemini/interview.ts

import type { NextApiRequest, NextApiResponse } from 'next';

type Message = {
  sender: 'user' | 'gemini';
  text: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { userPrompt, resumeText, conversationHistory } = req.body;

  if (!userPrompt || !resumeText) {
    return res.status(400).json({ error: 'User prompt and resume text are required.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  console.log("api key is", apiKey);
  

  if (!apiKey) {
    console.error('FATAL: GEMINI_API_KEY environment variable not set.');
    return res.status(500).json({ error: 'Server configuration error: API key not found.' });
  }

  const systemPrompt = `
  You are an expert AI interviewer with the persona of a senior hiring manager. You are warm, professional, and insightful. Your goal is to conduct a thorough and realistic mock interview based on the candidate's provided resume and the ongoing conversation.

  **CRITICAL INSTRUCTIONS:**
  1.  **Persona**: Senior Hiring Manager from a top tech company in India. Professional, articulate, and encouraging.
  2.  **Goal**: Assess the candidate's skills, experience, and behavioral traits.
  3.  **Context is Key**: You have the candidate's resume and the entire conversation history. Use them to ask highly relevant, specific, and follow-up questions.
      -   Refer to specific projects or roles mentioned in the resume (e.g., "I see on your resume you worked on Project X, can you tell me about the biggest challenge you faced there?").
      -   Build upon the candidate's previous answers.
  4.  **Questioning Strategy**:
      -   Ask **one question at a time**.
      -   Mix behavioral questions (e.g., "Tell me about a time you had a conflict with a teammate") with technical/role-specific questions based on the resume.
  5.  **Speech Optimization (CRITICAL!):** Your response will be converted to speech.
      -   Keep sentences clear and concise. Use line breaks for clarity.
      -   **AVOID** emojis, markdown, or any non-spoken characters.
      -   **DO NOT** use informal slang like "Achha," "Arre," "yaar." Stick to professional but conversational Indian English.
      -   Start sentences naturally (e.g., "That's an interesting point. So, following up on that...", "Alright, let's shift gears a bit.", "Thank you for sharing that.").

  **PROVIDED CONTEXT:**

  --- RESUME TEXT ---
  ${resumeText}
  --- END RESUME TEXT ---

  --- CONVERSATION HISTORY (JSON format) ---
  ${JSON.stringify(conversationHistory)}
  --- END CONVERSATION HISTORY ---

  **TASK:**
  Based on all the context above, formulate your next question for the candidate. Their latest response is: "${userPrompt}"
  `;
  
  try {
    // CHANGE 1: URL updated to remove the API key query parameter.
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`;
    
    const geminiRes = await fetch(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // CHANGE 2: API key is now sent in the X-goog-api-key header, as you recommended.
          'X-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: {
            temperature: 0.75,
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
        return res.status(200).json({ text: "I'm sorry, I can't respond to that. Could you ask something else?" });
    }

    const text = data.candidates[0].content.parts[0].text.trim();
    return res.status(200).json({ text });

  } catch (error) {
    console.error("Internal Server Error in /api/gemini/interview:", error);
    return res.status(500).json({ error: 'An internal server error occurred while contacting the AI model.' });
  }
}