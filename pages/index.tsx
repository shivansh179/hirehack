'use client';

import { useEffect, useRef, useState } from 'react';

type Status = "idle" | "listening" | "thinking" | "speaking" | "error";

type Message = {
  sender: "user" | "gemini";
  text: string;
};

export default function Home() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    setIsClient(true);

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();

      console.log("Available voices:", voices.map(v => `${v.name} (${v.lang})`));

      const preferredVoice = voices.find(
        (v) =>
          v.name.toLowerCase().includes("female") ||
          v.name.toLowerCase().includes("zira") ||
          v.name.toLowerCase().includes("google uk") ||
          v.lang.toLowerCase().includes("en-in") ||
          v.lang.toLowerCase().includes("hi-in")
      );

      setVoice(preferredVoice || voices[0] || null);
    };

    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
      loadVoices();
    }
  }, []);

  const speak = (text: string) => {
    if (!isClient) return;

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);

    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }

    utterance.pitch = 1.2;
    utterance.rate = 0.95;

    utterance.onend = () => {
      setStatus("idle");
      handleListen(); // 👈 Continue conversation flow
    };

    utterance.onerror = (event) => {
      console.error("SpeechSynthesis Error:", event);
      setError("Error during speech synthesis.");
      setStatus("error");
    };

    setStatus("speaking");
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (isClient && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setStatus("idle");
    }
  };

  const sendToGemini = async (prompt: string) => {
    if (!prompt) return;

    setStatus("thinking");
    setMessages((prev) => [...prev, { sender: "user", text: prompt }]);

    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) throw new Error(`API error: ${res.statusText}`);

      const data = await res.json();
      const aiResponse = data.text;

      setMessages((prev) => [...prev, { sender: "gemini", text: aiResponse }]);
      speak(aiResponse);
    } catch (err: any) {
      console.error("Gemini error:", err);
      setError("Connection issue. Please try again.");
      setStatus("error");
    }
  };

  const handleListen = () => {
    if (status === "listening" || status === "thinking" || status === "speaking") return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser.");
      setStatus("error");
      return;
    }

    if (!recognitionRef.current) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        sendToGemini(transcript);
      };

      recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("SpeechRecognition Error:", event.error);
        if (event.error === 'no-speech' || event.error === 'audio-capture') {
          setStatus("idle");
        } else {
          setError("An error occurred during speech recognition.");
          setStatus("error");
        }
      };

      recognitionRef.current.onend = () => {};
    }

    setError("");
    setStatus("listening");
    recognitionRef.current.start();
  };

  const getButtonText = () => {
    switch (status) {
      case "listening": return "Listening...";
      case "thinking": return "Thinking...";
      case "speaking": return "Speaking...";
      default: return "Ask Gemini";
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-900 text-white font-sans">
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-5xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
          Gemini Voice Assistant
        </h1>
        <p className="text-gray-400 mb-8">
          Ask anything — the assistant will keep the conversation going.
        </p>

        <div className="mb-6 flex gap-4 justify-center">
          <button
            onClick={handleListen}
            disabled={status === "thinking" || status === "speaking"}
            className="px-6 py-3 bg-blue-600 rounded-full font-semibold hover:bg-blue-700 disabled:bg-gray-500 transform hover:scale-105"
          >
            {getButtonText()}
          </button>

          <button
            onClick={stopSpeaking}
            disabled={!isClient || !window.speechSynthesis.speaking}
            className="px-6 py-3 bg-red-600 rounded-full font-semibold hover:bg-red-700 disabled:bg-gray-500 transform hover:scale-105"
          >
            Stop
          </button>
        </div>

        <div className="w-full bg-gray-800 rounded-lg p-6 space-y-4 text-left max-h-[50vh] overflow-y-auto">
          {error && <p className="text-red-400"><strong>Error:</strong> {error}</p>}

          {messages.map((msg, idx) => (
            <div key={idx} className={`p-3 rounded-lg ${msg.sender === 'user' ? 'bg-blue-600 text-white self-end' : 'bg-gray-700 text-white self-start'}`}>
              <strong>{msg.sender === 'user' ? 'You' : 'Gemini'}:</strong> {msg.text}
            </div>
          ))}

          {status === 'thinking' && <div className="text-lg text-blue-400 animate-pulse">Thinking...</div>}
        </div>
      </div>
    </main>
  );
}
