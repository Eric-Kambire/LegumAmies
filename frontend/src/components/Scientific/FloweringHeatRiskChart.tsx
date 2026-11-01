import React, { useId, useMemo, useRef, useState } from 'react';
import { ExternalLink, Info, ThermometerSun } from 'lucide-react';
import type { SelectedField } from '../../types/agricultural';
import type { AssessResponse } from '../../types/backend-contract';
import type { LocationWeatherData } from '../../types/weather';
import {
  computeExposure,
  hourlyFromBackend,
  hourlyFromOpenMeteo,
  resolveHeatThreshold,
  selectWindow,
  type HourPoint,
} from '../../services/heatRisk';
import { getCropNameFr, getGrowthStageFr } from '../../services/agriRiskService';
import { useNow } from '../../hooks/useNow';
import { useMediaQuery } from '../../hooks/useMediaQuery';

interface FloweringHeatRiskChartProps {
  field: SelectedField;
  backendResponse: AssessResponse | null;
  fallbackWeather: LocationWeatherData | null;
  /** Injectable clock for deterministic tests; defaults to the real time. */
  now?: Date;
}

const dayLabel = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const hourLabel = (h: number) => `${String(h).padStart(2, '0')} h`;
const num = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 0 });

export const FloweringHeatRiskChart: React.FC<FloweringHeatRiskChartProps> = ({
  field,
  backendResponse,
  fallbackWeather,
  now,
}) => {
  const [horizon, setHorizon] = useState<24 | 48>(48);
  const [cursor, setCursor] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const uid = useId();
  const clock = useNow();
  // On phones the chart is drawn on a narrower canvas so axis text keeps a readable size.
  const narrow = useMediaQuery('(max-width: 639px)');
  const W = narrow ? 360 : 640;
  const H = 260;
  const M = narrow ? { top: 14, right: 10, bottom: 36, left: 34 } : { top: 14, right: 14, bottom: 34, left: 42 };

  const backendPoints = useMemo(() => hourlyFromBackend(backendResponse), [backendResponse]);
  const usingBackend = backendPoints.length > 0;
  const points: HourPoint[] = useMemo(
    () => (usingBackend ? backendPoints : hourlyFromOpenMeteo(fallbackWeather)),
    [usingBackend, backendPoints, fallbackWeather]
  );

  const windowPoints = useMemo(() => selectWindow(points, horizon, now ?? clock), [points, horizon, now, clock]);
  const resolution = useMemo(
    () => resolveHeatThreshold(field, backendResponse?.risk?.alerts),
    [field, backendResponse]
  );
  const threshold = resolution.kind === 'threshold' ? resolution.threshold : null;
  const exposure = useMemo(
    () => computeExposure(windowPoints, threshold ? threshold.value : null),
    [windowPoints, threshold]
  );

  const crop = getCropNameFr(field.cropType);
  const model = usingBackend ? backendResponse?.weather?.model_id : 'Open-Meteo (modèle Météo-France), API Légume\u2019Ami indisponible';
  const unit = backendResponse?.weather?.units?.temperature_2m ?? '°C';

  if (windowPoints.length < 2) {
    return (
      <div className="apple-card p-4 text-xs text-white/65" data-testid="heat-chart-empty">
        <p className="font-semibold text-white mb-1">Courbe de chaleur indisponible</p>
        La prévision horaire de température n'est pas disponible pour le moment. Aucune valeur n'est estimée à sa place.
      </div>
    );
  }

  // ---- scales ----
  const temps = windowPoints.map((p) => p.temp);
  const lo = Math.min(...temps, threshold ? threshold.value : Infinity);
  const hi = Math.max(...temps, threshold ? threshold.value : -Infinity);
  const yMin = Math.floor(lo - 2);
  const yMax = Math.ceil(hi + 2);
  const innerW = W - M.left - M.right;
  const innerH = H - M.top - M.bottom;
  const x = (i: number) => M.left + (i / (windowPoints.length - 1)) * innerW;
  const y = (t: number) => M.top + (1 - (t - yMin) / (yMax - yMin)) * innerH;
  const stepW = innerW / (windowPoints.length - 1);

  const linePath = windowPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.temp).toFixed(1)}`).join(' ');
  const yTicks = Array.from({ length: 5 }, (_, k) => yMin + ((yMax - yMin) * k) / 4);
  const xTickEvery = narrow ? (windowPoints.length > 30 ? 8 : 6) : windowPoints.length > 30 ? 6 : 4;

  const active = cursor !== null ? Math.min(Math.max(cursor, 0), windowPoints.length - 1) : null;
  const activePoint = active !== null ? windowPoints[active] : null;
  const exceeded = (t: number) => threshold !== null && t > threshold.value;

  const readout = (p: HourPoint) => {
    const base = `${dayLabel(p.localDay)}, ${hourLabel(p.localHour)} : ${num(p.temp)} ${unit}`;
    if (!threshold) return base;
    const diff = p.temp - threshold.value;
    return exceeded(p.temp)
      ? `${base}, ${num(diff)} ${unit} au-dessus du seuil`
      : `${base}, ${num(Math.abs(diff))} ${unit} sous le seuil`;
  };

  const first = windowPoints[0];
  const last = windowPoints[windowPoints.length - 1];
  const windowLabel = `${dayLabel(first.localDay)} ${hourLabel(first.localHour)} → ${dayLabel(last.localDay)} ${hourLabel(last.localHour)}`;

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    setCursor(Math.round(((px - M.left) / innerW) * (windowPoints.length - 1)));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const cur = active ?? 0;
    const max = windowPoints.length - 1;
    const map: Record<string, number> = {
      ArrowRight: cur + 1,
      ArrowLeft: cur - 1,
      PageDown: cur + 6,
      PageUp: cur - 6,
      Home: 0,
      End: max,
    };
    if (e.key in map) {
      e.preventDefault();
      setCursor(Math.min(max, Math.max(0, map[e.key])));
    }
  };

  return (
    <section className="apple-card p-4 sm:p-5 flex flex-col gap-3" aria-labelledby={`${uid}-title`} data-testid="heat-chart">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-2xl bg-orange-500/20 text-orange-300 flex items-center justify-center flex-shrink-0">
            <ThermometerSun className="w-4 h-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 id={`${uid}-title`} className="text-sm font-semibold text-white leading-snug">
              Température en floraison
            </h3>
            <p className="text-[11px] text-white/55 leading-snug">
              {crop} · {getGrowthStageFr(field.growthStage)} · exposition à la chaleur, pas une prédiction de dégâts
            </p>
          </div>
        </div>
        <div role="group" aria-label="Horizon de la courbe" className="flex p-0.5 rounded-full bg-black/30 flex-shrink-0">
          {([24, 48] as const).map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => {
                setHorizon(h);
                setCursor(null);
              }}
              aria-pressed={horizon === h}
              data-testid={`heat-window-${h}`}
              className={`px-3 py-1 rounded-full text-xs font-medium ${horizon === h ? 'bg-white text-black' : 'text-white/65 hover:text-white'}`}
            >
              {h} h
            </button>
          ))}
        </div>
      </header>

      {/* Headline number, computed from the hourly points */}
      {threshold ? (
        <div className="flex items-baseline gap-2 flex-wrap" aria-live="polite">
          <span className={`text-3xl font-semibold tracking-tight ${exposure.hoursAbove > 0 ? 'text-orange-300' : 'text-emerald-300'}`} data-testid="heat-exceed-hours">
            {exposure.hoursAbove} h
          </span>
          <span className="text-xs text-white/70">
            au-dessus de {num(threshold.value)} {unit} sur les {windowPoints.length} prochaines heures
            {windowPoints.length < horizon ? ` (prévision disponible : ${windowPoints.length} h sur ${horizon})` : ''}
          </span>
        </div>
      ) : (
        <p className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2 leading-relaxed" data-testid="heat-no-threshold" role="status">
          {resolution.kind === 'none' ? resolution.reason : ''}
        </p>
      )}

      {/* Interactive chart */}
      <div
        tabIndex={0}
        role="slider"
        aria-label="Parcourir la courbe de température heure par heure"
        aria-valuemin={0}
        aria-valuemax={windowPoints.length - 1}
        aria-valuenow={active ?? 0}
        aria-valuetext={activePoint ? readout(activePoint) : 'Utilisez les flèches pour parcourir les heures'}
        onKeyDown={onKeyDown}
        onFocus={() => setCursor((c) => c ?? 0)}
        onBlur={() => setCursor(null)}
        className="rounded-xl focus-visible:outline-offset-2"
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto touch-none select-none"
          onPointerMove={onPointerMove}
          onPointerDown={onPointerMove}
          onPointerLeave={() => setCursor(null)}
          role="img"
          aria-label={`Prévision horaire de température du ${windowLabel}${threshold ? `, seuil ${num(threshold.value)} ${unit}` : ''}`}
          data-testid="heat-svg"
        >
          {/* grid + y labels */}
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.08)" />
              <text x={M.left - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.5)">
                {Math.round(t)}°
              </text>
            </g>
          ))}

          {/* x labels */}
          {windowPoints.map((p, i) =>
            i % xTickEvery === 0 ? (
              <g key={i}>
                <line x1={x(i)} x2={x(i)} y1={M.top + innerH} y2={M.top + innerH + 4} stroke="rgba(255,255,255,0.25)" />
                <text x={x(i)} y={H - 14} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.55)">
                  {hourLabel(p.localHour)}
                </text>
                {(i === 0 || p.localHour < xTickEvery) && (
                  <text x={x(i)} y={H - 3} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.4)">
                    {dayLabel(p.localDay)}
                  </text>
                )}
              </g>
            ) : null
          )}

          {/* exceedance bands */}
          {exposure.spans.map((s) => (
            <rect
              key={s.startIndex}
              x={x(s.startIndex) - stepW / 2}
              y={M.top}
              width={Math.max(stepW, (s.endIndex - s.startIndex + 1) * stepW)}
              height={innerH}
              fill="rgba(249,115,22,0.16)"
              data-testid="heat-band"
            />
          ))}

          {/* threshold */}
          {threshold && (
            <g data-testid="heat-threshold-line">
              <line x1={M.left} x2={W - M.right} y1={y(threshold.value)} y2={y(threshold.value)} stroke="#fb923c" strokeDasharray="6 4" strokeWidth="1.5" />
              <text x={W - M.right - 4} y={y(threshold.value) - 5} textAnchor="end" fontSize="10" fill="#fdba74">
                Seuil publié {num(threshold.value)} {unit}
              </text>
            </g>
          )}

          {/* temperature line */}
          <path d={linePath} fill="none" stroke="#7cc4ff" strokeWidth="2" strokeLinejoin="round" />
          {threshold &&
            windowPoints.map((p, i) =>
              exceeded(p.temp) ? <circle key={i} cx={x(i)} cy={y(p.temp)} r="3" fill="#f97316" /> : null
            )}

          {/* cursor */}
          {activePoint && active !== null && (
            <g pointerEvents="none">
              <line x1={x(active)} x2={x(active)} y1={M.top} y2={M.top + innerH} stroke="rgba(255,255,255,0.45)" />
              <circle cx={x(active)} cy={y(activePoint.temp)} r="5" fill="#fff" stroke="#0b0f19" strokeWidth="2" />
            </g>
          )}
        </svg>
      </div>

      <p className="min-h-[1.25rem] text-xs text-white/85 font-mono" data-testid="heat-readout" aria-hidden="true">
        {activePoint ? readout(activePoint) : `Max ${num(exposure.maxTemp)} ${unit} · min ${num(exposure.minTemp)} ${unit}. Survolez ou utilisez les flèches.`}
      </p>

      {threshold && exposure.spans.length > 0 && (
        <ul className="text-[11px] text-white/65 flex flex-col gap-0.5" data-testid="heat-spans">
          {exposure.spans.map((s) => (
            <li key={s.startIndex}>
              {dayLabel(windowPoints[s.startIndex].localDay)} {hourLabel(windowPoints[s.startIndex].localHour)} →{' '}
              {hourLabel(windowPoints[s.endIndex].localHour)} : {s.hours} h au-dessus du seuil, maximum {num(s.maxTemp)} {unit}
            </li>
          ))}
        </ul>
      )}

      {/* Provenance */}
      <div className="rounded-xl bg-black/25 border border-white/[0.06] px-3 py-2 text-[11px] text-white/55 leading-relaxed flex flex-col gap-1">
        <p className="flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-white/40" aria-hidden="true" />
          <span>
            Fenêtre : {windowLabel} (heure locale). Prévision : <span className="font-mono">{model}</span>, unité {unit}.
            {!usingBackend && ' Les valeurs viennent du fournisseur météo direct, pas de l\u2019analyse de l\u2019API.'}
          </span>
        </p>
        {threshold && (
          <p>
            Seuil : {num(threshold.value)} {unit} ({threshold.institution},{' '}
            {threshold.validationStatus === 'published' ? 'publié' : threshold.validationStatus})
            {threshold.minimumExposureHours ? `, exposition minimale ${threshold.minimumExposureHours} h` : ''}.{' '}
            {threshold.sourceUrl && (
              <a href={threshold.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[#38bdf8] hover:underline inline-flex items-center gap-1">
                Source <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </a>
            )}
          </p>
        )}
        <p>Un dépassement signale une exposition à surveiller. Aucune probabilité de dégât, perte de rendement ou perte économique n'est calculée.</p>
      </div>

      <details className="text-[11px] text-white/60">
        <summary className="cursor-pointer text-[#38bdf8]">Voir les valeurs horaires</summary>
        <div className="max-h-48 overflow-y-auto mt-2 rounded-lg border border-white/[0.06]">
          <table className="w-full text-left" data-testid="heat-table">
            <thead className="sticky top-0 bg-[#121826] text-white/50">
              <tr>
                <th className="px-2 py-1 font-medium">Jour</th>
                <th className="px-2 py-1 font-medium">Heure</th>
                <th className="px-2 py-1 font-medium text-right">Température ({unit})</th>
                {threshold && <th className="px-2 py-1 font-medium">Seuil</th>}
              </tr>
            </thead>
            <tbody>
              {windowPoints.map((p, i) => (
                <tr key={i} className={exceeded(p.temp) ? 'text-orange-200' : ''}>
                  <td className="px-2 py-0.5">{dayLabel(p.localDay)}</td>
                  <td className="px-2 py-0.5">{hourLabel(p.localHour)}</td>
                  <td className="px-2 py-0.5 text-right font-mono">{num(p.temp)}</td>
                  {threshold && <td className="px-2 py-0.5">{exceeded(p.temp) ? 'au-dessus' : 'sous'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
};
