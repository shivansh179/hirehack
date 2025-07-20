import { NextApiRequest, NextApiResponse } from 'next';
import { spawn } from 'child_process';
import path from 'path';
import { writeFileSync, unlinkSync } from 'fs';
import { existsSync } from 'fs';

interface RequestBody {
  userPrompt: string;
  resumeText: string;
  conversationHistory: Array<{ sender: string; text: string }>;
}

interface ResumeAnalysis {
  experienceLevel: 'junior' | 'mid' | 'senior' | 'lead';
  technologies: string[];
  yearsOfExperience: number;
  currentRole: string;
  keyProjects: string[];
  education: string;
  skills: string[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userPrompt, resumeText, conversationHistory }: RequestBody = req.body;

    console.log('🤖 Custom model API called');
    console.log('📝 User prompt:', userPrompt.substring(0, 100) + '...');
    console.log('📚 Conversation history length:', conversationHistory.length);

    // Validate inputs
    if (!userPrompt || !resumeText) {
      return res.status(400).json({ error: 'Missing required fields: userPrompt or resumeText' });
    }

    // Analyze resume to understand candidate profile
    const resumeAnalysis = analyzeResume(resumeText);
    console.log('📊 Resume analysis:', resumeAnalysis);

    // Get topics already covered to avoid repetition
    const coveredTopics = extractCoveredTopics(conversationHistory);
    console.log('🏷️ Topics covered:', coveredTopics);
    
    // Generate intelligent, contextual prompt
    const modelPrompt = generateIntelligentPrompt(
      userPrompt, 
      resumeText, 
      conversationHistory, 
      resumeAnalysis,
      coveredTopics
    );

    console.log('🎯 Generated prompt for model (first 200 chars):', modelPrompt.substring(0, 200) + '...');

    // Call your Python model
    const modelResponse = await callCustomModel(modelPrompt);
    console.log('🤖 Raw model response:', modelResponse);

    // Clean and validate the response
    const cleanResponse = cleanAndPersonalizeResponse(modelResponse, resumeAnalysis, userPrompt);

    console.log('✅ Final cleaned response:', cleanResponse);

    res.status(200).json({ 
      text: cleanResponse,
      debug: process.env.NODE_ENV === 'development' ? {
        analysis: resumeAnalysis,
        coveredTopics: coveredTopics,
        rawResponse: modelResponse
      } : undefined
    });

  } catch (error) {
    console.error('❌ Custom model API error:', error);
    
    // Provide intelligent fallback even on error
    const fallbackResponse = getEmergencyFallback(req.body?.userPrompt || '');
    
    res.status(200).json({ 
      text: fallbackResponse,
      fallback: true,
      error: process.env.NODE_ENV === 'development' ? error : 'Model temporarily unavailable'
    });
  }
}

