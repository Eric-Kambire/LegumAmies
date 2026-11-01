import React from 'react';
import { AlertTriangle, MapPin } from 'lucide-react';
import { AmiAvatar } from './AmiAvatar';
import { AmiSources } from './AmiSources';
import { AmiRichText } from './AmiRichText';
import type { AmiMessageData } from '../../hooks/useAmiChat';

interface AmiMessageProps {
  message: AmiMessageData;
  onRetry?: (question: string) => void;
  previousQuestion?: string;
}

export const AmiMessage: React.FC<AmiMessageProps> = ({ message, onRetry, previousQuestion }) => {
  if (message.role === 'user') {
    return (
      <div className="flex flex-col items-end gap-1" data-testid="ami-user-message">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[#0a84ff] text-white px-3.5 py-2 text-[13px] leading-relaxed whitespace-pre-line break-words select-text">
          {message.text}
        </div>
        <span className="flex items-center gap-1 text-[10px] text-white/40 pr-1">
          <MapPin className="w-2.5 h-2.5" aria-hidden="true" />
          {message.contextLabel}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2" data-testid="ami-assistant-message">
      <AmiAvatar size={28} className="flex-shrink-0 mt-0.5" />
      <div className="min-w-0 max-w-[88%]">
        {message.pending ? (
          <div
            className="rounded-2xl rounded-bl-md bg-white/[0.08] px-3.5 py-3 inline-flex items-center gap-1"
            role="status"
            aria-label="Ami rédige une réponse"
          >
            <span className="ami-dot" />
            <span className="ami-dot" style={{ animationDelay: '0.15s' }} />
            <span className="ami-dot" style={{ animationDelay: '0.3s' }} />
          </div>
        ) : message.error ? (
          <div className="rounded-2xl rounded-bl-md bg-rose-500/10 border border-rose-500/25 px-3.5 py-2.5 text-[12px] text-rose-100 leading-relaxed">
            <p className="flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-rose-300" aria-hidden="true" />
              <span className="select-text">{message.error}</span>
            </p>
            {onRetry && previousQuestion && (
              <button
                type="button"
                onClick={() => onRetry(previousQuestion)}
                className="mt-2 text-[11px] font-semibold text-[#38bdf8] hover:underline"
              >
                Réessayer
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="rounded-2xl rounded-bl-md bg-white/[0.08] text-white/95 px-3.5 py-2.5 text-[13px] leading-relaxed break-words select-text" data-testid="ami-answer-text">
              <AmiRichText text={message.text} />
            </div>
            {message.response?.actions && message.response.actions.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1.5">
                {message.response.actions.map((a, i) => (
                  <li key={i} className="rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-1.5 text-[11px] text-white/80">
                    <span className="font-semibold text-white">{a.title}</span>
                    <span className="text-white/50"> · {a.basis}</span>
                    <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-200 text-[10px]">
                      {a.verified ? 'Vérifié' : 'À confirmer au champ'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {message.response && <AmiSources response={message.response} />}
          </>
        )}
      </div>
    </div>
  );
};
