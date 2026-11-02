import React, { useEffect, useState } from 'react';
import { AlertTriangle, Info, Loader2, Mountain } from 'lucide-react';
import type { SelectedField } from '../../types/agricultural';
import { fetchSoilIntelligence, type SoilFetchResult, type SoilScenarioRow } from '../../services/soilApi';
import { frenchSoilText } from '../../services/soilText';

interface SoilIntelligencePanelProps {
  field: SelectedField;
}

const SCENARIO_LABELS: Record<string, string> = {
  baseline: 'Situation de référence',
  wetter_climate: 'Climat plus pluvieux (R +30 %)',
  improved_cover_management: 'Couverture et travail du sol améliorés',
};

const BAND_STYLE: Record<string, string> = {
  faible: 'text-emerald-300',
  modéré: 'text-amber-300',
  élevé: 'text-rose-300',
};

const fmt = (v: number | undefined | null, digits = 1) =>
  v === undefined || v === null || Number.isNaN(v) ? 'n.d.' : v.toLocaleString('fr-FR', { maximumFractionDigits: digits });

// One request per field per session: the panel is opened on demand and re-opening must not re-fetch.
const cache = new Map<string, SoilFetchResult>();

/**
 * Compact soil intelligence. Everything shown comes from the geospatial API response.
 * If the API cannot answer (not deployed, out of the validated zone), the panel says so
 * and displays no number.
 */
