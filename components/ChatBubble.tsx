// components/ChatBubble.tsx
import React from 'react';

type Message = {
    sender: 'user' | 'gemini';
    text: string;
};

export const ChatBubble = ({ message }: { message: Message }) => {
    const isUser = message.sender === 'user';
    return (
      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`p-4 rounded-2xl max-w-lg md:max-w-2xl transition-all duration-300 ${
            isUser
              ? 'bg-blue-600 rounded-br-none'
              : 'bg-gray-700 rounded-bl-none'
          }`}
        >
          <p className="text-white leading-relaxed whitespace-pre-wrap">{message.text}</p>
        </div>
      </div>
    );
};