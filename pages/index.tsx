// // pages/index.tsx
// 'use client';

// import { useEffect, useRef, useState, useCallback } from 'react';

// // Define the types for our application state
// type Status = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';
// type Message = {
//   sender: 'user' | 'gemini';
//   text: string;
// };

// // --- Helper Components ---

// const StatusIndicator = ({ status }: { status: Status }) => {
//   const statusInfo = {
//     idle: { icon: '💬', text: 'Ready to Chat', color: 'text-gray-400' },
//     listening: { icon: '🎤', text: 'Listening...', color: 'text-blue-400' },
//     thinking: { icon: '🤔', text: 'Thinking...', color: 'text-purple-400' },
//     speaking: { icon: '🗣️', text: 'Speaking...', color: 'text-orange-400' },
//     error: { icon: '❌', text: 'Error', color: 'text-red-400' },
//   };
//   const current = statusInfo[status];
//   return <p className={`text-sm ${current.color}`}>{current.icon} {current.text}</p>;
// };

// const ChatBubble = ({ message }: { message: Message }) => {
//   const isUser = message.sender === 'user';
//   return (
//     <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
//       <div
//         className={`p-4 rounded-2xl max-w-lg md:max-w-2xl transition-all duration-300 ${
//           isUser
//             ? 'bg-blue-600 rounded-br-none'
//             : 'bg-gray-700 rounded-bl-none'
//         }`}
//       >
//         <p className="text-white leading-relaxed whitespace-pre-wrap">{message.text}</p>
//       </div>
//     </div>
//   );
// };

// // --- Main Component ---

// export default function Home() {
//   const [status, setStatus] = useState<Status>('idle');
//   const [error, setError] = useState<string>('');
//   const [messages, setMessages] = useState<Message[]>([]);
//   const [isClient, setIsClient] = useState<boolean>(false);
//   const [audioReady, setAudioReady] = useState<boolean>(false);
//   // **NEW**: State to control the continuous conversation loop
//   const [isContinuousMode, setIsContinuousMode] = useState<boolean>(true);

//   const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
//   const recognitionRef = useRef<SpeechRecognition | null>(null);
//   const utteranceQueue = useRef<SpeechSynthesisUtterance[]>([]);
//   const chatContainerRef = useRef<HTMLDivElement>(null);

//   // --- Core Logic ---

//   useEffect(() => {
//     setIsClient(true);
//     return () => {
//       window.speechSynthesis.cancel();
//       if (recognitionRef.current) {
//         recognitionRef.current.abort();
//       }
//     };
//   }, []);
  
//   useEffect(() => {
//     if (chatContainerRef.current) {
//         chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
//     }
//   }, [messages]);
  
//   const handleStartAssistant = useCallback(() => {
//     const setVoice = () => {
//       const systemVoices = window.speechSynthesis.getVoices();
//       voiceRef.current =
//         systemVoices.find((v) => v.lang === 'en-IN' && /female/i.test(v.name)) ||
//         systemVoices.find((v) => v.lang === 'en-IN') ||
//         systemVoices.find((v) => v.lang.startsWith('en-GB') && /female/i.test(v.name)) ||
//         systemVoices.find((v) => v.lang.startsWith('en-US') && /female/i.test(v.name)) ||
//         systemVoices.find((v) => v.lang.startsWith('en-')) ||
//         null;
//     };
    
//     window.speechSynthesis.onvoiceschanged = setVoice;
//     setVoice();
//     window.speechSynthesis.speak(new SpeechSynthesisUtterance(''));
//     setAudioReady(true);
//   }, []);

//   // Forward declaration for mutual recursion
//   const handleListen = useCallback(() => {
//     if (status !== 'idle' && status !== 'error') return;

//     const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
//     if (!SpeechRecognitionAPI) {
//       setError('Sorry, your browser does not support Speech Recognition.');
//       setStatus('error');
//       return;
//     }

