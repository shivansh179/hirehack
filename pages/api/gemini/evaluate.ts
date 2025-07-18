import type { NextApiRequest, NextApiResponse } from 'next';

const systemPrompt = `
You are an expert hiring manager and an interview evaluation specialist. Your task is to analyze the provided interview transcript and provide a score and constructive feedback.

**EVALUATION CRITERIA:**
1.  **Clarity & Conciseness:** Was the candidate's communication clear and to the point?
2.  **Relevance:** Were the answers relevant to the questions asked?
3.  **STAR Method (for behavioral questions):** Did the candidate effectively use the Situation, Task, Action, Result method to structure their answers about past experiences?
4.  **Confidence & Professionalism:** Assess the overall tone and professionalism conveyed through the candidate's language.

**INPUT:**
You will receive a JSON object containing the full interview transcript.

**OUTPUT FORMAT (CRITICAL):**
You MUST respond with ONLY a valid JSON object, with no extra text or explanations. The JSON object should have the following structure:
{
  "score": <an integer between 1 and 10>,
  "feedback": "<A paragraph of constructive feedback for the candidate, highlighting strengths and areas for improvement. Be encouraging but honest. Keep it to 3-4 sentences.>"
}

**EXAMPLE OUTPUT:**
{
  "score": 7,
  "feedback": "You demonstrate strong passion for the field and communicate your ideas clearly. To improve, try structuring your answers to behavioral questions using the STAR method; this will help provide more concrete evidence of your accomplishments. Also, consider elaborating more on the specific technical challenges you faced in your projects."
}

Now, evaluate the following transcript.
`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { transcript } = req.body;
    if (!transcript) {
        return res.status(400).json({ error: 'Transcript is required.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'Server configuration error.' });
    }

    const fullPrompt = `${systemPrompt}\n\nTRANSCRIPT:\n${JSON.stringify(transcript, null, 2)}`;

    try {
        const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-goog-api-key': apiKey,
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: fullPrompt }] }],
                    generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
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
            throw new Error(`Gemini API Error: ${geminiRes.status} ${errorBody}`);
        }

        const data = await geminiRes.json();
        const evaluationText = data.candidates[0].content.parts[0].text;
        const evaluationJson = JSON.parse(evaluationText);
        
        return res.status(200).json(evaluationJson);

    } catch (error) {
        console.error("Evaluation Error:", error);
        return res.status(500).json({ error: 'Failed to evaluate interview.' });
    }
}