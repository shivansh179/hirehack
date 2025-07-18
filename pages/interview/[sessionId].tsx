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
import { CheckCircle } from 'lucide-react';

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
    const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const utteranceQueue = useRef<SpeechSynthesisUtterance[]>([]);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    const sendToGemini = useCallback(async (prompt: string) => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        setStatus('thinking');
        setError('');
        const newMessages = [...messages, { sender: 'user', text: prompt } as Message];
        setMessages(newMessages);

        try {
            const res = await fetch('/api/gemini/interview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userPrompt: prompt, resumeText, conversationHistory: newMessages, }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'API Error');
            }
            const { text: geminiText } = await res.json();
            const finalMessages = [...newMessages, { sender: 'gemini', text: geminiText } as Message];
            setMessages(finalMessages);
            queueAndSpeak(geminiText);
            await saveConversation(finalMessages);
        } catch (e: any) {
            const errorMessage = e.message || 'Sorry, I ran into a problem. Please try again.';
            setError(errorMessage);
            setMessages((prev) => [...prev, { sender: 'gemini', text: errorMessage }]);
            setStatus('error');
        }
    }, [messages, resumeText]);

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
                sendToGemini(transcript);
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
    }, [status, sendToGemini]);

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
        const cleanText = text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]|\*)/g, '').trim();
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
        if (recognitionRef.current) { // FIX: Check if ref exists before calling stop
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
        if (initialMessages.length === 1) {
            setTimeout(() => queueAndSpeak(initialMessages[0].text), 1000);
        }
    }, []);

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

    if (serverError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-8">
                <p className="text-red-400 text-xl mb-4">{serverError}</p>
                <Button onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
            </div>
        )
    }

    if (!isClient) {
        return <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white animate-pulse">Loading Interview...</div>
    }

    return (
        <main className="flex flex-col h-screen bg-gradient-to-br from-gray-900 via-purple-950 to-black text-white font-sans">
            <InterviewHeader userEmail={userEmail} />
            <div className="flex-grow flex-col justify-center items-center"><StatusIndicator status={status} /></div>

            <div ref={chatContainerRef} className="flex-grow p-4 md:p-6 space-y-6 overflow-y-auto">
                {messages.map((msg, i) => <ChatBubble key={i} message={msg} />)}
            </div>

            <footer className="flex-shrink-0 p-4 bg-gray-900/30 backdrop-blur-sm border-t border-gray-700/50">
                {error && <p className="text-center text-red-400 mb-2 text-sm">{error}</p>}
                <div className="flex items-center justify-center gap-4 relative">
                    <Button onClick={finishInterview} disabled={status === 'finishing' || status === 'thinking'} variant="secondary" className="absolute left-4 sm:left-8">
                        <CheckCircle className="mr-2 h-4 w-4" />
                        {status === 'finishing' ? 'Finalizing...' : 'Finish'}
                    </Button>
                    
                    <button
                        onClick={handleMicClick}
                        disabled={status === 'thinking' || status === 'finishing' || status === 'speaking'}
                        className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl transition-all duration-300 transform focus:outline-none focus:ring-4
                        ${status === 'listening' ? 'bg-red-600 animate-pulse ring-red-500/50' : 'bg-blue-600 hover:bg-blue-500 ring-blue-500/50'} 
                        disabled:bg-gray-600 disabled:cursor-not-allowed`}
                    >
                        {status === 'listening' ? '🎤' : '🎙️'}
                    </button>
                    
                    <Button onClick={stopAll} disabled={!['speaking', 'listening'].includes(status)} variant="danger" className="absolute right-4 sm:right-8">
                        🤫
                    </Button>
                </div>
                <p className="text-center text-gray-500 text-xs mt-3">💡 Click the mic to speak. Click finish when you're done.</p>
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