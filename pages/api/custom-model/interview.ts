import { NextApiRequest, NextApiResponse } from 'next';
import { spawn } from 'child_process';
import path from 'path';
import { writeFileSync, unlinkSync } from 'fs';

interface RequestBody {
  userPrompt: string;
  resumeText: string;
  conversationHistory: Array<{ sender: string; text: string }>;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userPrompt, resumeText, conversationHistory }: RequestBody = req.body;

    console.log('🤖 Custom model API called for:', userPrompt.substring(0, 50) + '...');

    // Create context from conversation history
    const context = conversationHistory
      .slice(-4) // Last 4 messages for context
      .map(msg => `${msg.sender === 'user' ? 'Candidate' : 'Interviewer'}: ${msg.text}`)
      .join('\n');

    // Format prompt for your resume-based model
    const modelPrompt = formatPromptForModel(userPrompt, resumeText, context);

    // Call your Python model
    const modelResponse = await callCustomModel(modelPrompt);

    // Process and clean the response
    const cleanResponse = cleanModelResponse(modelResponse);

    console.log('✅ Custom model response:', cleanResponse.substring(0, 100) + '...');

    res.status(200).json({ text: cleanResponse });

  } catch (error) {
    console.error('❌ Custom model API error:', error);
    res.status(500).json({ error: 'Failed to generate response from custom model: ' + error });
  }
}

function formatPromptForModel(userPrompt: string, resumeText: string, context: string): string {
  return `<|system|>
You are an experienced technical interviewer. Ask thoughtful, specific questions based on the candidate's resume and previous conversation.

Candidate's Resume:
${resumeText}

Previous Conversation:
${context}

Guidelines:
- Ask ONE specific question at a time
- Focus on experience mentioned in resume
- Be professional and encouraging
- Ask follow-up questions based on previous answers
- Keep questions concise (1-2 sentences max)

<|user|>
${userPrompt}
<|assistant|>
`;
}

async function callCustomModel(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Create temporary file for the prompt
    const tempFile = path.join(process.cwd(), `temp_prompt_${Date.now()}.txt`);
    
    try {
      writeFileSync(tempFile, prompt);
    } catch (err) {
      reject(new Error(`Failed to write temp file: ${err}`));
      return;
    }

    // Path to your Python inference script
    const pythonScript = path.join(process.cwd(), 'python_scripts', 'model_inference.py');
    
    // Use virtual environment Python
    const venvPython = path.join(process.cwd(), 'venv', 'bin', 'python');
    
    console.log('🐍 Using Python:', venvPython);
    console.log('📜 Using script:', pythonScript);
    
    const pythonProcess = spawn(venvPython, [pythonScript, tempFile], {
      cwd: process.cwd()
    });

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    pythonProcess.on('close', (code) => {
      // Clean up temp file
      try {
        unlinkSync(tempFile);
      } catch (e) {
        console.warn('Could not delete temp file:', e);
      }

      if (code !== 0) {
        console.error('Python script error:', errorOutput);
        reject(new Error(`Model inference failed (code ${code}): ${errorOutput}`));
      } else {
        console.log('Python script debug output:', errorOutput);
        resolve(output.trim());
      }
    });

    pythonProcess.on('error', (error) => {
      console.error('Failed to start Python process:', error);
      reject(new Error(`Failed to start Python process: ${error.message}`));
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      pythonProcess.kill();
      reject(new Error('Model inference timeout'));
    }, 30000);
  });
}

function cleanModelResponse(response: string): string {
  // Clean up common model artifacts
  let cleaned = response
    .replace(/<\|assistant\|>/g, '')
    .replace(/<\|user\|>/g, '')
    .replace(/<\|system\|>/g, '')
    .replace(/^(Interviewer:|Assistant:)/gi, '')
    .trim();

  // Take the first complete sentence
  const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length > 0) {
    cleaned = sentences[0].trim();
    if (!cleaned.match(/[.!?]$/)) {
      cleaned += '?';
    }
  }

  // Fallback if response is too short
  if (cleaned.length < 15) {
    return "Could you tell me more about that experience from your background?";
  }

  return cleaned;
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
