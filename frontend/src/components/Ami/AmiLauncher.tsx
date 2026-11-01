import { forwardRef } from 'react';
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
      className={`ami-launcher fixed z-[540] group flex items-center gap-2 rounded-full apple-glass pl-1.5 pr-1.5 md:pr-3.5 py-1.5 shadow-2xl active:scale-95 transition-transform ${
        isOpen ? 'max-md:hidden' : ''
      }`}
    >
      <span className="relative flex-shrink-0">
        <AmiAvatar size={40} />
        {hasMessages && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#38bdf8] ring-2 ring-[#0b0f19]" aria-hidden="true" />
        )}
      </span>
      <span className="hidden md:flex flex-col items-start leading-tight text-left">
        <span className="text-xs font-semibold text-white">Demander à Ami</span>
        <span className="text-[10px] text-white/55 max-w-[140px] truncate">{contextLabel.replace('Ami · ', '')}</span>
      </span>
    </button>
  )
);
AmiLauncher.displayName = 'AmiLauncher';
