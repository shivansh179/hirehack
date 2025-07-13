// pages/index.tsx
// A refined Gemini Voice Assistant that speaks in a more human‑like manner with Indian conversational style.
// Key improvements:
// 1. Splits long AI responses into sentences and speaks them sequentially with natural pauses.
// 2. Adds slight, random pitch and rate variation to avoid robotic delivery.
// 3. Keeps the microphone open between sentences so the conversation feels continuous.
// 4. Gracefully degrades if the Web Speech or Speech‑to‑Text APIs are unavailable.
// 5. Cleans up resources when navigating away.
// 6. Enhanced to speak like an Indian human with natural conversational patterns.
// 7. Fixed all TypeScript null reference errors.

'use client';

import { useEffect, useRef, useState } from 'react';

type Status = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

type Message = {
  sender: 'user' | 'gemini';
  text: string;
};

export default function Home() {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const utteranceQueue = useRef<SpeechSynthesisUtterance[]>([]);


  const [audioInit, setAudioInit] = useState(false);

const initAudio = () => {
  window.speechSynthesis.cancel();
  initVoices(); // Now safe after user action
  setAudioInit(true);
};


  /* ------------------------------------------------------------------ */
  /*                             UTILITIES                              */
  /* ------------------------------------------------------------------ */
  const initVoices = () => {
    const systemVoices = window.speechSynthesis.getVoices();
    const preferred =
      systemVoices.find((v) => v.lang.startsWith('en-IN') && /female/i.test(v.name)) ||
      systemVoices.find((v) => v.lang.startsWith('en-IN')) ||
      systemVoices.find((v) => v.lang.startsWith('en-')) ||
      systemVoices[0] ||
      null;
    setVoice(preferred);
  };

  const formatResponse = (text: string) => {
    // Break long paragraphs into shorter, more readable chunks
    const sentences = text.split(/(?<=[.!?])\s+/);
    const formattedSentences = [];
    let currentChunk = [];
    
    for (const sentence of sentences) {
      currentChunk.push(sentence);
      
      // Create a new paragraph every 2-3 sentences or at natural breaks
      if (currentChunk.length >= 2 && (
        sentence.includes('!') || 
        sentence.includes('?') || 
        sentence.includes('basically') || 
        sentence.includes('actually') || 
        sentence.includes('so') ||
        sentence.includes('but') ||
        sentence.includes('however') ||
        sentence.includes('also')
      )) {
        formattedSentences.push(currentChunk.join(' '));
        currentChunk = [];
      } else if (currentChunk.length >= 3) {
        formattedSentences.push(currentChunk.join(' '));
        currentChunk = [];
      }
    }
    
    // Add any remaining sentences
    if (currentChunk.length > 0) {
      formattedSentences.push(currentChunk.join(' '));
    }
    
    return formattedSentences.join('\n\n');
  };

  const splitIntoSentences = (text: string) =>
    text.match(/[^.!?\n]+[.!?\n]?/g) || [text];

  const queueUtterances = (text: string) => {
    utteranceQueue.current = splitIntoSentences(text).map((sentence, index) => {
      const u = new SpeechSynthesisUtterance(sentence.trim());
      if (voice) {
        u.voice = voice;
      }
      
      // Add emotional variation based on sentence content and position
      const sentenceText = sentence.toLowerCase();
      let emotionalAdjustment = { pitch: 0, rate: 0, volume: 0 };
      
      // Excitement/enthusiasm detection
      if (sentenceText.includes('!') || sentenceText.includes('wow') || sentenceText.includes('amazing') || sentenceText.includes('awesome') || sentenceText.includes('great')) {
        emotionalAdjustment = { pitch: 0.2, rate: 0.1, volume: 0.1 };
      }
      // Question/curiosity detection
      else if (sentenceText.includes('?')) {
        emotionalAdjustment = { pitch: 0.15, rate: -0.05, volume: 0.05 };
      }
      // Emphasis words detection
      else if (sentenceText.includes('definitely') || sentenceText.includes('absolutely') || sentenceText.includes('exactly') || sentenceText.includes('totally')) {
        emotionalAdjustment = { pitch: 0.1, rate: -0.1, volume: 0.1 };
      }
      // Casual/friendly detection
      else if (sentenceText.includes('yaar') || sentenceText.includes('bhai') || sentenceText.includes('arre') || sentenceText.includes('acha')) {
        emotionalAdjustment = { pitch: -0.05, rate: 0.05, volume: 0.05 };
      }
      
      // Base settings with emotional adjustments
      u.pitch = Math.max(0.1, Math.min(2.0, 1.0 + (Math.random() - 0.5) * 0.15 + emotionalAdjustment.pitch));
      u.rate = Math.max(0.1, Math.min(2.0, 0.85 + (Math.random() - 0.5) * 0.1 + emotionalAdjustment.rate));
      u.volume = Math.max(0.1, Math.min(1.0, 0.9 + emotionalAdjustment.volume));
      
      // Add natural pauses between sentences
      u.onend = () => {
        setTimeout(speakNextUtterance, index === 0 ? 100 : 300); // Shorter pause for first sentence
      };
      
      return u;
    });
    speakNextUtterance();
  };

  const speakNextUtterance = () => {
    if (utteranceQueue.current.length === 0) {
      // Finished speaking.
      setStatus('idle');
      setTimeout(handleListen, 500); // Small delay before listening again
      return;
    }
    setStatus('speaking');
    window.speechSynthesis.speak(utteranceQueue.current.shift()!);
  };

  /* ------------------------------------------------------------------ */
  /*                           INITIALISATION                           */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsClient(true);

    // Load voices (some browsers fire voiceschanged async).
    window.speechSynthesis.onvoiceschanged = initVoices;
    initVoices();

    // Cleanup on unmount.
    return () => {
      window.speechSynthesis.cancel();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  /* ------------------------------------------------------------------ */
  /*                              SPEECH                                */
  /* ------------------------------------------------------------------ */
  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    utteranceQueue.current = [];
    setStatus('idle');
  };

  

  /* ------------------------------------------------------------------ */
  /*                         GEMINI COMMUNICATION                       */
  /* ------------------------------------------------------------------ */
  const sendToGemini = async (prompt: string) => {
    setMessages((prev) => [...prev, { sender: 'user', text: prompt }]);
    setStatus('thinking');
    try {
      // Enhanced prompt to make Gemini respond like an Indian human
      const enhancedPrompt = `You are a friendly Indian person having a natural conversation. Respond in a warm, conversational way that an Indian would speak. Use expressions like "yaar", "bhai", "actually", "definitely", "no problem", "sure thing", "absolutely", etc. Keep responses natural and not too formal. Be helpful and friendly. Here's what the person said: "${prompt}"`;
      
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: enhancedPrompt }),
      });
      if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
      const { text } = await res.json();
      const formattedText = formatResponse(text);
      setMessages((prev) => [...prev, { sender: 'gemini', text: formattedText }]);
      queueUtterances(text); // Use original text for speech, formatted for display
    } catch (e) {
      console.error(e);
      setError('Could not reach Gemini API.');
      setStatus('error');
    }
  };

  /* ------------------------------------------------------------------ */
  /*                         SPEECH RECOGNITION                         */
  /* ------------------------------------------------------------------ */
  const handleListen = () => {
    if (status !== 'idle') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition not available in this browser.');
      setStatus('error');
      return;
    }

    if (!recognitionRef.current) {
      recognitionRef.current = new SpeechRecognition();
      if (recognitionRef.current) {
        recognitionRef.current.lang = 'en-IN'; // Changed to Indian English
        recognitionRef.current.interimResults = false;
        recognitionRef.current.continuous = false;
        recognitionRef.current.onresult = (e: SpeechRecognitionEvent) => {
          const transcript = e.results[0][0].transcript;
          sendToGemini(transcript);
        };
        recognitionRef.current.onerror = (e: any) => {
          console.error('SpeechRecognition error', e);
          setError('Mic error: ' + e.error);
          setStatus('error');
        };
        recognitionRef.current.onend = () => {
          // Only set to idle if we're still in listening state
          setStatus(prevStatus => prevStatus === 'listening' ? 'idle' : prevStatus);
        };
      }
    }

    if (recognitionRef.current) {
      setError('');
      setStatus('listening');
      recognitionRef.current.start();
    }
  };

  /* ------------------------------------------------------------------ */
  /*                               UI                                   */
  /* ------------------------------------------------------------------ */
  const buttonLabel: Record<Status, string> = {
    idle: 'Ask Gemini',
    listening: 'Listening…',
    thinking: 'Thinking…',
    speaking: 'Speaking…',
    error: 'Retry',
  };

  const statusIndicator = () => {
    switch (status) {
      case 'listening':
        return '🎤 Listening...';
      case 'thinking':
        return '🤔 Thinking...';
      case 'speaking':
        return '🗣️ Speaking...';
      case 'error':
        return '❌ Error';
      default:
        return '💬 Ready to chat';
    }
  };
  if (!isClient || !audioInit) {
    return (
      <main className="flex items-center justify-center min-h-screen bg-black text-white">
        <button
          onClick={initAudio}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-lg font-semibold shadow-lg"
        >
          🎤 Start Assistant
        </button>
      </main>
    );
  }
  

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      <div className="w-full max-w-4xl text-center">
        <h1 className="text-4xl sm:text-6xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-pink-500 to-purple-600">
          🇮🇳 Indian Voice Assistant
        </h1>
        <p className="text-gray-300 mb-2 text-lg">
          Speak naturally — I'll respond like a friendly Indian person!
        </p>
        <p className="text-gray-400 mb-8 text-sm">
          {statusIndicator()}
        </p>

        <div className="flex gap-4 justify-center mb-8">
          <button
            onClick={handleListen}
            disabled={status === 'thinking' || status === 'speaking'}
            className={`px-8 py-4 rounded-full font-semibold text-lg transform transition-all duration-200 ${
              status === 'listening' 
                ? 'bg-red-600 hover:bg-red-700 animate-pulse' 
                : 'bg-blue-600 hover:bg-blue-700'
            } disabled:bg-gray-600 hover:scale-105 shadow-lg`}
          >
            {buttonLabel[status]}
          </button>
          <button
            onClick={stopSpeaking}
            disabled={status !== 'speaking'}
            className="px-8 py-4 bg-red-600 rounded-full font-semibold text-lg hover:bg-red-700 disabled:bg-gray-600 transform hover:scale-105 transition-all duration-200 shadow-lg"
          >
            Stop Speaking
          </button>
        </div>

        <div className="w-full bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 space-y-4 text-left max-h-[60vh] overflow-y-auto border border-gray-700">
          {error && (
            <div className="p-4 bg-red-900/50 border border-red-500 rounded-lg">
              <p className="text-red-300">Error: {error}</p>
            </div>
          )}

          {messages.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <p className="text-lg">👋 Namaste! Click "Ask Gemini" to start chatting</p>
              <p className="text-sm mt-2">I'll respond like a friendly Indian person</p>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={`p-4 rounded-lg transition-all duration-300 ${
                m.sender === 'user' 
                  ? 'bg-blue-600/80 ml-8 border-l-4 border-blue-400' 
                  : 'bg-gray-700/80 mr-8 border-l-4 border-purple-400'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-bold">
                  {m.sender === 'user' ? '👤 You' : '🤖 Gemini'}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date().toLocaleTimeString()}
                </span>
              </div>
              <p className="text-gray-100 leading-relaxed whitespace-pre-line">{m.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 text-center text-gray-500 text-sm">
          <p>💡 Tip: Speak clearly and wait for the response before asking again</p>
        </div>
      </div>
    </main>
  );
}