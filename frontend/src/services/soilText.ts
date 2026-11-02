/**
 * The geospatial backend returns English prose (disclaimer, assumptions, limitations).
 * Known sentences are shown in French; unknown ones are passed through unchanged, never rewritten.
 */
const FR: Record<string, string> = {
  'Model-estimated erosion potential under stated assumptions; not a field measurement. Coverage: single study area (Castelnaudary), not nationwide.':
    "Potentiel d'érosion estimé par modèle, sous hypothèses explicites ; ce n'est pas une mesure de terrain. Couverture : une seule zone d'étude (Castelnaudary), pas la France entière.",
  'Plough-layer OC = depth-weighted 0-15 cm (0-5 & 5-15 cm SoilGrids).':
    'Carbone organique de la couche labourée : moyenne pondérée 0-15 cm (SoilGrids 0-5 et 5-15 cm).',
  'Slope length not measured; 100 m assumed (varied 50-150 m).':
    'Longueur de pente non mesurée : 100 m supposés (50 à 150 m testés).',
  'R-factor literature-derived (Panagos 2015); scenario range used.':
    'Facteur R issu de la littérature (Panagos 2015) ; plage de scénarios utilisée.',
  'Exploratory EXPOSURE index (0–100), not a RUSLE soil-loss rate (t/ha/yr).':
    "Indice d'EXPOSITION exploratoire (0–100), pas un taux de perte de sol RUSLE (t/ha/an).",
  'Rainfall erosivity uses an ERA5 heavy-rain proxy, not the ESDAC R-factor.':
    "L'érosivité des pluies utilise un indicateur de pluies intenses ERA5, pas le facteur R de l'ESDAC.",
  'Soil erodibility uses modelled SoilGrids texture/SOC; structure & permeability absent.':
    "L'érodibilité du sol utilise la texture et le carbone organique modélisés par SoilGrids ; structure et perméabilité absentes.",
  'LS approximated by slope only (no flow-accumulation / slope length).':
    "LS approximé par la pente seule (sans accumulation d'écoulement ni longueur de pente).",
  'Cover/crop factors are proxies (NDVI / declared crop), not calibrated C-factors.':
    'Les facteurs de couverture et de culture sont des approximations (NDVI, culture déclarée), pas des facteurs C calibrés.',
  'Support-practice (P) information is typically unknown; not included.':
    'Les pratiques de conservation (P) sont généralement inconnues ; elles ne sont pas incluses.',
  'Not validated against field erosion measurements; do not use for compliance or loss claims.':
    "Non validé par des mesures d'érosion au champ ; à ne pas utiliser pour la conformité ni pour chiffrer des pertes.",
};

export const frenchSoilText = (text: string): string => FR[text.trim()] ?? text;