function analyzeResume(resumeText: string): ResumeAnalysis {
  const text = resumeText.toLowerCase();
  
  // Extract experience level with more sophisticated detection
  let experienceLevel: 'junior' | 'mid' | 'senior' | 'lead' = 'junior';
  let yearsOfExperience = 0;
  
  // Check for explicit experience indicators
  if (text.includes('senior') || text.includes('lead') || text.includes('principal') || text.includes('staff')) {
    experienceLevel = 'senior';
    yearsOfExperience = 5;
  } else if (text.includes('mid') || text.includes('intermediate')) {
    experienceLevel = 'mid';
    yearsOfExperience = 3;
  } else if (text.includes('lead') || text.includes('manager') || text.includes('architect') || text.includes('head of')) {
    experienceLevel = 'lead';
    yearsOfExperience = 7;
  }
  
  // Extract years of experience from patterns
  const yearPatterns = [
    /(\d+)\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience|exp)/gi,
    /(\d+)\+?\s*(?:years?|yrs?)/gi,
    /(\d{4})\s*[-–]\s*(\d{4})/g, // Date ranges
    /(\d{4})\s*[-–]\s*present/gi
  ];
  
  let maxYears = 0;
  yearPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const numbers = match.match(/\d+/g);
        if (numbers) {
          if (pattern.source.includes('-')) {
            // Date range calculation
            const years = numbers.map(n => parseInt(n));
            if (years.length >= 2) {
              const yearDiff = Math.abs(years[1] - years[0]);
              maxYears = Math.max(maxYears, yearDiff);
            }
          } else {
            // Direct year extraction
            const years = parseInt(numbers[0]);
            maxYears = Math.max(maxYears, years);
          }
        }
      });
    }
  });
  
  if (maxYears > 0) {
    yearsOfExperience = maxYears;
    if (maxYears >= 7) experienceLevel = 'lead';
    else if (maxYears >= 5) experienceLevel = 'senior';
    else if (maxYears >= 2) experienceLevel = 'mid';
  }
  
  // Extract technologies with better categorization
  const techKeywords = [
    // Programming Languages
    'javascript', 'python', 'java', 'typescript', 'go', 'rust', 'swift', 'kotlin', 'c++', 'c#', 'php', 'ruby',
    // Frontend
    'react', 'vue', 'angular', 'svelte', 'next.js', 'nuxt', 'gatsby',
    // Backend
    'node.js', 'express', 'django', 'flask', 'spring', 'rails', 'laravel', 'fastapi',
    // Databases
    'mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch', 'cassandra', 'dynamodb',
    // Cloud & DevOps
    'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'jenkins', 'github actions',
    // Mobile
    'react native', 'flutter', 'ionic', 'xamarin'
  ];
  
  const technologies = techKeywords.filter(tech => text.includes(tech.toLowerCase()));
  
  // Extract current role with better detection
  const roleKeywords = [
    'software engineer', 'developer', 'programmer', 'architect', 'manager', 'lead',
    'analyst', 'designer', 'consultant', 'specialist', 'scientist', 'researcher'
  ];
  const currentRole = roleKeywords.find(role => text.includes(role)) || 'professional';
  
  // Extract key projects
  const projectIndicators = ['project', 'built', 'developed', 'created', 'designed', 'implemented', 'led'];
  const keyProjects = projectIndicators.filter(indicator => text.includes(indicator));
  
  // Extract education
  const educationKeywords = [
    'bachelor', 'master', 'phd', 'degree', 'computer science', 'engineering', 
    'bootcamp', 'certification', 'diploma'
  ];
  const education = educationKeywords.find(edu => text.includes(edu)) || '';
  
  // Extract skills
  const skillKeywords = [
    'leadership', 'teamwork', 'communication', 'problem solving', 'agile', 'scrum',
    'testing', 'debugging', 'optimization', 'security', 'performance'
  ];
  const skills = skillKeywords.filter(skill => text.includes(skill));
  
  return {
    experienceLevel,
    technologies: technologies.slice(0, 8), // Limit to top 8
    yearsOfExperience,
    currentRole,
    keyProjects,
    education,
    skills
  };
}

function extractCoveredTopics(conversationHistory: Array<{ sender: string; text: string }>): string[] {
  const topics = new Set<string>();
  
  conversationHistory.forEach(msg => {
    if (msg.sender === 'gemini') { // interviewer questions
      const text = msg.text.toLowerCase();
      
      // More comprehensive topic detection
      if (text.includes('project') || text.includes('build') || text.includes('develop')) topics.add('projects');
      if (text.includes('challenge') || text.includes('difficult') || text.includes('problem')) topics.add('challenges');
      if (text.includes('team') || text.includes('collaboration') || text.includes('work with')) topics.add('teamwork');
      if (text.includes('technology') || text.includes('tech') || text.includes('framework')) topics.add('technology');
      if (text.includes('experience') || text.includes('background')) topics.add('experience');
      if (text.includes('yourself') || text.includes('tell me about')) topics.add('background');
      if (text.includes('strength') || text.includes('skill') || text.includes('good at')) topics.add('strengths');
      if (text.includes('goal') || text.includes('future') || text.includes('plan')) topics.add('goals');
      if (text.includes('learn') || text.includes('growth') || text.includes('improve')) topics.add('learning');
      if (text.includes('debug') || text.includes('solve') || text.includes('approach')) topics.add('problem-solving');
      if (text.includes('lead') || text.includes('mentor') || text.includes('manage')) topics.add('leadership');
      if (text.includes('decision') || text.includes('choose') || text.includes('why')) topics.add('decision-making');
    }
  });
  
  return Array.from(topics);
}

