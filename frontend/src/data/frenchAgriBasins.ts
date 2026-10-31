import type { LegumeCropType } from '../types/agricultural';

export interface FrenchAgriBasin {
  id: string;
  name: string;
  region: string;
  department: string;
  latitude: number;
  longitude: number;
  typicalCrops: LegumeCropType[];
  description: string;
  zoomLevel: number;
}

export const FRENCH_AGRI_BASINS: FrenchAgriBasin[] = [
  {
    id: 'lauragais',
    name: 'Castelnaudary (Lauragais)',
    region: 'Occitanie',
    department: 'Aude (11)',
    latitude: 43.3183,
    longitude: 1.9538,
    typicalCrops: ['pois_chiche', 'feverole', 'haricot_sec', 'lentille'],
    description: 'Bassin emblématique des légumineuses du Sud-Ouest et du haricot de Castelnaudary.',
    zoomLevel: 11,
  },
  {
    id: 'beauce',
    name: 'Chartres (Beauce)',
    region: 'Centre-Val de Loire',
    department: 'Eure-et-Loir (28)',
    latitude: 48.4561,
    longitude: 1.484,
    typicalCrops: ['pois', 'feverole'],
    description: 'Grenier à grains français, production majeure de pois protéagineux et féveroles.',
    zoomLevel: 11,
  },
  {
    id: 'berry',
    name: 'Châteauroux (Berry)',
    region: 'Centre-Val de Loire',
    department: 'Indre (36)',
    latitude: 46.8115,
    longitude: 1.6989,
    typicalCrops: ['lentille', 'pois'],
    description: 'Berceau de la Lentille verte du Berry (IGP / Label Rouge).',
    zoomLevel: 11,
  },
  {
    id: 'puy',
    name: 'Le Puy-en-Velay',
    region: 'Auvergne-Rhône-Alpes',
    department: 'Haute-Loire (43)',
    latitude: 45.0428,
    longitude: 3.883,
    typicalCrops: ['lentille'],
    description: 'Terroir volcanique AOP de la célèbre Lentille verte du Puy.',
    zoomLevel: 12,
  },
  {
    id: 'champagne',
    name: 'Châlons (Champagne)',
    region: 'Grand Est',
    department: 'Marne (51)',
    latitude: 48.9567,
    longitude: 4.3644,
    typicalCrops: ['pois', 'lupin', 'feverole'],
    description: 'Terres de craie propices aux pois protéagineux et au lupin blanc.',
    zoomLevel: 11,
  },
  {
    id: 'gers',
    name: 'Auch (Gers)',
    region: 'Occitanie',
    department: 'Gers (32)',
    latitude: 43.6465,
    longitude: 0.5856,
    typicalCrops: ['soja', 'pois_chiche'],
    description: 'Leader français du soja sans OGM et des cultures biologiques de plein champ.',
    zoomLevel: 11,
  },
  {
    id: 'alsace',
    name: 'Colmar (Plaine d\'Alsace)',
    region: 'Grand Est',
    department: 'Haut-Rhin (68)',
    latitude: 48.0794,
    longitude: 7.3582,
    typicalCrops: ['soja'],
    description: 'Climat semi-continental abrité idéal pour le soja de haute qualité.',
    zoomLevel: 11,
  },
];
