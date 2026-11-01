import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Leaf, Mountain, Waves } from 'lucide-react';
import type { SelectedField } from '../../types/agricultural';
import { API_BASE_URL } from '../../services/legumamiesApi';

type Scenario = { scenario: string; soil_loss_t_ha_yr: number; pct_vs_baseline: number };
type ModelData = {
  study_area: { name: string };
  model_version: string;
  vulnerability_index: { score_0_100: number; band: string };
  rusle_baseline: { soil_loss_t_ha_yr: number; parameters: Record<string, number> };
  uncertainty_range?: { A_min_t_ha_yr: number; A_max_t_ha_yr: number };
  inputs?: { soil?: { clay_pct: number; sand_pct: number; silt_pct: number; ph_h2o: number }; slope?: { mean_deg: number }; rainfall?: { annual_precip_mm_mean: number } };
  scenarios: Scenario[];
};
const coverage = (f: SelectedField | null) => !!f && f.latitude >= 43.29 && f.latitude <= 43.33 && f.longitude >= 1.93 && f.longitude <= 1.97;
const LABELS: Record<string, string> = {
  baseline: 'Situation de référence',
  wetter_climate: 'Pluies plus intenses',
  improved_cover_management: 'Couverture & pratiques améliorées',
};

export const SoilIntelligenceCard: React.FC<{ field: SelectedField | null; compact?: boolean }> = ({ field, compact = false }) => {
  const [data, setData] = useState<ModelData | null>(null);
  const [source, setSource] = useState<'api' | 'case-study' | null>(null);
  const [error, setError] = useState('');
  const eligible = coverage(field);
  useEffect(() => {
    if (!eligible || !field) { setData(null); setError(''); return; }
    const controller = new AbortController();
    const load = async () => {
      setError('');
      // Prefer the actual geospatial API when deployed. The checked-in JSON is
      // an exact reproducible precomputed result from the executed PR #7 case study.
      if (API_BASE_URL) {
        try {
          const res = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/geo/soil-risk`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ location: { field_id: field.id, latitude: field.latitude, longitude: field.longitude }, exposure: {} }),
            signal: controller.signal,
          });
          if (res.ok) {
            const json = await res.json() as ModelData;
            if (!controller.signal.aborted) { setData(json); setSource('api'); }
            return;
          }
        } catch { /* released API may not include geo yet */ }
      }
      try {
        const res = await fetch('/geo/soil_intelligence_castelnaudary.json', { signal: controller.signal });
        if (!res.ok) throw new Error('Étude géospatiale indisponible');
        const json = await res.json() as ModelData;
        if (!controller.signal.aborted) { setData(json); setSource('case-study'); }
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Étude indisponible'); }
    };
    void load();
    return () => controller.abort();
  }, [eligible, field?.id, field?.latitude, field?.longitude]);

  return (
    <section className="apple-card p-4 sm:p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="rounded-xl bg-emerald-500/15 p-2 text-emerald-300"><Leaf className="w-5 h-5"/></span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white">Soil Intelligence</h3>
            <p className="text-[11px] text-white/50">Sols · relief · risque d’érosion</p>
          </div>
        </div>
        <span className="text-[10px] text-emerald-200 bg-emerald-500/10 px-2 py-1 rounded-full shrink-0">{data ? 'RUSLE 1.0' : 'À explorer'}</span>
      </div>
      {!eligible && <div className="text-xs text-white/60">L’étude géospatiale calculée couvre actuellement Castelnaudary. Sélectionnez la Parcelle du Moulin pour consulter ses scénarios.</div>}
      {eligible && error && <p className="text-xs text-rose-200">{error}</p>}
      {eligible && !data && !error && <p className="text-xs text-white/55">Chargement de l’analyse du sol…</p>}
      {data && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-white/[0.05] p-3">
              <p className="text-[10px] text-white/45">Vulnérabilité · indice</p>
              <p className="text-2xl font-semibold text-white">{data.vulnerability_index.score_0_100}<span className="text-xs text-white/40">/100</span></p>
              <p className="text-[11px] text-emerald-300 capitalize">{data.vulnerability_index.band}</p>
            </div>
            <div className="rounded-2xl bg-white/[0.05] p-3">
              <p className="text-[10px] text-white/45">Érosion potentielle RUSLE</p>
              <p className="text-2xl font-semibold text-white">{data.rusle_baseline.soil_loss_t_ha_yr.toFixed(2)}</p>
              <p className="text-[11px] text-white/55">t/ha/an · estimation</p>
            </div>
          </div>
          {!compact && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-white/80">Impact des scénarios</p>
              {data.scenarios.map((s) => (
                <div key={s.scenario} className="flex items-center gap-2 text-[11px]">
                  <span className="w-[45%] text-white/60 leading-tight">{LABELS[s.scenario] || s.scenario}</span>
                  <div className="flex-1 h-2.5 bg-white/10 rounded-full overflow-hidden"><div className={`h-full rounded-full ${s.scenario === 'wetter_climate' ? 'bg-amber-400' : s.scenario === 'baseline' ? 'bg-sky-400' : 'bg-emerald-400'}`} style={{ width: `${Math.min(100, 100 * s.soil_loss_t_ha_yr / Math.max(1, ...data.scenarios.map((x) => x.soil_loss_t_ha_yr)))}%` }}/></div>
                  <span className="w-12 text-right font-mono">{s.soil_loss_t_ha_yr.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
          {!compact && data.inputs && <div className="flex flex-wrap gap-2 text-[10px] text-white/55">
            {data.inputs.soil && <span className="rounded-full px-2 py-1 bg-white/5">Argile {data.inputs.soil.clay_pct}% · pH {data.inputs.soil.ph_h2o}</span>}
            {data.inputs.slope && <span className="rounded-full px-2 py-1 bg-white/5 flex gap-1 items-center"><Mountain className="w-3 h-3" />Pente {data.inputs.slope.mean_deg}°</span>}
            {data.inputs.rainfall && <span className="rounded-full px-2 py-1 bg-white/5 flex gap-1 items-center"><Waves className="w-3 h-3" />Pluie historique {data.inputs.rainfall.annual_precip_mm_mean} mm/an</span>}
          </div>}
          <p className="text-[10px] text-white/40 leading-relaxed">
            {source === 'api' ? 'Moteur géospatial' : 'Étude calculée et archivée'} · {data.study_area.name} · {data.model_version}.
            Estimation RUSLE fondée sur SoilGrids, ERA5, DEM et paramètres publiés. La carte couvre une zone d’étude, pas chaque parcelle française.
          </p>
          {!compact && <a className="text-[11px] text-sky-300 flex items-center gap-1 hover:underline" href="https://github.com/Eric-Kambire/LegumAmies/blob/feature/geospatial-soil-foundation/reports/soil-intelligence/RESULTS.md" target="_blank" rel="noopener noreferrer">Méthode et hypothèses <ArrowUpRight className="w-3 h-3"/></a>}
        </>
      )}
    </section>
  );
};
