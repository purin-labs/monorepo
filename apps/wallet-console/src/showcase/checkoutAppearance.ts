import type { AppearanceConfig } from '@wallet-ui/core/types/seams';
import { locale } from '@/marketing/i18n/browser';
import { showcaseAppearance } from './showcaseTheme';

/* The sample shop's green, for its own buttons and choices and for the
   wallet's buttons. Light button text on it keeps AA contrast. */
const checkoutPalette = {
  accent: '#2b7a52',
  accentHover: '#236645',
  onAccent: '#fdfcfc',
  strong: '#2b7a52',
  tint: '#edf6f0',
} as const;

/** Sets the palette as the --checkout-* properties that checkout.css reads. */
export function applyCheckoutPalette(element: HTMLElement): void {
  element.style.setProperty('--checkout-accent', checkoutPalette.accent);
  element.style.setProperty('--checkout-accent-hover', checkoutPalette.accentHover);
  element.style.setProperty('--checkout-on-accent', checkoutPalette.onAccent);
  element.style.setProperty('--checkout-accent-strong', checkoutPalette.strong);
  element.style.setProperty('--checkout-tint', checkoutPalette.tint);
}

/* The homepage's preview theme with the sample shop's green, shared by the
   checkout dialog's shell and the wallet approval inside it. */
export function checkoutAppearance(): AppearanceConfig {
  const appearance = showcaseAppearance(locale);
  return {
    ...appearance,
    theme: {
      ...appearance.theme,
      colors: {
        ...appearance.theme.colors,
        buttonBackground: checkoutPalette.accent,
        buttonHoverBackground: checkoutPalette.accentHover,
        textButton: checkoutPalette.onAccent,
        focus: checkoutPalette.strong,
      },
    },
  };
}
