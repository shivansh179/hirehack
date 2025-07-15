// components/StatusIndicator.tsx
import React from 'react';

type Status = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export const StatusIndicator = ({ status }: { status: Status }) => {
    const statusInfo = {
      idle: { icon: '💬', text: 'Ready for your response', color: 'text-gray-400' },
      listening: { icon: '🎤', text: 'Listening...', color: 'text-blue-400' },
      thinking: { icon: '🤔', text: 'Thinking...', color: 'text-purple-400' },
      speaking: { icon: '🗣️', text: 'Speaking...', color: 'text-orange-400' },
      error: { icon: '❌', text: 'Error', color: 'text-red-400' },
    };
    const current = statusInfo[status];
    return <p className={`text-sm text-center ${current.color}`}>{current.icon} {current.text}</p>;
};