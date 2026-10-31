import React, { useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import type { RadarFrame } from '../../types/weather';

interface RadarTimelineProps {
  frames: RadarFrame[];
  currentIndex: number;
  isPlaying: boolean;
  onIndexChange: (index: number) => void;
  onTogglePlay: () => void;
}

export const RadarTimeline: React.FC<RadarTimelineProps> = ({
  frames,
  currentIndex,
  isPlaying,
  onIndexChange,
  onTogglePlay,
}) => {
  const currentFrame = frames[currentIndex];

  useEffect(() => {
    if (!isPlaying || frames.length === 0) return;

    const interval = setInterval(() => {
      onIndexChange((currentIndex + 1) % frames.length);
    }, 700);

    return () => clearInterval(interval);
  }, [isPlaying, currentIndex, frames.length, onIndexChange]);

  if (!currentFrame || frames.length === 0) return null;

  const frameDate = new Date(currentFrame.time * 1000);
  const timeFormatted = frameDate.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const isPast = currentFrame.type === 'past';

  return (
    <div className="apple-glass px-4 py-3 rounded-[26px] shadow-2xl flex flex-col gap-2 max-w-sm w-full mx-auto select-none transition-all">
      {/* Top Header: Time, Status */}
      <div className="flex items-center justify-between text-xs px-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white tracking-tight">{timeFormatted}</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-tight ${
              isPast
                ? 'bg-white/15 text-white/90'
                : 'bg-amber-500/25 text-amber-200'
            }`}
          >
            {isPast ? 'Observé' : 'Prévision'}
          </span>
        </div>

        <span className="text-[11px] text-white/50 font-medium">
          {currentIndex + 1} / {frames.length}
        </span>
      </div>

      {/* iOS Slider */}
      <div className="relative flex items-center px-0.5">
        <input
          type="range"
          min={0}
          max={frames.length - 1}
          value={currentIndex}
          onChange={(e) => onIndexChange(Number(e.target.value))}
          className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-white focus:outline-none"
        />
      </div>

      {/* Controls Bar */}
      <div className="flex items-center justify-between px-1 pt-0.5">
        <button
          onClick={() => onIndexChange(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
          className="p-1.5 text-white/60 hover:text-white disabled:opacity-25 transition-colors active:scale-90"
          title="Précédent"
          aria-label="Image précédente"
        >
          <SkipBack className="w-4 h-4 fill-current" />
        </button>

        <button
          onClick={onTogglePlay}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white text-black font-semibold text-xs shadow-md transition-all active:scale-90"
          aria-label={isPlaying ? 'Pause' : 'Lecture'}
        >
          {isPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Animer</span>
            </>
          )}
        </button>

        <button
          onClick={() => onIndexChange(Math.min(frames.length - 1, currentIndex + 1))}
          disabled={currentIndex === frames.length - 1}
          className="p-1.5 text-white/60 hover:text-white disabled:opacity-25 transition-colors active:scale-90"
          title="Suivant"
          aria-label="Image suivante"
        >
          <SkipForward className="w-4 h-4 fill-current" />
        </button>
      </div>
    </div>
  );
};
