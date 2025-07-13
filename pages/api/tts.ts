import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { ssml } = req.body as { ssml?: string };
  if (!ssml) return res.status(400).json({ error: 'SSML is required' });

  const gcpKey = process.env.GOOGLE_TTS_KEY;
  if (!gcpKey) return res.status(500).json({ error: 'GOOGLE_TTS_KEY not set' });

  try {
    const gRes = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${gcpKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { ssml },
          voice: {
            languageCode: 'en-IN',
            name: 'en-IN-Neural2-A', // expressive Indian English voice
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 0.93,
          },
        }),
      },
    );
    if (!gRes.ok) throw new Error('TTS API error');
    const { audioContent } = await gRes.json();
    res.status(200).json({ audioContent }); // base64 MP3
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'TTS failure' });
  }
}