function generateIntelligentPrompt(
  userPrompt: string, 
  resumeText: string, 
  conversationHistory: Array<{ sender: string; text: string }>,
  analysis: ResumeAnalysis,
  coveredTopics: string[]
): string {
  
  // Build conversation context (last 6 messages for context)
  const recentHistory = conversationHistory.slice(-6);
  const conversationContext = recentHistory
    .map(msg => {
      const role = msg.sender === 'user' ? 'Candidate' : 'Interviewer';
      const cleanText = msg.text.replace(/^\[(Custom|Gemini)\]\s*/, '');
      return `${role}: ${cleanText}`;
    })
    .join('\n');

  // Generate level-appropriate instructions
  const levelInstructions = {
    junior: 'Ask about learning experiences, basic concepts, growth mindset, and potential. Focus on curiosity, problem-solving approach, and eagerness to learn. Avoid overly complex architectural questions.',
    mid: 'Ask about specific implementations, technical decisions, project contributions, and problem-solving approaches. Explore how they handle complexity and work with others.',
    senior: 'Ask about architecture decisions, leadership experiences, complex technical challenges, mentoring, and system design. Focus on strategic thinking and technical leadership.',
    lead: 'Ask about strategic decisions, team leadership, technical vision, business impact, and organizational influence. Focus on high-level thinking and cross-functional collaboration.'
  };

  // Suggest next topic areas to explore (prioritize uncovered topics)
  const allTopics = ['projects', 'challenges', 'teamwork', 'technology', 'strengths', 'goals', 'learning', 'problem-solving', 'leadership', 'decision-making'];
  const uncoveredTopics = allTopics.filter(topic => !coveredTopics.includes(topic));
  const nextTopic = uncoveredTopics[0] || 'follow-up';

  // Create specific examples based on their background
  const techStack = analysis.technologies.slice(0, 3).join(', ') || 'programming';
  
  return `<|system|>
You are an experienced technical interviewer conducting a personalized interview. Ask exactly ONE specific, engaging follow-up question.

CANDIDATE PROFILE:
- Experience Level: ${analysis.experienceLevel.toUpperCase()} (${analysis.yearsOfExperience} years)
- Role: ${analysis.currentRole}
- Key Technologies: ${techStack}
- Education: ${analysis.education || 'Technical background'}

INTERVIEW CONTEXT:
Recent Conversation:
${conversationContext}

Topics Already Covered: ${coveredTopics.join(', ') || 'None yet'}
Focus Area: ${nextTopic}

CANDIDATE'S LATEST RESPONSE:
"${userPrompt}"

INSTRUCTIONS FOR ${analysis.experienceLevel.toUpperCase()} LEVEL:
${levelInstructions[analysis.experienceLevel]}

CRITICAL REQUIREMENTS:
1. Ask exactly ONE question (not multiple options)
2. Reference their specific response or background
3. Be conversational and encouraging
4. Avoid generic questions like "tell me about yourself"
5. Focus on ${nextTopic} if not extensively covered
6. Match complexity to ${analysis.experienceLevel} level

GOOD QUESTION EXAMPLES:
- "That's interesting! How did you handle [specific challenge] when working with ${analysis.technologies[0] || 'that technology'}?"
- "Can you walk me through your thought process when you [reference their specific response]?"
- "What was the most challenging aspect of [specific detail from their response]?"

<|user|>
Based on my response, what's your next interview question?
<|assistant|>
`;
}

