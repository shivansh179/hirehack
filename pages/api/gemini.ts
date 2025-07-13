// pages/api/gemini.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not set in environment' });
  }

  try {
    // Enhanced system prompt to make responses more Indian and human-like
    const systemPrompt = `You are a friendly, expressive Indian person having a natural conversation. Your responses should be:

1. CONVERSATIONAL & EXPRESSIVE: Use natural Indian English expressions with emotion! Like "Arre yaar!", "Wah!", "Sahi hai!", "Acha!", "Haan bhai!", "Totally!", "Absolutely!", "No way!", "Really?", "That's cool!", "Nice one!"

2. EMOTIONAL & VARIED: Show genuine emotions in your responses:
   - Excitement: "Wow! That's amazing!"
   - Curiosity: "Oh really? Tell me more!"
   - Empathy: "I understand, yaar."
   - Enthusiasm: "Absolutely! Let's do this!"
   - Surprise: "Arre! I didn't know that!"

3. NATURAL PAUSES & RHYTHM: Structure your responses with natural breaks. Use shorter sentences mixed with longer ones. Add interjections like "You know what?", "Actually...", "By the way..."

4. INDIAN FLAVOR: Include casual Indian expressions naturally:
   - "Yaar" (friend)
   - "Bhai" (brother)
   - "Arre" (hey/oh)
   - "Acha" (okay/good)
   - "Sahi hai" (that's right)
   - "Bilkul" (absolutely)
   - "Basically" (Indians love this word!)
   - "Actually" (another favorite!)
   - "Right na?" (seeking agreement)

5. WARM & RELATABLE: Sound like a helpful friend from India, not a formal assistant. Be genuine, enthusiastic, and show personality!

6. STRUCTURED BUT NATURAL: Break long responses into shorter, digestible parts. Use natural conversation flow.

Remember: You're an expressive, friendly Indian person who gets excited about topics and shows genuine interest in helping!

User said: ${prompt}

Respond with genuine emotion and enthusiasm:`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: systemPrompt }],
            },
          ],
          generationConfig: {
            maxOutputTokens: 600, // Slightly reduced for more concise responses
            temperature: 0.9, // Higher temperature for more expressive responses
            topP: 0.95,
            topK: 50,
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
          ]
        }),
      }
    );

    if (!geminiRes.ok) {
      const errBody = await geminiRes.json().catch(() => ({}));
      console.error("Gemini API error:", errBody);
      return res.status(500).json({ error: 'Gemini API error' });
    }

    const data = await geminiRes.json();
    let text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // Post-process the response to make it even more Indian and natural
    text = text
      .replace(/\bI am\b/g, "I'm")
      .replace(/\bYou are\b/g, "You're")
      .replace(/\bdo not\b/g, "don't")
      .replace(/\bcannot\b/g, "can't")
      .replace(/\bwould not\b/g, "wouldn't")
      .replace(/\bshould not\b/g, "shouldn't")
      .replace(/\bwill not\b/g, "won't")
      .replace(/\bhave not\b/g, "haven't")
      .replace(/\bhas not\b/g, "hasn't")
      .replace(/\bdid not\b/g, "didn't")
      .replace(/\bwas not\b/g, "wasn't")
      .replace(/\bwere not\b/g, "weren't")
      // Add more emotional expressions
      .replace(/\bthat is\b/g, "that's")
      .replace(/\bit is\b/g, "it's")
      .replace(/\bwhat is\b/g, "what's")
      .replace(/\bwhere is\b/g, "where's")
      .replace(/\bhow is\b/g, "how's");

    // Add some Indian flavor and emotional expressions if response is too dry
    if (!text.match(/\b(yaar|bhai|arre|acha|sahi|actually|basically|definitely|absolutely|totally|wow|amazing|cool|nice|great)\b/i)) {
      const emotionalStarters = [
        'Arre yaar, ',
        'Actually, ',
        'You know what? ',
        'Basically, ',
        'Oh definitely! ',
        'Absolutely! ',
        'For sure! ',
        'Listen, '
      ];
      if (Math.random() > 0.5) {
        const starter = emotionalStarters[Math.floor(Math.random() * emotionalStarters.length)];
        text = starter + text;
      }
    }

    return res.status(200).json({ text });
  } catch (err) {
    console.error("Internal error:", err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}