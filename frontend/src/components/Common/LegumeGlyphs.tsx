import React from 'react';
import type { LegumeCropType, CropGrowthStage } from '../../types/agricultural';

interface GlyphProps {
  className?: string;
  size?: number;
}

/**
 * Clean, artisanal SVG vector glyphs for French legume species.
 * Replaces cartoon emojis/stickers with Apple-grade typographic symbols.
 */
export const CropGlyph: React.FC<GlyphProps & { crop: LegumeCropType }> = ({
  crop,
  className = 'w-5 h-5',
  size = 20,
}) => {
  switch (crop) {
    case 'pois_chiche':
      // Chickpea: Characteristic rounded seed with small beaked rostrum
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M12 3.5C10.5 4.5 7.5 7 7.5 12C7.5 16.5 10 20 13.5 20C17.5 20 20 16.5 20 12C20 8.5 17.5 5 13.5 3.5C13 3.3 12.5 3.3 12 3.5Z" />
          <path d="M12 7.5C11 8.5 10.5 10.5 11 12" strokeWidth="1.4" opacity="0.6" />
        </svg>
      );

    case 'lentille':
      // Lentil: Double overlapping biconvex lens disks
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <ellipse cx="10" cy="13" rx="6.5" ry="4.5" transform="rotate(-15 10 13)" />
          <ellipse cx="14" cy="11" rx="6.5" ry="4.5" transform="rotate(-15 14 11)" opacity="0.65" />
        </svg>
      );

    case 'feverole':
      // Fava Bean: Oblong substantial legume seed with hilum scar
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M7 8C6 11 6.5 16 9.5 18.5C13 21 17.5 19.5 18.5 15.5C19.5 11.5 18 6.5 14 5C10.5 3.5 7.8 5.5 7 8Z" />
          <path d="M10 6C11 6.5 12.5 7 13.5 6.5" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );

    case 'pois':
      // Field Pea: Graceful pod revealing 3 spherical peas
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M4 19C7 19 19 18 20 5C14 5 5 11 4 19Z" />
          <circle cx="8.5" cy="14.5" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="12.5" cy="12.5" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="16" cy="9.5" r="1.6" fill="currentColor" stroke="none" />
        </svg>
      );

    case 'soja':
      // Soybean: Trifoliate leaf shoot & oval seed
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M12 21V12" />
          <path d="M12 12C12 7 8 5 8 5C8 8.5 9.5 11.5 12 12Z" />
          <path d="M12 12C12 7 16 5 16 5C16 8.5 14.5 11.5 12 12Z" />
          <circle cx="12" cy="16.5" r="2.2" strokeWidth="1.6" />
        </svg>
      );

    case 'lupin':
      // Lupin: Palmate / digitate compound leaf cluster
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M12 21V13" />
          <path d="M12 13C12 7 12 4 12 4" />
          <path d="M12 13C9 9 6 8 6 8" />
          <path d="M12 13C15 9 18 8 18 8" />
          <path d="M12 13C8.5 12 4 13 4 13" />
          <path d="M12 13C15.5 12 20 13 20 13" />
        </svg>
      );

    case 'haricot_sec':
    default:
      // Dry bean: Classic kidney bean curvature
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M8 6C5.5 8 4.5 12 6 15.5C7.5 19 11.5 20.5 15.5 19C19 17.5 20.5 13.5 19 10C17.5 6.5 14 4.5 11 5C9.5 5.5 9 6.5 8 6Z" />
          <circle cx="12" cy="11" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
  }
};

/**
 * Vector glyphs for crop phenological growth stages.
 */
export const StageGlyph: React.FC<GlyphProps & { stage: CropGrowthStage }> = ({
  stage,
  className = 'w-5 h-5',
  size = 20,
}) => {
  switch (stage) {
    case 'vegetatif':
      // Vegetative: Seedling & foliar development emerging from the soil
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <line x1="3" y1="17" x2="21" y2="17" strokeDasharray="3 2" opacity="0.5" />
          <path d="M12 17V8" />
          <path d="M12 11C9.5 9.5 8 7 8 7C10.5 7 12 9 12 11Z" />
          <path d="M12 11C14.5 9.5 16 7 16 7C13.5 7 12 9 12 11Z" />
        </svg>
      );

    case 'floraison':
      // Flowering: Pulse blossom flower petals
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M12 21V14" />
          <path d="M12 14C9.5 14 7.5 11.5 8 9C8.5 6.5 11 5 12 5C13 5 15.5 6.5 16 9C16.5 11.5 14.5 14 12 14Z" />
          <path d="M8.5 11C6.5 10 5.5 8 6 6C7.5 6 9.5 7.5 9.5 9.5" opacity="0.6" />
          <path d="M15.5 11C17.5 10 18.5 8 18 6C16.5 6 14.5 7.5 14.5 9.5" opacity="0.6" />
        </svg>
      );

    case 'formation_gousses':
      // Pod development: Growing legume pod on stem
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M7 21C8 17 9 12 7 6" />
          <path d="M7 11C12 9 17 10 19 15C16 17 11 16 7 11Z" />
          <circle cx="11.5" cy="12.5" r="1" fill="currentColor" stroke="none" />
          <circle cx="14.5" cy="13.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      );

    case 'remplissage_grain':
      // Grain filling: Swelling pod with accumulating starch and protein grains
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M4 18C7 18 19 17 20 6C15 6 5 11 4 18Z" />
          <circle cx="9" cy="14" r="2.2" strokeWidth="1.5" />
          <circle cx="14" cy="11.5" r="2.2" strokeWidth="1.5" />
        </svg>
      );

    case 'pret_recolter':
    default:
      // Ready to harvest: Mature ripe pod & harvest indicator
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M5 19L19 5" />
          <path d="M19 5C15 5 12 8 12 12C12 15 15 19 19 19C19 15 16 12 12 12" />
          <path d="M8 16L4 20" strokeWidth="2.2" />
          <path d="M7 13L11 17" opacity="0.7" />
        </svg>
      );
  }
};
