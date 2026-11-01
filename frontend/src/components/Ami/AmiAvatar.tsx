import React from 'react';

interface AmiAvatarProps {
  size?: number;
  className?: string;
}

/** Original farmer avatar for Ami: straw hat, friendly face, green sprout. Pure SVG, no emoji. */
export const AmiAvatar: React.FC<AmiAvatarProps> = ({ size = 40, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    role="img"
    aria-label="Ami, assistant agricole"
    className={className}
  >
    <defs>
      <linearGradient id="ami-bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#34d399" />
        <stop offset="1" stopColor="#0f766e" />
      </linearGradient>
      <linearGradient id="ami-hat" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fcd34d" />
        <stop offset="1" stopColor="#d97706" />
      </linearGradient>
    </defs>
    <circle cx="32" cy="32" r="31" fill="url(#ami-bg)" />
    {/* shoulders */}
    <path d="M12 60c2-10 9-15 20-15s18 5 20 15" fill="#1e3a8a" />
    {/* face */}
    <circle cx="32" cy="35" r="12" fill="#fbd5b0" />
    <circle cx="27.5" cy="35" r="1.4" fill="#44403c" />
    <circle cx="36.5" cy="35" r="1.4" fill="#44403c" />
    <path d="M27.5 40c2.6 2.4 6.4 2.4 9 0" stroke="#9a3412" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    {/* straw hat */}
    <ellipse cx="32" cy="26.5" rx="21" ry="5.2" fill="url(#ami-hat)" />
    <path d="M18.5 26c0-9 6-14 13.5-14s13.5 5 13.5 14z" fill="url(#ami-hat)" />
    <path d="M19 24.2h26" stroke="#92400e" strokeWidth="2.4" />
    {/* sprout */}
    <path d="M50 18c-5-1-8 2-8 6 5 1 8-2 8-6z" fill="#bbf7d0" />
  </svg>
);
