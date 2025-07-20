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
import { CheckCircle, Settings } from 'lucide-react';

type Status = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error' | 'finishing';
type Message = {
  sender: 'user' | 'gemini';
  text: string;
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
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [isClient, setIsClient] = useState(false);
    const [useCustomModel, setUseCustomModel] = useState(false);
    const [showModelSettings, setShowModelSettings] = useState(false);
    
    const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const utteranceQueue = useRef<SpeechSynthesisUtterance[]>([]);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    const sendToModel = useCallback(async (prompt: string) => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        setStatus('thinking');
        setError('');
        const newMessages = [...messages, { sender: 'user', text: prompt } as Message];
        setMessages(newMessages);

        try {
            // Choose API endpoint based on model selection
            const apiEndpoint = useCustomModel ? '/api/custom-model/interview' : '/api/gemini/interview';
            
            console.log(`Using ${useCustomModel ? 'Custom Model' : 'Gemini'} for response generation`);
            
            const res = await fetch(apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userPrompt: prompt, 
                    resumeText, 
                    conversationHistory: newMessages,
                }),
            });
            
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || `${useCustomModel ? 'Custom Model' : 'Gemini'} API Error`);
            }
            
            const { text: responseText } = await res.json();
            
            // Add model indicator to the response for debugging
            const modelIndicator = useCustomModel ? '[Custom] ' : '[Gemini] ';
            const finalResponse = process.env.NODE_ENV === 'development' ? modelIndicator + responseText : responseText;
            
            const finalMessages = [...newMessages, { sender: 'gemini', text: finalResponse } as Message];
            setMessages(finalMessages);
            queueAndSpeak(responseText); // Speak without the indicator
            await saveConversation(finalMessages);
            
        } catch (e: any) {
            console.error('Model API Error:', e);
            const errorMessage = e.message || 'Sorry, I ran into a problem. Please try again.';
            setError(errorMessage);
            
            // If custom model fails, offer fallback to Gemini
            if (useCustomModel && e.message.includes('Custom Model')) {
                setError(errorMessage + ' Would you like to switch to Gemini?');
            }
            
            setMessages((prev) => [...prev, { sender: 'gemini', text: errorMessage }]);
            setStatus('error');
        }
    }, [messages, resumeText, useCustomModel]);

    const handleListen = useCallback(() => {
        if (status === 'listening' || status === 'thinking' || status === 'speaking') {
            return;
        }
        const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognitionAPI) {
            setError('Sorry, your browser does not support Speech Recognition.');
            setStatus('error');
            return;
        }
        if (!recognitionRef.current) {
            const recognition = new SpeechRecognitionAPI();
            recognition.lang = 'en-IN';
            recognition.interimResults = false;
            recognition.continuous = false;
            recognition.onresult = (event: SpeechRecognitionEvent) => {
                const transcript = event.results[0][0].transcript;
                sendToModel(transcript);
            };
            recognition.onerror = (event: any) => {
                if (event.error !== 'no-speech') {
                    setError(`Mic error: ${event.error}. Please check permissions.`);
                    setStatus('error');
                }
            };
            recognition.onend = () => {
                setStatus((prev) => (prev === 'listening' ? 'idle' : prev));
            };
            recognitionRef.current = recognition;
        }
        try {
            setStatus('listening');
            recognitionRef.current?.start();
        } catch (e) {
            setStatus('error');
            setError('Could not start microphone.')
        }
    }, [status, sendToModel]);

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
        const cleanTextForSpeech = text.replace(/^\[(Custom|Gemini)\]\s*/, '');
        
        const cleanText = cleanTextForSpeech.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]|\*)/g, '').trim();
        if (!cleanText) return;
        const sentences = cleanText.match(/[^.!?\n]+[.!?\n]?/g) || [cleanText];
        window.speechSynthesis.cancel();
        utteranceQueue.current = sentences.map((sentence) => {
            const u = new SpeechSynthesisUtterance(sentence.trim());
            u.pitch = 1.0;
            u.rate = 1.0;
            u.onend = speakNextUtterance;
            return u;
        });
        speakNextUtterance();
    }, [speakNextUtterance]);

    const saveConversation = useCallback(async (updatedMessages: Message[]) => {
        try {
            await fetch('/api/interview/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, messages: updatedMessages }),
            });
        } catch (e) {
            setError("Warning: Could not save progress.");
        }
    }, [sessionId]);

    const finishInterview = async () => {
        setStatus('finishing');
        setError('');
        window.speechSynthesis.cancel();
        if (recognitionRef.current) {
            recognitionRef.current.stop();
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
                systemVoices.find((v) => v.lang === 'en-IN' && /female/i.test(v.name)) ||
                systemVoices.find((v) => v.lang.startsWith('en-GB') && /female/i.test(v.name)) ||
                systemVoices.find((v) => v.lang.startsWith('en-US') && /female/i.test(v.name)) ||
                null;
        };
        window.speechSynthesis.onvoiceschanged = setVoice;
        setVoice();
        
        // Auto-start with first message if available
        if (initialMessages.length === 1) {
            setTimeout(() => queueAndSpeak(initialMessages[0].text), 1000);
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
            recognitionRef.current.stop();
        }
        setStatus('idle');
    };

    const handleMicClick = () => {
        if (status === 'speaking') {
            stopAll();
        } else if (status === 'listening') {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        } else {
            handleListen();
        }
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
            </div>

            {/* Chat Messages */}
            <div ref={chatContainerRef} className="flex-grow p-4 md:p-6 space-y-6 overflow-y-auto">
                {messages.map((msg, i) => <ChatBubble key={i} message={msg} />)}
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
                        onClick={handleMicClick}
                        disabled={status === 'thinking' || status === 'finishing'}
                        className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl transition-all duration-300 transform focus:outline-none focus:ring-4 relative
                        ${status === 'listening' ? 'bg-red-600 animate-pulse ring-red-500/50' : 'bg-blue-600 hover:bg-blue-500 ring-blue-500/50'} 
                        disabled:bg-gray-600 disabled:cursor-not-allowed`}
                    >
                        {status === 'listening' ? '🎤' : '🎙️'}
                        
                        {/* Model indicator on mic button */}
                        {status !== 'listening' && (
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
                            disabled={!['speaking', 'listening'].includes(status)} 
                            variant="danger"
                        >
                            🤫 Stop
                        </Button>
                    </div>
                </div>
                
                {/* Instructions */}
                <div className="text-center mt-3">
                    <p className="text-gray-500 text-xs">
                        💡 Click mic to speak • Click ⚙️ for AI settings • Click finish when done
                    </p>
                    {status === 'thinking' && (
                        <p className="text-yellow-400 text-xs mt-1">
                            🤔 {useCustomModel ? 'Your Custom AI' : 'Gemini'} is thinking...
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
        return {
            props: JSON.parse(JSON.stringify({
                sessionId: session.id,
                initialMessages: session.messages,
                resumeText: session.resume.resumeText,
                userEmail: verifiedToken.email,
            }))
        };
    } catch (error) {
        return { props: { error: 'Failed to load interview session from the database.' } };
    }
};