//     if (!recognitionRef.current) {
//         const recognition = new SpeechRecognitionAPI();
//         recognition.lang = 'en-IN';
//         recognition.interimResults = false;
//         recognition.continuous = false;

//         recognition.onresult = (event: SpeechRecognitionEvent) => {
//             const transcript = event.results[0][0].transcript;
//             sendToGemini(transcript);
//         };
//         recognition.onerror = (event: any) => {
//             console.error('SpeechRecognition error:', event.error);
//             setError(`Mic error: ${event.error}. Please check permissions.`);
//             setStatus('error');
//         };
//         recognition.onend = () => {
//             setStatus((prev) => (prev === 'listening' ? 'idle' : prev));
//         };
//         recognitionRef.current = recognition;
//     }

//     setStatus('listening');
//     recognitionRef.current?.start();
//   }, [status]); // Dependencies updated below

//   const speakNextUtterance = useCallback(() => {
//     if (utteranceQueue.current.length > 0) {
//       setStatus('speaking');
//       const utterance = utteranceQueue.current.shift();
//       if (utterance) {
//         window.speechSynthesis.speak(utterance);
//       }
//     } else {
//       // **NEW**: Continuous conversation logic
//       if (isContinuousMode) {
//         // Natural pause before listening again
//         setTimeout(() => handleListen(), 500);
//       } else {
//         setStatus('idle');
//       }
//     }
//   }, [isContinuousMode, handleListen]); // Added dependencies

//   const queueAndSpeak = useCallback((text: string) => {
//     const cleanText = text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim();
//     const sentences = cleanText.match(/[^.!?\n]+[.!?\n]?/g) || [cleanText];
    
//     utteranceQueue.current = sentences.map((sentence) => {
//       const u = new SpeechSynthesisUtterance(sentence.trim());
//       if (voiceRef.current) u.voice = voiceRef.current;
//       u.pitch = 1.0;
//       u.rate = 1.0;
//       u.onend = () => setTimeout(speakNextUtterance, 250);
//       return u;
//     });
    
//     speakNextUtterance();
//   }, [speakNextUtterance]);

//   const sendToGemini = useCallback(async (prompt: string) => {
//     setMessages((prev) => [...prev, { sender: 'user', text: prompt }]);
//     setStatus('thinking');
//     setError('');

//     try {
//       const res = await fetch('/api/gemini', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ prompt }),
//       });
//       if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
//       const { text } = await res.json();
//       setMessages((prev) => [...prev, { sender: 'gemini', text }]);
//       queueAndSpeak(text);
//     } catch (e: any) {
//       console.error(e);
//       const errorMessage = 'Sorry, I ran into a problem. Please try again.';
//       setError(errorMessage);
//       setMessages((prev) => [...prev, { sender: 'gemini', text: errorMessage }]);
//       setStatus('error');
//     }
//   }, [queueAndSpeak]);

//   // Update handleListen dependencies
//   useEffect(() => {
//     // This is a common pattern to manage useCallback dependencies when functions call each other
//   }, [sendToGemini]);

//   const stopSpeaking = () => {
//     window.speechSynthesis.cancel();
//     utteranceQueue.current = [];
//     setStatus('idle');
//   };

//   // **NEW**: Centralized handler for the microphone button
//   const handleMicClick = () => {
//     if (status === 'speaking') {
//       // This is the "Barge-in" feature. Stop speaking and start listening immediately.
//       window.speechSynthesis.cancel();
//       utteranceQueue.current = [];
//       handleListen();
//     } else if (status === 'listening') {
//       // If already listening, clicking again cancels it.
//       recognitionRef.current?.stop();
//       setStatus('idle');
//     } else {
//       // If idle or error, start listening.
//       handleListen();
//     }
//   };
  
//   // --- UI Rendering ---

//   if (!isClient) return null; 
  
