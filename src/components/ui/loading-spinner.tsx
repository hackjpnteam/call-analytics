'use client';

import { useEffect, useState } from 'react';
import { Phone, PhoneCall, PhoneIncoming, PhoneOutgoing, BarChart3 } from 'lucide-react';

const loadingMessages = [
  'データを取得中',
  '通話履歴を分析中',
  'レポートを準備中',
  '統計を計算中',
  'もう少しお待ちください',
];

export function LoadingSpinner({ size = 'default' }: { size?: 'small' | 'default' | 'large' }) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [dots, setDots] = useState('');

  useEffect(() => {
    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 2500);

    const dotsInterval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 400);

    return () => {
      clearInterval(messageInterval);
      clearInterval(dotsInterval);
    };
  }, []);

  const iconSize = size === 'small' ? 16 : size === 'large' ? 32 : 24;
  const containerClass = size === 'small' ? 'gap-2' : size === 'large' ? 'gap-6' : 'gap-4';
  const textClass = size === 'small' ? 'text-sm' : size === 'large' ? 'text-xl' : 'text-base';

  return (
    <div className={`flex flex-col items-center justify-center ${containerClass}`}>
      {/* Animated phone icons */}
      <div className="relative flex items-center justify-center">
        {/* Central spinning icon */}
        <div className="relative">
          <div className="absolute inset-0 animate-ping rounded-full bg-blue-400/30" style={{ animationDuration: '1.5s' }} />
          <div className="relative z-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 p-3 shadow-lg">
            <Phone className="text-white animate-pulse" size={iconSize} />
          </div>
        </div>

        {/* Orbiting icons */}
        <div className="absolute" style={{ animation: 'orbit 3s linear infinite' }}>
          <PhoneIncoming
            className="text-green-500"
            size={iconSize * 0.6}
            style={{ transform: 'translateX(40px)' }}
          />
        </div>
        <div className="absolute" style={{ animation: 'orbit 3s linear infinite', animationDelay: '-1s' }}>
          <PhoneOutgoing
            className="text-blue-500"
            size={iconSize * 0.6}
            style={{ transform: 'translateX(40px)' }}
          />
        </div>
        <div className="absolute" style={{ animation: 'orbit 3s linear infinite', animationDelay: '-2s' }}>
          <BarChart3
            className="text-purple-500"
            size={iconSize * 0.6}
            style={{ transform: 'translateX(40px)' }}
          />
        </div>
      </div>

      {/* Wave dots animation */}
      <div className="flex space-x-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-2 w-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
            style={{
              animation: 'wave 1.2s ease-in-out infinite',
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>

      {/* Cycling message */}
      <div className={`${textClass} font-medium text-gray-600 min-w-[200px] text-center`}>
        <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          {loadingMessages[messageIndex]}
        </span>
        <span className="text-gray-400 w-6 inline-block text-left">{dots}</span>
      </div>

      {/* Progress bar animation */}
      <div className="w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 rounded-full"
          style={{
            animation: 'progressSlide 2s ease-in-out infinite',
            backgroundSize: '200% 100%',
          }}
        />
      </div>

      <style jsx>{`
        @keyframes orbit {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes wave {
          0%, 100% {
            transform: translateY(0);
            opacity: 0.5;
          }
          50% {
            transform: translateY(-8px);
            opacity: 1;
          }
        }

        @keyframes progressSlide {
          0% {
            transform: translateX(-100%);
            background-position: 0% 0%;
          }
          50% {
            background-position: 100% 0%;
          }
          100% {
            transform: translateX(100%);
            background-position: 0% 0%;
          }
        }
      `}</style>
    </div>
  );
}

// Simple version for inline loading
export function LoadingDots() {
  return (
    <span className="inline-flex space-x-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-blue-500"
          style={{
            animation: 'bounce 1.4s ease-in-out infinite',
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(0.6);
            opacity: 0.5;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </span>
  );
}

// Full page loading screen
export function FullPageLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <LoadingSpinner size="large" />
    </div>
  );
}