export const SoilIntelligencePanel: React.FC<SoilIntelligencePanelProps> = ({ field }) => {
  const key = `${field.id}:${field.latitude.toFixed(3)}:${field.longitude.toFixed(3)}`;
  const [fetched, setFetched] = useState<{ key: string; result: SoilFetchResult } | null>(() => {
    const hit = cache.get(key);
    return hit ? { key, result: hit } : null;
  });

  useEffect(() => {
    if (cache.has(key)) return;
    const controller = new AbortController();
    fetchSoilIntelligence(field, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (result.status !== 'error') cache.set(key, result);
      setFetched({ key, result });
    });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const result = fetched?.key === key ? fetched.result : (cache.get(key) ?? null);

  if (!result) {
    return (
      <div className="apple-card p-5 flex items-center gap-3 text-xs text-white/70" role="status" data-testid="soil-loading">
        <Loader2 className="w-4 h-4 animate-spin text-[#38bdf8]" aria-hidden="true" />
        Interrogation du modèle de sol…
      </div>
    );
  }

  if (result.status !== 'ok') {
    const title =
      result.status === 'out_of_coverage'
        ? 'Hors zone validée'
        : result.status === 'unavailable'
          ? 'Modèle de sol non disponible'
          : 'Modèle de sol injoignable';
    return (
      <div className="apple-card p-4 flex items-start gap-3 text-xs text-white/70 leading-relaxed" role="status" data-testid={`soil-${result.status}`}>
        <Mountain className="w-5 h-5 text-white/40 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <p className="font-semibold text-white">{title}</p>
          <p className="mt-0.5">{result.message}</p>
          <p className="mt-1.5 text-white/45">
            La vulnérabilité à l'érosion et les scénarios RUSLE sont calculés pour la zone d'étude de Castelnaudary (Lauragais) seulement. Aucun score n'est
            inventé ailleurs.
          </p>
        </div>
      </div>
    );
  }

  const { risk, soil } = result;
  const vi = risk.vulnerability_index;
  const baseline = risk.rusle_baseline?.soil_loss_t_ha_yr;
  const scenarios: SoilScenarioRow[] = risk.scenarios ?? [];
  const maxLoss = Math.max(...scenarios.map((s) => s.soil_loss_t_ha_yr), baseline ?? 0, 1);
  const tornado = [...(risk.sensitivity_tornado ?? [])].sort((a, b) => b.swing - a.swing);
  const maxSwing = Math.max(...tornado.map((t) => t.swing), 1);
  const texture = soil?.modelled?.[0];

  return (
    <div className="flex flex-col gap-3" data-testid="soil-panel">
      <p className="text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2 leading-relaxed">
        Zone d'étude : {risk.study_area?.name ?? 'Castelnaudary'}. {risk.disclaimer ? frenchSoilText(risk.disclaimer) : ''}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="apple-card p-4" data-testid="soil-index">
          <p className="text-[10px] uppercase tracking-wider text-white/45 font-semibold">Indice d'exposition à l'érosion</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-white">{fmt(vi?.score_0_100, 1)}</span>
            <span className="text-xs text-white/50">/ 100</span>
            {vi?.band && <span className={`text-sm font-semibold ${BAND_STYLE[vi.band] ?? 'text-white'}`}>{vi.band}</span>}
          </p>
          <p className="text-[11px] text-white/50 mt-1 leading-relaxed">
            Indicateur exploratoire d'exposition (pente, pluies intenses, texture, couverture). Ce n'est pas une perte de sol mesurée.
          </p>
        </div>

        <div className="apple-card p-4" data-testid="soil-rusle">
          <p className="text-[10px] uppercase tracking-wider text-white/45 font-semibold">Perte de sol estimée (RUSLE)</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-white">{fmt(baseline, 2)}</span>
            <span className="text-xs text-white/50">t/ha/an</span>
          </p>
          <p className="text-[11px] text-white/50 mt-1 leading-relaxed">
            Potentiel estimé par modèle ({risk.model_version}), plage plausible {fmt(risk.uncertainty_range?.A_min_t_ha_yr, 2)} à{' '}
            {fmt(risk.uncertainty_range?.A_max_t_ha_yr, 2)} t/ha/an.
          </p>
        </div>
      </div>

      {texture && (
        <div className="apple-card p-4 text-xs" data-testid="soil-texture">
          <p className="text-[10px] uppercase tracking-wider text-white/45 font-semibold mb-2">
            Texture du sol modélisée · profondeur {texture.depth_cm ?? '0-5'} cm
          </p>
          <dl className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-white/80">
            {[
              ['Argile', texture.clay_pct, '%'],
              ['Limon', texture.silt_pct, '%'],
              ['Sable', texture.sand_pct, '%'],
              ['Carbone org.', texture.soil_organic_carbon_g_per_kg, 'g/kg'],
              ['pH eau', texture.ph_h2o, ''],
            ].map(([label, value, unit]) => (
              <div key={String(label)} className="rounded-lg bg-white/[0.04] px-2.5 py-1.5">
                <dt className="text-[10px] text-white/45">{label}</dt>
                <dd className="font-mono">
                  {fmt(value as number | null | undefined)} {unit}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-[11px] text-white/45 mt-2">
            {texture.provenance?.source ?? 'SoilGrids'} · {texture.provenance?.resolution ?? '250 m'} · valeur modélisée, à confirmer par une analyse de sol.
          </p>
        </div>
      )}

      {scenarios.length > 0 && (
        <div className="apple-card p-4" data-testid="soil-scenarios">
          <p className="text-[10px] uppercase tracking-wider text-white/45 font-semibold mb-2">Comparaison de scénarios (t/ha/an)</p>
          <ul className="flex flex-col gap-2.5">
            {scenarios.map((s) => (
              <li key={s.scenario}>
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="text-white/85">{SCENARIO_LABELS[s.scenario] ?? s.scenario}</span>
                  <span className="font-mono text-white">
                    {fmt(s.soil_loss_t_ha_yr, 2)}
                    {s.pct_vs_baseline ? (
                      <span className={s.pct_vs_baseline > 0 ? 'text-rose-300' : 'text-emerald-300'}>
                        {' '}
                        ({s.pct_vs_baseline > 0 ? '+' : ''}
                        {fmt(s.pct_vs_baseline, 0)} %)
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="h-2 mt-1 rounded-full bg-black/35 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${s.scenario === 'baseline' ? 'bg-sky-400' : (s.pct_vs_baseline ?? 0) > 0 ? 'bg-rose-400' : 'bg-emerald-400'}`}
                    style={{ width: `${Math.max(3, (s.soil_loss_t_ha_yr / maxLoss) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-white/45 mt-2">
            Scénarios hypothétiques : ils comparent des hypothèses de paramètres, ils ne prédisent pas l'avenir.
          </p>
        </div>
      )}

      {tornado.length > 0 && (
        <div className="apple-card p-4" data-testid="soil-sensitivity">
          <p className="text-[10px] uppercase tracking-wider text-white/45 font-semibold mb-2">Facteurs les plus sensibles</p>
          <ul className="flex flex-col gap-1.5">
            {tornado.map((t) => (
              <li key={t.factor} className="flex items-center gap-2 text-xs">
                <span className="w-7 font-mono text-white/80">{t.factor}</span>
                <span className="flex-1 h-2 rounded-full bg-black/35 overflow-hidden">
                  <span className="block h-full rounded-full bg-violet-400" style={{ width: `${Math.max(3, (t.swing / maxSwing) * 100)}%` }} />
                </span>
                <span className="w-28 text-right font-mono text-white/60">
                  {fmt(t.A_low, 1)} à {fmt(t.A_high, 1)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="apple-card p-4 text-xs text-white/65 leading-relaxed">
        <summary className="cursor-pointer text-[#38bdf8]">Méthode, hypothèses et limites</summary>
        <p className="mt-2 font-mono text-white/80">{risk.equation}</p>
        {risk.assumptions && (
          <ul className="list-disc pl-4 mt-2">
            {risk.assumptions.map((a, i) => (
              <li key={i}>{frenchSoilText(a)}</li>
            ))}
          </ul>
        )}
        {vi?.limitations && (
          <ul className="list-disc pl-4 mt-2 text-white/50">
            {vi.limitations.map((l, i) => (
              <li key={i}>{frenchSoilText(l)}</li>
            ))}
          </ul>
        )}
        <p className="mt-2 flex items-start gap-1.5 text-white/45">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" aria-hidden="true" />
          Pente et pluviométrie entrent dans les facteurs LS et R. Les sources sont listées dans la réponse de l'API (
          {risk.sources?.length ?? 0}).
        </p>
      </details>

      {risk.generated_at_utc && (
        <p className="text-[10px] text-white/35 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" aria-hidden="true" /> Calculé le {new Date(risk.generated_at_utc).toLocaleString('fr-FR')}
        </p>
      )}
    </div>
  );
};