//   if (!audioReady) {
//     return (
//       <main className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
//         <div className="text-center p-8">
//             <h1 className="text-4xl sm:text-5xl font-bold mb-4">🇮🇳 Gemini Indian Voice Assistant</h1>
//             <p className="text-gray-300 mb-8">Click below to start the conversation.</p>
//             <button
//               onClick={handleStartAssistant}
//               className="px-8 py-4 bg-blue-600 hover:bg-blue-700 rounded-full text-lg font-semibold shadow-lg transform hover:scale-105 transition-transform"
//             >
//               🎤 Start Assistant
//             </button>
//         </div>
//       </main>
//     );
//   }

//   return (
//     <main className="flex flex-col h-screen bg-gradient-to-br from-gray-900 via-purple-950 to-black text-white font-sans">
//       <header className="flex-shrink-0 p-4 text-center border-b border-gray-700/50">
//         <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-pink-500">
//           Indian Voice Assistant
//         </h1>
//         <StatusIndicator status={status} />
//       </header>

//       <div ref={chatContainerRef} className="flex-grow p-4 md:p-6 space-y-6 overflow-y-auto">
//         {messages.length === 0 ? (
//             <div className="text-center py-16 text-gray-500">
//               <p className="text-lg">👋 Namaste!</p>
//               <p>Click the button below and ask me anything.</p>
//             </div>
//         ) : (
//             messages.map((msg, i) => <ChatBubble key={i} message={msg} />)
//         )}
//       </div>

//       <footer className="flex-shrink-0 p-4 bg-gray-900/30 backdrop-blur-sm border-t border-gray-700/50">
//          {error && <p className="text-center text-red-400 mb-2 text-sm">{error}</p>}
//         <div className="flex items-center justify-center gap-4">
//             <button
//                 onClick={handleMicClick}
//                 disabled={status === 'thinking'} // Only disable while thinking
//                 className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl transition-all duration-300 transform focus:outline-none focus:ring-4
//                 ${status === 'listening' ? 'bg-red-600 animate-pulse ring-red-500/50' 
//                 : status === 'speaking' ? 'bg-orange-600 ring-orange-500/50' 
//                 : 'bg-blue-600 hover:bg-blue-500 ring-blue-500/50'} 
//                 disabled:bg-gray-600 disabled:cursor-not-allowed`}
//             >
//                 {status === 'listening' ? '🎤' : '🎙️'}
//             </button>
//              <button
//                 onClick={stopSpeaking}
//                 disabled={status !== 'speaking'}
//                 className="w-20 h-20 bg-red-700 rounded-full flex items-center justify-center text-3xl transition-all duration-300 transform hover:bg-red-600 focus:outline-none focus:ring-4 focus:ring-red-500/50 disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
//              >
//                🤫
//             </button>
//         </div>
//         <div className="flex items-center justify-center mt-4 space-x-2 text-sm text-gray-400">
//           <label htmlFor="continuous-mode" className="cursor-pointer">Continuous Conversation</label>
//           <input
//             id="continuous-mode"
//             type="checkbox"
//             checked={isContinuousMode}
//             onChange={(e) => setIsContinuousMode(e.target.checked)}
//             className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-600 ring-offset-gray-800 focus:ring-2 cursor-pointer"
//           />
//         </div>
//         <p className="text-center text-gray-500 text-xs mt-2">💡 Tip: Click the mic while I'm speaking to interrupt.</p>
//       </footer>
//     </main>
//   );
// }


import Link from 'next/link';
import { useEffect } from 'react';


export default function Home() {


  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-black text-white p-8">
      <div className="text-center">
        <h1 className="text-5xl md:text-6xl font-extrabold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
          AI Mock Interviewer
        </h1>
        <p className="text-lg md:text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
          Upload your resume, and practice your interview skills with a realistic AI that asks questions based on your experience.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/sign-in">
              <div className="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-full text-lg font-semibold shadow-lg transform hover:scale-105 transition-all">
                Get Started
              </div>
            </Link>
        </div>
      </div>
    </main>
  );
}