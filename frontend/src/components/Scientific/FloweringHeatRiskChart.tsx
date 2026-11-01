import React, { useState } from 'react';
import { Activity, ArrowUpRight, ThermometerSun } from 'lucide-react';
import type { AssessResponse } from '../../types/backend-contract';
import type { SelectedField } from '../../types/agricultural';
import { getSourcedFloweringHeat } from '../../data/sourcedAgronomy';

export const FloweringHeatRiskChart: React.FC<{ field: SelectedField | null; assessment: AssessResponse | null }> = ({ field, assessment }) => {
  const [hours, setHours] = useState<24 | 48>(48);
  const threshold = field?.growthStage === 'floraison' && field ? getSourcedFloweringHeat(field.cropType) : undefined;
  const raw = assessment?.weather?.hourly ?? [];
  const series = raw.slice(0, hours).filter((p) => p.temperature_c !== null && Number.isFinite(p.temperature_c));
  const maximum = series.length ? Math.max(...series.map((p) => p.temperature_c as number)) : null;
  const exceedance = threshold ? series.filter((p) => (p.temperature_c as number) > threshold.tmaxC).length : 0;
  const values = series.map((p) => p.temperature_c as number);
  const low = Math.floor((Math.min(...values, threshold?.tmaxC ?? 100) - 3) / 5) * 5;
  const high = Math.ceil((Math.max(...values, threshold?.tmaxC ?? -100) + 3) / 5) * 5;
  const minY = series.length ? low : 0;
  const maxY = series.length ? Math.max(high, low + 5) : 30;
  const X = (i: number) => 38 + i * 612 / Math.max(series.length - 1, 1);
  const Y = (t: number) => 168 - ((t - minY) / (maxY - minY)) * 140;
  const line = series.map((p, i) => `${i ? 'L' : 'M'} ${X(i).toFixed(1)} ${Y(p.temperature_c as number).toFixed(1)}`).join(' ');

  return (
    <section aria-label="Courbe de chaleur et de risque en floraison" className="apple-card p-4 sm:p-5 flex flex-col gap-3 min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl p-2 bg-amber-500/15 text-amber-300"><ThermometerSun className="w-5 h-5" /></div>
          <div>
            <h3 className="font-semibold text-white text-sm">Flowering Heat Risk</h3>
            <p className="text-[11px] text-white/50">Température AROME horaire · {field?.name || 'Parcelle'}</p>
          </div>
        </div>
        <div className="flex items-center rounded-full p-1 border border-white/10 bg-black/20">
          {([24, 48] as const).map((h) => <button key={h} type="button" onClick={() => setHours(h)} aria-pressed={hours === h} className={`px-2.5 py-1 text-[11px] rounded-full ${hours === h ? 'bg-white text-black font-semibold' : 'text-white/55'}`}>{h}h</button>)}
        </div>
      </div>
      {!series.length ? <p className="text-xs text-white/60 py-6">La courbe apparaîtra après récupération des prévisions horaires AROME.</p> : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="bg-white/[0.05] rounded-xl px-3 py-2">
              <p className="text-[10px] text-white/50">Tmax sur {hours}h</p>
              <p className="text-xl font-semibold">{maximum?.toFixed(1)} °C</p>
            </div>
            <div className="bg-white/[0.05] rounded-xl px-3 py-2">
              <p className="text-[10px] text-white/50">Durée au-dessus du seuil</p>
              <p className="text-xl font-semibold">{threshold ? `${exceedance} h` : '—'}</p>
            </div>
            <div className="bg-white/[0.05] rounded-xl px-3 py-2 col-span-2 sm:col-span-1">
              <p className="text-[10px] text-white/50">Seuil agronomique</p>
              <p className="text-xl font-semibold">{threshold ? `${threshold.tmaxC} °C` : 'Non défini'}</p>
            </div>
          </div>
          <div className="min-w-0 w-full overflow-hidden">
            <svg viewBox="0 0 690 204" className="w-full h-auto" role="img" aria-label={`Prévision horaire de température ${hours} heures; maximale ${maximum?.toFixed(1)} degrés`}>
              {[0, 1, 2, 3, 4].map((n) => {
                const t = minY + n * (maxY - minY) / 4;
                return <g key={n}><line x1="38" x2="650" y1={Y(t)} y2={Y(t)} stroke="#ffffff" strokeOpacity="0.12" strokeDasharray="3 5"/><text x="30" y={Y(t) + 4} fill="#aeb8c8" fontSize="11" textAnchor="end">{Math.round(t)}°</text></g>;
              })}
              {threshold && <g><line x1="38" x2="650" y1={Y(threshold.tmaxC)} y2={Y(threshold.tmaxC)} stroke="#fbbf24" strokeWidth="1.8" strokeDasharray="6 5"/><text x="645" y={Y(threshold.tmaxC) - 7} fill="#fbbf24" fontSize="11" textAnchor="end">{threshold.tmaxC} °C · seuil</text></g>}
              <path d={line} fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              {series.map((p, i) => threshold && (p.temperature_c as number) > threshold.tmaxC ? <circle key={i} cx={X(i)} cy={Y(p.temperature_c as number)} r="3.3" fill="#fb923c"/> : null)}
              {[0, Math.floor((series.length - 1) / 2), series.length - 1].map((i, key) => <text key={key} x={X(i)} y="196" fontSize="11" fill="#aeb8c8" textAnchor={key === 0 ? 'start' : key === 2 ? 'end' : 'middle'}>{new Date(series[i].valid_time_local).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</text>)}
            </svg>
          </div>
          <p className="text-[11px] text-white/55 flex items-start gap-1.5"><Activity className="w-3.5 h-3.5 mt-0.5 shrink-0" />{threshold ? `${exceedance} heure(s) de prévision au-dessus du seuil sur ${series.length} heures disponibles. Exposition calculée, pas probabilité de dégâts.` : 'Courbe de température disponible. Le seuil de floraison n’est pas documenté pour cette culture ou ce stade dans les règles actuelles.'}</p>
          {threshold && <a href={threshold.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-sky-300 flex items-center gap-1 hover:underline">{threshold.institution} · consulter la référence <ArrowUpRight className="w-3 h-3"/></a>}
          <p className="text-[10px] text-white/35">{assessment?.weather.model_id} · prévision, heure locale</p>
        </>
      )}
    </section>
  );
};