function cleanAndPersonalizeResponse(response: string, analysis: ResumeAnalysis, userPrompt: string): string {
  let cleaned = response
    .replace(/<\|assistant\|>/g, '')
    .replace(/<\|user\|>/g, '')
    .replace(/<\|system\|>/g, '')
    .replace(/^(Interviewer:|Assistant:|Question:|Based on your response,?)/gi, '')
    .trim();

  // Remove common problematic patterns
  const problematicPatterns = [
    /can't say until further notice/gi,
    /stay tuned/gi,
    /i don't have enough information/gi,
    /please provide more details/gi,
    /i need more context/gi,
    /i apologize but/gi,
    /i'm sorry but/gi,
    /unfortunately/gi,
    /here are some follow.?up questions/gi,
    /some possible questions/gi,
    /you.*consider.*asking/gi,
    /based on your response.*here are/gi
  ];

  const hasProblematicPattern = problematicPatterns.some(pattern => pattern.test(cleaned));

  // Clean up list patterns and take only first question
  if (cleaned.includes('\n') || cleaned.includes('•') || cleaned.includes(' - ')) {
    const lines = cleaned.split(/\n|•|-/).filter(line => line.trim().length > 10);
    if (lines.length > 0) {
      cleaned = lines[0].trim();
    }
  }

  // Remove numbered questions and take first
  const questionMatch = cleaned.match(/^\d+\.?\s*(.+?)(?:\d+\.|$)/);
  if (questionMatch) {
    cleaned = questionMatch[1].trim();
  }

  // If response is still problematic, use intelligent fallback
  if (hasProblematicPattern || 
      cleaned.length < 15 || 
      cleaned.toLowerCase().includes('technical interviewer') ||
      cleaned.toLowerCase().includes('multiple') ||
      cleaned.toLowerCase().includes('several') ||
      cleaned.includes('?') && cleaned.split('?').length > 2) { // Multiple questions
    
    return getIntelligentFallback(analysis, userPrompt);
  }

  // Ensure it's a question
  if (!cleaned.match(/[.!?]$/)) {
    cleaned += '?';
  }

  // Final validation - if still too short or generic, use fallback
  if (cleaned.length < 20 || cleaned.toLowerCase().includes('tell me about')) {
    return getIntelligentFallback(analysis, userPrompt);
  }

  return cleaned;
}

function getIntelligentFallback(analysis: ResumeAnalysis, userPrompt?: string): string {
  const { experienceLevel, technologies, currentRole, yearsOfExperience } = analysis;
  
  // Context-aware fallbacks based on user input
  if (userPrompt) {
    const lowerInput = userPrompt.toLowerCase();
    
    if (lowerInput.includes('project') || lowerInput.includes('built') || lowerInput.includes('developed')) {
      return `That sounds like an interesting project! What was the most challenging technical decision you had to make during development?`;
    } else if (lowerInput.includes('team') || lowerInput.includes('collaborate')) {
      return `How did you handle any disagreements or different approaches within the team?`;
    } else if (lowerInput.includes('learn') || lowerInput.includes('new')) {
      return `What was your strategy for getting up to speed quickly with that new technology?`;
    } else if (lowerInput.includes('problem') || lowerInput.includes('issue') || lowerInput.includes('bug')) {
      return `Can you walk me through your debugging process for that issue?`;
    }
  }
  
  // Level-specific fallbacks
  const fallbacks = {
    junior: [
      `What's been the most challenging concept you've had to learn in ${technologies[0] || 'programming'} so far?`,
      `How do you typically approach a problem when you're stuck during development?`,
      `What resources do you find most helpful when learning new technologies?`,
      `Can you describe a time when you had to ask for help, and how you made sure you understood the solution?`
    ],
    mid: [
      `With your ${yearsOfExperience} years of experience, how has your approach to code reviews evolved?`,
      `Can you describe a time when you had to refactor legacy code? What was your strategy?`,
      `How do you balance writing perfect code with meeting project deadlines?`,
      `What's a technical decision you made that you later realized could have been done better?`
    ],
    senior: [
      `As a senior ${currentRole}, how do you mentor junior developers who are struggling with complex concepts?`,
      `Can you describe an architectural decision you made that had significant impact on the project?`,
      `How do you evaluate whether to build a solution in-house versus using a third-party library?`,
      `What's your approach to technical debt - how do you prioritize it against new features?`
    ],
    lead: [
      `How do you communicate technical trade-offs to non-technical stakeholders?`,
      `Can you describe a time when you had to advocate for a technical approach that seemed risky to the business?`,
      `How do you foster a culture of technical excellence while maintaining delivery velocity?`,
      `What's your philosophy on balancing innovation with stability in a production system?`
    ]
  };
  
  const options = fallbacks[experienceLevel] || fallbacks.mid;
  return options[Math.floor(Math.random() * options.length)];
}

