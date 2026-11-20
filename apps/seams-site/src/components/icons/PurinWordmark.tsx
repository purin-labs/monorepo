import React from 'react';
import { PURIN_BRAND_ASSETS } from '@/context/purinBranding';

export type PurinWordmarkProps = {
  /** Height of the complete wordmark and symbol. */
  height?: number;
  className?: string;
  style?: React.CSSProperties;
};

const PurinWordmark: React.FC<PurinWordmarkProps> = ({ height = 28, className, style }) => (
  <span
    role="img"
    aria-label="Purin"
    className={['purin-wordmark', className].filter(Boolean).join(' ')}
    style={{
      height,
      width: height * PURIN_BRAND_ASSETS.wordmarkRatio,
      maskImage: `url("${PURIN_BRAND_ASSETS.wordmark}")`,
      ...style,
    }}
  />
);

export default PurinWordmark;
