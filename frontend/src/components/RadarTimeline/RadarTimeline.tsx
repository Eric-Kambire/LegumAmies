import React, { useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Clock } from 'lucide-react';
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
    }, 750);

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
    <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800/80 p-2.5 rounded-2xl shadow-2xl flex flex-col gap-2 max-w-md w-full mx-auto select-none transition-all">
      {/* Top Header: Time, Status & Step */}
      <div className="flex items-center justify-between text-xs px-1">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-mono text-sm font-semibold text-slate-100">{timeFormatted}</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide ${
              isPast
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
            }`}
          >
            {isPast ? 'Observé (Radar)' : 'Prévision (Nowcast)'}
          </span>
        </div>

        <span className="text-[11px] text-slate-400 font-mono">
          {currentIndex + 1} / {frames.length}
        </span>
      </div>

      {/* Scrubber Slider */}
      <div className="relative flex items-center px-1">
        <input
          type="range"
          min={0}
          max={frames.length - 1}
          value={currentIndex}
          onChange={(e) => onIndexChange(Number(e.target.value))}
          className="w-full h-1.5 bg-slate-700/60 rounded-lg appearance-none cursor-pointer accent-emerald-500 transition-all focus:outline-none"
        />
      </div>

      {/* Controls Bar */}
      <div className="flex items-center justify-between px-1 pt-1">
        <button
          onClick={() => onIndexChange(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
          className="p-1.5 text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-colors"
          title="Image précédente"
          aria-label="Image précédente"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        <button
          onClick={onTogglePlay}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-md shadow-emerald-950 transition-all active:scale-95"
          aria-label={isPlaying ? 'Pause' : 'Lecture radar'}
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
          className="p-1.5 text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-colors"
          title="Image suivante"
          aria-label="Image suivante"
        >
          <SkipForward className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