function getEmergencyFallback(userPrompt: string): string {
  const emergency = [
    "That's a great point! Can you elaborate on the most challenging aspect of that experience?",
    "Interesting! What would you do differently if you had to approach that situation again?",
    "Can you walk me through your thought process when you were working on that?",
    "What was the outcome of that project, and what did you learn from it?",
    "How did that experience influence your approach to similar challenges?"
  ];
  
  return emergency[Math.floor(Math.random() * emergency.length)];
}

async function callCustomModel(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const tempFile = path.join(process.cwd(), `temp_prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.txt`);
    
    try {
      writeFileSync(tempFile, prompt);
    } catch (err) {
      reject(new Error(`Failed to write temp file: ${err}`));
      return;
    }

    const pythonScript = path.join(process.cwd(), 'python_scripts', 'model_inference.py');
    
    // Try multiple Python paths for better compatibility
    const possiblePythonPaths = [
      path.join(process.cwd(), 'venv', 'bin', 'python'),
      path.join(process.cwd(), '.venv', 'bin', 'python'),
      path.join(process.cwd(), 'venv', 'bin', 'python3'),
      'python3',
      'python',
    ];
    
    let pythonPath = 'python3'; // Default fallback
    
    // Find the first Python path that exists
    for (const pyPath of possiblePythonPaths) {
      if (pyPath.startsWith('/') && existsSync(pyPath)) {
        pythonPath = pyPath;
        console.log(`✅ Found Python at: ${pythonPath}`);
        break;
      } else if (!pyPath.startsWith('/')) {
        pythonPath = pyPath;
        break;
      }
    }
    
    console.log('🐍 Using Python path:', pythonPath);
    console.log('📜 Using script:', pythonScript);
    
    // Verify script exists
    if (!existsSync(pythonScript)) {
      reject(new Error(`Python script not found at: ${pythonScript}`));
      return;
    }
    
    const pythonProcess = spawn(pythonPath, [pythonScript, tempFile], {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONPATH: process.cwd() },
      timeout: 30000 // 30 second timeout
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
        console.error('Python script error (code ' + code + '):', errorOutput);
        reject(new Error(`Model inference failed (exit code ${code}): ${errorOutput}`));
      } else {
        console.log('Python script debug output:', errorOutput);
        const trimmedOutput = output.trim();
        if (trimmedOutput.length === 0) {
          reject(new Error('Empty output from Python script'));
        } else {
          resolve(trimmedOutput);
        }
      }
    });

    pythonProcess.on('error', (error) => {
      console.error('Failed to start Python process:', error);
      reject(new Error(`Failed to start Python process: ${error.message}. Python path: ${pythonPath}`));
    });

    // Cleanup on timeout
    setTimeout(() => {
      if (pythonProcess.exitCode === null) {
        pythonProcess.kill('SIGTERM');
        reject(new Error('Model inference timeout (30s)'));
      }
    }, 30000);
  });
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '2mb', // Increased for larger resumes
    },
  },
};