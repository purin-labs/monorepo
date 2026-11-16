import type { AppearanceConfig } from '@wallet-ui/core/types/seams';
import { locale } from '@/marketing/i18n/browser';
import { showcaseAppearance } from './showcaseTheme';

/* The sample shop's green, for its own buttons and choices and for the
   wallet's buttons. White text fails AA on #10B981, so buttons take dark green
   text; rings and focus outlines take a deeper green that shows on white. */
const checkoutPalette = {
  accent: '#10B981',
  accentHover: '#0EA371',
  onAccent: '#022C22',
  strong: '#047857',
  tint: '#A7F3D0',
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
