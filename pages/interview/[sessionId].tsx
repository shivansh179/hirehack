'use client';

import { GetServerSideProps } from 'next';
import { prisma } from '../../lib/prisma';
import { useEffect, useRef, useState, useCallback } from 'react';
import { verifyJwtToken } from '../../lib/auth';
import { useRouter } from 'next/router';
import { InterviewHeader } from '../../components/InterviewHeader';
import { StatusIndicator } from '../../components/StatusIndicator';
import { ChatBubble } from '../../components/ChatBubble';
import { Button } from '../../components/ui/Button';
import { CheckCircle, Settings, Mic, MicOff } from 'lucide-react';

// Global type declarations
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}
 


type Status = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error' | 'finishing';
type Message = {
  id: string;
  sender: 'user' | 'gemini';
  text: string;
  timestamp: number;
    
};
type InterviewProps = {
  sessionId: string;
  initialMessages: Message[];
  resumeText: string;
  userEmail: string;
  error?: string;
};

export default function InterviewPage({ sessionId, initialMessages, resumeText, userEmail, error: serverError }: InterviewProps) {
    const [status, setStatus] = useState<Status>('idle');
    const [error, setError] = useState<string>(serverError || '');
    const [messages, setMessages] = useState<Message[]>(initialMessages || []);
    const [isClient, setIsClient] = useState(false);
    const [useCustomModel, setUseCustomModel] = useState(false);
    const [showModelSettings, setShowModelSettings] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [interimTranscript, setInterimTranscript] = useState('');
    
    const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const utteranceQueue = useRef<SpeechSynthesisUtterance[]>([]);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    // Helper function to generate unique IDs
    const generateMessageId = () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Helper function to clean problematic responses
    const cleanResponseText = useCallback((text: string): string => {
        // Remove model indicators
        let cleaned = text.replace(/^\[(Custom|Gemini)\]\s*/, '');
        
        // Fix common problematic responses
        const problematicPatterns = [
            /can't say until further notice/gi,
            /stay tuned/gi,
            /i don't have enough information/gi,
            /please provide more details/gi,
            /i need more context/gi,
            /i apologize but/gi,
            /i'm sorry but/gi,
            /unfortunately/gi
        ];
        
        const hasProblematicPattern = problematicPatterns.some(pattern => pattern.test(cleaned));
        
        if (hasProblematicPattern || cleaned.length < 20) {
            return getContextualFallback();
        }
        
        return cleaned;
    }, []);

    // Provide contextual fallbacks based on the situation
    const getContextualFallback = useCallback((): string => {
        const fallbacks = [
            "That's interesting! Can you tell me more about the challenges you faced in that role?",
            "I'd love to hear more details about that experience. What was your specific contribution?",
            "Can you walk me through your thought process when working on that project?",
            "What technologies did you use, and why did you choose them?",
            "How did you overcome any obstacles you encountered?",
            "What would you do differently if you had to tackle that challenge again?",
            "Can you describe a specific example of how you implemented that solution?",
            "What was the most rewarding aspect of that work?"
        ];
        
        return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }, []);

    // Provide intelligent fallbacks for errors
    const getIntelligentFallback = useCallback((userInput: string): string => {
        const lowerInput = userInput.toLowerCase();
        
        if (lowerInput.includes('project') || lowerInput.includes('build') || lowerInput.includes('develop')) {
            return "That sounds like an interesting project! Can you walk me through the technical challenges you faced?";
        } else if (lowerInput.includes('team') || lowerInput.includes('collaborate')) {
            return "Teamwork is crucial in development. How do you handle disagreements or conflicts in technical decisions?";
        } else if (lowerInput.includes('learn') || lowerInput.includes('study')) {
            return "Continuous learning is important. What's the most challenging concept you've had to master recently?";
        } else if (lowerInput.includes('experience') || lowerInput.includes('work')) {
            return "Can you tell me about a specific accomplishment from your work experience that you're proud of?";
        } else {
            return "That's a great point! Can you elaborate on how that experience has shaped your approach to problem-solving?";
        }
    }, []);

    const saveConversation = useCallback(async (updatedMessages: Message[]) => {
        try {
            const messagesToSave = updatedMessages.map(msg => ({
                sender: msg.sender,
                text: msg.text
            }));
            
            await fetch('/api/interview/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, messages: messagesToSave }),
            });
            console.log('✅ Conversation saved successfully');
        } catch (e) {
            console.error('❌ Failed to save conversation:', e);
            setError("Warning: Could not save progress.");
        }
    }, [sessionId]);

    const sendToModel = useCallback(async (prompt: string) => {
        if (!prompt.trim()) {
            setError('Please say something before sending.');
            return;
        }

        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) {
                console.warn('Error stopping speech recognition:', e);
            }
        }
        
        setStatus('thinking');
        setError('');
        setInterimTranscript('');
        
        const newUserMessage: Message = { 
            id: generateMessageId(),
            sender: 'user', 
            text: prompt,
            timestamp: Date.now()
        };
        
        // Add user message immediately for better UX
        setMessages(prevMessages => {
            const updatedMessages = [...prevMessages, newUserMessage];
            
            // Call API asynchronously
            callAPIAsync(prompt, updatedMessages);
            
            return updatedMessages;
        });

        async function callAPIAsync(userPrompt: string, currentMessages: Message[]) {
            try {
                const apiEndpoint = useCustomModel ? '/api/custom-model/interview' : '/api/gemini/interview';
                
                console.log(`🤖 Using ${useCustomModel ? 'Custom Model' : 'Gemini'} for response generation`);
                
                // Prepare conversation history for API
                const conversationHistory = currentMessages.slice(0, -1).map(msg => ({
                    sender: msg.sender,
                    text: msg.text
                }));

                const requestBody = {
                    userPrompt: userPrompt, 
                    resumeText, 
                    conversationHistory,
                };

                console.log('📤 Sending request:', {
                    userPrompt: userPrompt.substring(0, 50) + '...',
                    historyLength: conversationHistory.length
                });
                
                const res = await fetch(apiEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody),
                });
                
                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || `${useCustomModel ? 'Custom Model' : 'Gemini'} API Error`);
                }
                
                const { text: responseText } = await res.json();
                
                if (!responseText || responseText.trim().length === 0) {
                    throw new Error('Empty response from AI model');
                }
                
                console.log('📥 Raw API response:', responseText.substring(0, 100) + '...');
                
                // Clean the response if it's problematic
                const cleanedResponse = cleanResponseText(responseText);
                
                console.log('✨ Cleaned response:', cleanedResponse);
                
                // Add model indicator for debugging
                const modelIndicator = useCustomModel ? '[Custom] ' : '[Gemini] ';
                const finalResponse = process.env.NODE_ENV === 'development' ? modelIndicator + cleanedResponse : cleanedResponse;
                
                const assistantMessage: Message = {
                    id: generateMessageId(),
                    sender: 'gemini',
                    text: finalResponse,
                    timestamp: Date.now()
                };
                
                // Update messages with assistant response
                setMessages(prevMessages => {
                    const newMessages = [...prevMessages, assistantMessage];
                    
                    // Save conversation asynchronously
                    setTimeout(() => saveConversation(newMessages), 100);
                    
                    return newMessages;
                });
                
                // Speak the response (without debug indicator)
                queueAndSpeak(cleanedResponse);
                
                setStatus('idle');
                
            } catch (e: any) {
                console.error('❌ Model API Error:', e);
                const errorMessage = e.message || 'Sorry, I ran into a problem. Please try again.';
                setError(errorMessage);
                
                // Provide intelligent fallback instead of just error message
                const fallbackResponse = getIntelligentFallback(userPrompt);
                
                const errorMsg: Message = {
                    id: generateMessageId(),
                    sender: 'gemini',
                    text: `[Error Recovery] ${fallbackResponse}`,
                    timestamp: Date.now()
                };
                
                setMessages(prevMessages => [...prevMessages, errorMsg]);
                queueAndSpeak(fallbackResponse);
                setStatus('idle');
            }
        }
        
    }, [resumeText, useCustomModel, cleanResponseText, getIntelligentFallback, saveConversation]);

    const handleListen = useCallback(() => {
        if (status === 'thinking' || status === 'speaking' || status === 'finishing') {
            setError('Please wait for the AI to finish responding.');
            return;
        }

        const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognitionAPI) {
            setError('Sorry, your browser does not support Speech Recognition. Please use Chrome or Safari.');
            setStatus('error');
            return;
        }

        if (!recognitionRef.current) {
            const recognition = new SpeechRecognitionAPI();
            recognition.lang = 'en-US';
            recognition.interimResults = true;
            recognition.continuous = false;
            recognition.maxAlternatives = 1;
            
            recognition.onstart = () => {
                console.log('🎤 Speech recognition started');
                setStatus('listening');
                setIsListening(true);
                setError('');
                setInterimTranscript('');
            };
            
            recognition.onresult = (event: SpeechRecognitionEvent) => {
                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript;
                    } else {
                        interimTranscript += transcript;
                    }
                }

                setInterimTranscript(interimTranscript);

                if (finalTranscript) {
                    console.log('✅ Final transcript:', finalTranscript);
                    recognition.stop();
                    setInterimTranscript('');
                    sendToModel(finalTranscript.trim());
                }
            };
            
            recognition.onerror = (event: any) => {
                console.error('❌ Speech recognition error:', event.error);
                setIsListening(false);
                setStatus('idle');
                setInterimTranscript('');
                
                if (event.error === 'no-speech') {
                    setError('No speech detected. Please try speaking again.');
                } else if (event.error === 'not-allowed') {
                    setError('Microphone access denied. Please allow microphone permissions.');
                } else {
                    setError(`Speech recognition error: ${event.error}. Please try again.`);
                }
            };
            
            recognition.onend = () => {
                console.log('🔇 Speech recognition ended');
                setIsListening(false);
                if (status === 'listening') {
                    setStatus('idle');
                }
                setInterimTranscript('');
            };
            
            recognitionRef.current = recognition;
        }

        try {
            if (recognitionRef.current) {
                recognitionRef.current.start();
            } else {
                throw new Error('Speech recognition not initialized');
            }
        } catch (e: any) {
            console.error('Failed to start speech recognition:', e);
            setStatus('error');
            setError('Could not start microphone. Please check permissions.');
        }
    }, [status, sendToModel]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) {
                console.warn('Error stopping speech recognition:', e);
            }
        }
        setIsListening(false);
        setStatus('idle');
        setInterimTranscript('');
    }, []);

    const speakNextUtterance = useCallback(() => {
        if (utteranceQueue.current.length > 0) {
            const utterance = utteranceQueue.current.shift();
            if (utterance) {
                setStatus('speaking');
                if (voiceRef.current) utterance.voice = voiceRef.current;
                window.speechSynthesis.speak(utterance);
            }
        } else {
            setStatus('idle');
        }
    }, []);

    const queueAndSpeak = useCallback((text: string) => {
        // Remove model indicators for speech
        const cleanTextForSpeech = text.replace(/^\[(Custom|Gemini|Error Recovery)\]\s*/, '');
        
        const cleanText = cleanTextForSpeech.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]|\*)/g, '').trim();
        if (!cleanText) return;
        
        const sentences = cleanText.match(/[^.!?\n]+[.!?\n]?/g) || [cleanText];
        window.speechSynthesis.cancel();
        utteranceQueue.current = sentences.map((sentence) => {
            const u = new SpeechSynthesisUtterance(sentence.trim());
            u.pitch = 1.0;
            u.rate = 0.9;
            u.onend = speakNextUtterance;
            return u;
        });
        speakNextUtterance();
    }, [speakNextUtterance]);

    const finishInterview = async () => {
        setStatus('finishing');
        setError('');
        window.speechSynthesis.cancel();
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) {
                console.warn('Error stopping speech recognition during finish:', e);
            }
        }
        try {
            const res = await fetch('/api/interview/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId }),
            });
            if (!res.ok) throw new Error('Failed to score interview');
            router.push(`/interview/${sessionId}/results`);
        } catch (err) {
            setError('Could not finalize your interview. Please try again.');
            setStatus('error');
        }
    };

    const toggleModelSettings = () => {
        setShowModelSettings(!showModelSettings);
    };

    const switchToGemini = () => {
        setUseCustomModel(false);
        setError('');
        setShowModelSettings(false);
    };

    const switchToCustomModel = () => {
        setUseCustomModel(true);
        setError('');
        setShowModelSettings(false);
    };

    useEffect(() => {
        setIsClient(true);
        const setVoice = () => {
            const systemVoices = window.speechSynthesis.getVoices();
            voiceRef.current =
                systemVoices.find((v) => v.lang === 'en-US' && /female/i.test(v.name)) ||
                systemVoices.find((v) => v.lang.startsWith('en-GB') && /female/i.test(v.name)) ||
                systemVoices.find((v) => v.lang.startsWith('en-US')) ||
                null;
        };
        window.speechSynthesis.onvoiceschanged = setVoice;
        setVoice();
        
        // Auto-start with first message if available
        if (initialMessages && initialMessages.length > 0) {
            const lastMessage = initialMessages[initialMessages.length - 1];
            if (lastMessage.sender === 'gemini') {
                setTimeout(() => queueAndSpeak(lastMessage.text), 1000);
            }
        }
    }, [initialMessages, queueAndSpeak]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    const stopAll = () => {
        window.speechSynthesis.cancel();
        utteranceQueue.current = [];
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) {
                console.warn('Error stopping speech recognition in stopAll:', e);
            }
        }
        setStatus('idle');
        setIsListening(false);
        setInterimTranscript('');
    };

    // Error handling for server errors
    if (serverError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-8">
                <p className="text-red-400 text-xl mb-4">{serverError}</p>
                <Button onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
            </div>
        )
    }

    // Loading state
    if (!isClient) {
        return <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white animate-pulse">Loading Interview...</div>
    }

    return (
        <main className="flex flex-col h-screen bg-gradient-to-br from-gray-900 via-purple-950 to-black text-white font-sans">
            {/* Header */}
            <InterviewHeader userEmail={userEmail} />
            
            {/* Status Indicator */}
            <div className="flex-grow flex-col justify-center items-center">
                <StatusIndicator status={status} />
                
                {/* Show interim transcript while listening */}
                {interimTranscript && (
                    <div className="text-center mt-4 p-3 bg-blue-900/30 rounded-lg max-w-md mx-auto">
                        <p className="text-blue-300 text-sm">Listening: "{interimTranscript}"</p>
                    </div>
                )}
            </div>

            {/* Chat Messages */}
            <div ref={chatContainerRef} className="flex-grow p-4 md:p-6 space-y-6 overflow-y-auto max-h-96">
                {messages.map((msg) => (
                    <ChatBubble key={msg.id} message={msg} />
                ))}
                
                {/* Show when AI is thinking */}
                {status === 'thinking' && (
                    <div className="flex justify-start">
                        <div className="bg-gray-700 rounded-lg p-4 max-w-xs">
                            <div className="flex items-center space-x-2">
                                <div className="animate-bounce w-2 h-2 bg-gray-400 rounded-full"></div>
                                <div className="animate-bounce w-2 h-2 bg-gray-400 rounded-full" style={{animationDelay: '0.1s'}}></div>
                                <div className="animate-bounce w-2 h-2 bg-gray-400 rounded-full" style={{animationDelay: '0.2s'}}></div>
                                <span className="text-gray-400 text-sm ml-2">
                                    {useCustomModel ? 'Custom AI' : 'Gemini'} is thinking...
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Model Settings Panel */}
            {showModelSettings && (
                <div className="bg-gray-800/95 backdrop-blur-sm border-t border-gray-700/50 p-4">
                    <div className="max-w-2xl mx-auto">
                        <h3 className="text-lg font-semibold mb-3">🤖 AI Model Settings</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${!useCustomModel ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 hover:border-gray-500'}`}
                                 onClick={switchToGemini}>
                                <h4 className="font-semibold text-blue-400">Gemini AI</h4>
                                <p className="text-sm text-gray-400 mt-1">Google's advanced conversational AI</p>
                                <div className="mt-2">
                                    <span className="text-xs bg-green-600 px-2 py-1 rounded">Stable</span>
                                    <span className="text-xs bg-blue-600 px-2 py-1 rounded ml-2">Fast</span>
                                </div>
                            </div>
                            <div className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${useCustomModel ? 'border-purple-500 bg-purple-500/10' : 'border-gray-600 hover:border-gray-500'}`}
                                 onClick={switchToCustomModel}>
                                <h4 className="font-semibold text-purple-400">🎯 Your Custom Model</h4>
                                <p className="text-sm text-gray-400 mt-1">Fine-tuned resume-based interviewer</p>
                                <div className="mt-2">
                                    <span className="text-xs bg-purple-600 px-2 py-1 rounded">Specialized</span>
                                    <span className="text-xs bg-orange-600 px-2 py-1 rounded ml-2">Your Training</span>
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 text-center">
                            <Button variant="secondary" onClick={toggleModelSettings}>
                                Close Settings
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Footer Controls */}
            <footer className="flex-shrink-0 p-4 bg-gray-900/30 backdrop-blur-sm border-t border-gray-700/50">
                {/* Error Message */}
                {error && (
                    <div className="text-center mb-3">
                        <p className="text-red-400 text-sm">{error}</p>
                        {useCustomModel && error.includes('Custom Model') && (
                            <Button 
                                variant="secondary" 
                                onClick={switchToGemini}
                                className="mt-2 text-xs"
                            >
                                Switch to Gemini
                            </Button>
                        )}
                    </div>
                )}

                {/* Model Status Indicator */}
                <div className="text-center mb-2">
                    <span className="text-xs text-gray-500">
                        Using: <span className={useCustomModel ? 'text-purple-400 font-semibold' : 'text-blue-400'}>
                            {useCustomModel ? '🎯 Your Custom Model' : '🔷 Gemini AI'}
                        </span>
                    </span>
                </div>

                {/* Main Controls */}
                <div className="flex items-center justify-center gap-4 relative">
                    {/* Left Side Controls */}
                    <div className="absolute left-4 sm:left-8 flex items-center gap-2">
                        <Button 
                            onClick={finishInterview} 
                            disabled={status === 'finishing' || status === 'thinking'} 
                            variant="secondary"
                        >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            {status === 'finishing' ? 'Finalizing...' : 'Finish'}
                        </Button>
                        
                        <Button
                            onClick={toggleModelSettings}
                            variant="secondary"
                            className="p-2"
                            title="AI Model Settings"
                        >
                            <Settings className="h-4 w-4" />
                        </Button>
                    </div>
                    
                    {/* Center Microphone */}
                    <button
                        onClick={isListening ? stopListening : handleListen}
                        disabled={status === 'thinking' || status === 'finishing'}
                        className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 transform focus:outline-none focus:ring-4 relative
                        ${isListening ? 'bg-red-600 animate-pulse ring-red-500/50' : 'bg-blue-600 hover:bg-blue-500 ring-blue-500/50'} 
                        disabled:bg-gray-600 disabled:cursor-not-allowed`}
                    >
                        {isListening ? <Mic className="h-8 w-8 text-white" /> : <MicOff className="h-8 w-8 text-white" />}
                        
                        {/* Model indicator on mic button */}
                        {!isListening && (
                            <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold ${
                                useCustomModel ? 'bg-purple-600' : 'bg-blue-600'
                            }`}>
                                {useCustomModel ? '🎯' : 'G'}
                            </div>
                        )}
                    </button>
                    
                    {/* Right Side Controls */}
                    <div className="absolute right-4 sm:right-8">
                        <Button 
                            onClick={stopAll} 
                            disabled={status === 'idle'} 
                            variant="danger"
                        >
                            🤫 Stop All
                        </Button>
                    </div>
                </div>
                
                {/* Instructions */}
                <div className="text-center mt-3">
                    <p className="text-gray-500 text-xs">
                        💡 Click mic to speak • Click ⚙️ for AI settings • Click finish when done
                    </p>
                    {status === 'listening' && (
                        <p className="text-green-400 text-xs mt-1">
                            🎤 Listening... Speak clearly
                        </p>
                    )}
                    {status === 'thinking' && (
                        <p className="text-yellow-400 text-xs mt-1">
                            🤔 {useCustomModel ? 'Your Custom AI' : 'Gemini'} is generating response...
                        </p>
                    )}
                    {status === 'speaking' && (
                        <p className="text-blue-400 text-xs mt-1">
                            🔊 AI is speaking... Click "Stop All" to interrupt
                        </p>
                    )}
                </div>
            </footer>
        </main>
    );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
    const token = ctx.req.cookies.token;
    const verifiedToken = await verifyJwtToken(token);
    if (!verifiedToken?.userId) {
        return { redirect: { destination: '/sign-in', permanent: false } };
    }
    const { sessionId } = ctx.params as { sessionId: string };

    const session = await prisma.interviewSession.findFirst({
        where: { id: sessionId },
        include: { resume: { select: { userId: true, resumeText: true } } }
    });
    
    if (!session || session.resume.userId !== verifiedToken.userId) {
        return { redirect: { destination: '/dashboard', permanent: false } };
    }
    
    if (session.status === 'COMPLETED') {
        return { redirect: { destination: `/interview/${sessionId}/results`, permanent: false } };
    }
    
    try {
        // Convert database messages to proper format with IDs
      const initialMessages = Array.isArray(session?.messages)
  ? (session.messages as Message[]).map((msg, index) => ({
      id: `init_${index}_${Date.now()}`,
      sender: msg.sender,
      text: msg.text,
      timestamp: Date.now() - ((session.messages as Message[]).length - index) * 1000,
    }))
  : [];



        return {
            props: JSON.parse(JSON.stringify({
                sessionId: session.id,
                initialMessages,
                resumeText: session.resume.resumeText,
                userEmail: verifiedToken.email,
            }))
        };
    } catch (error) {
        return { props: { error: 'Failed to load interview session from the database.' } };
    }
};