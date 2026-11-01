import React, { useId, useState } from 'react';
import { CloudRain, Info } from 'lucide-react';
import type { EnsembleBlock } from '../../types/backend-contract';
import { useMediaQuery } from '../../hooks/useMediaQuery';

interface UncertaintyRainChartProps {
  ensemble: EnsembleBlock;
}

/** Backend notes are English; known sentences are shown in French, anything else is passed through untouched. */
const localizeThresholdNote = (note: string) =>
  /operational demo threshold/i.test(note)
    ? 'Seuil de démonstration opérationnel, pas une limite de récolte validée.'
    : note;

const dayLabel = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
const num = (v: number, digits = 1) => v.toLocaleString('fr-FR', { maximumFractionDigits: digits });

/**
 * Daily probability that the rain total exceeds a threshold, derived from the
 * ECMWF AIFS ensemble. The bar is the share of ensemble members above the threshold.
 */
export const UncertaintyRainChart: React.FC<UncertaintyRainChartProps> = ({ ensemble }) => {
  const [cursor, setCursor] = useState<number | null>(null);
  const uid = useId();
  const narrow = useMediaQuery('(max-width: 639px)');
  const W = narrow ? 360 : 640;
  const H = 240;
  const M = narrow ? { top: 14, right: 8, bottom: 44, left: 32 } : { top: 14, right: 14, bottom: 40, left: 40 };
  const days = ensemble.daily.slice(0, 10);

  if (days.length === 0) {
    return (
      <div className="apple-card p-4 text-xs text-white/65" data-testid="rain-chart-empty">
        Aucune probabilité de pluie n'est disponible pour le moment.
      </div>
    );
  }

  const innerW = W - M.left - M.right;
  const innerH = H - M.top - M.bottom;
  const slot = innerW / days.length;
  const barW = Math.min(44, slot * 0.62);
  const x = (i: number) => M.left + slot * i + slot / 2;
  const y = (p: number) => M.top + (1 - p / 100) * innerH;
  const color = (p: number) => (p > 50 ? '#f43f5e' : p > 20 ? '#fbbf24' : '#38bdf8');
  const members = ensemble.ensemble_members_valid;
  const membersAbove = (p: number) => Math.round((p / 100) * members);
  const active = cursor !== null ? days[Math.min(Math.max(cursor, 0), days.length - 1)] : null;

  const readout = (i: number) => {
    const d = days[i];
    return `${dayLabel(d.date_local)} : ${num(d.probability_pct, 0)} % de probabilité de dépasser ${num(ensemble.rain_threshold_mm)} mm (${membersAbove(d.probability_pct)} membres sur ${members}). Cumul moyen ${num(d.mean_precipitation_mm)} mm, médian ${num(d.median_precipitation_mm)} mm.`;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const cur = cursor ?? 0;
    const map: Record<string, number> = { ArrowRight: cur + 1, ArrowLeft: cur - 1, Home: 0, End: days.length - 1 };
    if (e.key in map) {
      e.preventDefault();
      setCursor(Math.min(days.length - 1, Math.max(0, map[e.key])));
    }
  };

  return (
    <section className="apple-card p-4 sm:p-5 flex flex-col gap-3" aria-labelledby={`${uid}-title`} data-testid="rain-chart">
      <header className="flex items-start gap-2.5">
        <span className="w-9 h-9 rounded-2xl bg-sky-500/20 text-[#38bdf8] flex items-center justify-center flex-shrink-0">
          <CloudRain className="w-4 h-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={`${uid}-title`} className="text-sm font-semibold text-white leading-snug">
            Incertitude des précipitations
          </h3>
          <p className="text-[11px] text-white/55 leading-snug">
            Probabilité journalière de dépasser {num(ensemble.rain_threshold_mm)} mm · {days.length} jours · {members} membres
          </p>
        </div>
      </header>

      <div
        tabIndex={0}
        role="slider"
        aria-label="Parcourir les probabilités de pluie jour par jour"
        aria-valuemin={0}
        aria-valuemax={days.length - 1}
        aria-valuenow={cursor ?? 0}
        aria-valuetext={cursor !== null ? readout(Math.min(cursor, days.length - 1)) : 'Utilisez les flèches pour parcourir les jours'}
        onKeyDown={onKeyDown}
        onFocus={() => setCursor((c) => c ?? 0)}
        onBlur={() => setCursor(null)}
        className="rounded-xl"
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto select-none"
          role="img"
          aria-label={`Probabilité de pluie supérieure à ${num(ensemble.rain_threshold_mm)} millimètres, ${days.length} jours`}
          onPointerLeave={() => setCursor(null)}
        >
          {[0, 25, 50, 75, 100].map((p) => (
            <g key={p}>
              <line x1={M.left} x2={W - M.right} y1={y(p)} y2={y(p)} stroke="rgba(255,255,255,0.08)" />
              <text x={M.left - 6} y={y(p) + 3} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.5)">
                {p} %
              </text>
            </g>
          ))}
          {days.map((d, i) => (
            <g
              key={d.date_local}
              onPointerEnter={() => setCursor(i)}
              onPointerDown={() => setCursor(i)}
              data-testid="rain-bar"
              data-probability={d.probability_pct}
            >
              <rect x={x(i) - slot / 2} y={M.top} width={slot} height={innerH} fill={cursor === i ? 'rgba(255,255,255,0.07)' : 'transparent'} />
              <rect
                x={x(i) - barW / 2}
                y={y(d.probability_pct)}
                width={barW}
                height={Math.max(2, innerH - (y(d.probability_pct) - M.top))}
                rx="5"
                fill={color(d.probability_pct)}
                opacity={cursor === null || cursor === i ? 1 : 0.55}
              />
              <text x={x(i)} y={y(d.probability_pct) - 5} textAnchor="middle" fontSize={narrow ? 9 : 10} fontWeight="600" fill="rgba(255,255,255,0.85)">
                {num(d.probability_pct, 0)}
              </text>
              <text x={x(i)} y={H - 22} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.6)">
                {dayLabel(d.date_local)}
              </text>
              <text x={x(i)} y={H - 9} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.38)">
                {num(d.mean_precipitation_mm)} mm
              </text>
            </g>
          ))}
        </svg>
      </div>

      <p className="min-h-[2.25rem] text-xs text-white/80 leading-relaxed" data-testid="rain-readout" aria-hidden="true">
        {active
          ? readout(cursor as number)
          : 'Survolez une barre ou utilisez les flèches. Sous chaque jour : cumul moyen de l\u2019ensemble.'}
      </p>

      <div className="rounded-xl bg-black/25 border border-white/[0.06] px-3 py-2 text-[11px] text-white/55 leading-relaxed flex items-start gap-1.5">
        <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-white/40" aria-hidden="true" />
        <span>
          Lecture : 20 % signifie qu'environ 1 membre sur 5 de l'ensemble dépasse {num(ensemble.rain_threshold_mm)} mm ; ce n'est pas une
          certitude. Modèle <span className="font-mono">{ensemble.model_id}</span>. {localizeThresholdNote(ensemble.threshold_note)}
        </span>
      </div>
    </section>
  );
};
