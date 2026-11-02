import { forwardRef } from 'react';
import { Sparkles } from 'lucide-react';
import { AmiAvatar } from './AmiAvatar';

interface AmiLauncherProps {
  isOpen: boolean;
  onToggle: () => void;
  contextLabel: string;
  hasMessages: boolean;
}

/**
 * Floating launcher. Its position is driven by the `.ami-launcher` CSS rules so that it
 * stacks above the tab bar, the PWA banner and the map sheet (see index.css).
 */
export const AmiLauncher = forwardRef<HTMLButtonElement, AmiLauncherProps>(
  ({ isOpen, onToggle, contextLabel, hasMessages }, ref) => (
    <button
      ref={ref}
      type="button"
      onClick={onToggle}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      aria-label={isOpen ? "Fermer l'assistant Ami" : `Ouvrir l'assistant Ami. Contexte : ${contextLabel.replace('Ami · ', '')}`}
      className={`ami-launcher fixed z-[540] group flex items-center gap-2.5 rounded-full apple-glass pl-1.5 pr-1.5 md:pr-4 py-1.5 shadow-2xl ring-1 ring-white/15 hover:ring-[#38bdf8]/40 active:scale-95 transition-all ${
        isOpen ? 'max-md:hidden' : ''
      }`}
    >
      <span className="relative flex-shrink-0">
        {/* soft animated glow so the assistant reads as "live" */}
        <span className="absolute inset-0 rounded-full bg-[#34d399]/40 blur-md opacity-70 group-hover:opacity-100 animate-pulse" aria-hidden="true" />
        <AmiAvatar size={40} className="relative" />
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-[#0b0f19] ${hasMessages ? 'bg-[#38bdf8]' : 'bg-emerald-400'}`}
          aria-hidden="true"
        />
      </span>
      <span className="hidden md:flex flex-col items-start leading-tight text-left">
        <span className="flex items-center gap-1 text-xs font-semibold text-white">
          <Sparkles className="w-3 h-3 text-[#38bdf8]" aria-hidden="true" />
          Demander à Ami
        </span>
        <span className="text-[10px] text-white/55 max-w-[150px] truncate">{contextLabel.replace('Ami · ', '')}</span>
      </span>
    </button>
  )
);
AmiLauncher.displayName = 'AmiLauncher';
