/* The site palette. `DocumentThemeTokenBridge` in `src/app/App.tsx` writes each entry
   to the root element as `--seams-colors-<name>`, and the site styles read those
   variables. It is the "Paper" palette: eggshell paper, ink buttons, warm taupe and
   stone neutrals, and the teal of the teal-peach gradient for accents and focus. */

export const PAPER_LIGHT_COLORS: Record<string, string> = {
  primary: '#00769f',
  primaryHover: '#005f80',
  secondary: '#44403b',
  secondaryHover: '#000000',
  accent: '#00769f',

  textPrimary: '#000000',
  textSecondary: '#777169',
  textMuted: '#a59f97',
  textButton: '#fdfcfc',

  buttonBackground: '#000000',
  buttonHoverBackground: '#262626',
  // quiet bordered-white secondary (Google SSO): one black CTA per card,
  // like the ElevenLabs button hierarchy
  secondaryButtonBackground: '#ffffff',
  secondaryButtonHoverBackground: '#f5f3f1',
  secondaryButtonBorder: '#dcd6cd',
  secondaryButtonText: '#000000',

  // white menu card; the reference's eggshell #fdfcfc read too warm here
  colorBackground: '#ffffff',
  surface: '#ffffff',
  // chip behind the passkey halo icon: same subtle grey as the tx-details
  // box so the two read as one family
  passkeyHaloBackground: '#f8f8f7',
  surface2: '#f5f3f1',
  surface3: '#ebe8e4',
  surface4: '#e1ddd7',
  txDetailsBackground: '#f8f8f7',

  hover: '#f5f3f1',
  active: '#ebe8e4',
  focus: '#0082af',
  // teal-peach, deepened so every stop keeps 3:1 against the white field
  focusGradient: 'linear-gradient(90deg, #0082af 0%, #7a82ab 55%, #b9798a 100%)',

  success: '#157f5f',
  warning: '#b45309',
  error: '#ff4704',
  info: '#00769f',

  borderPrimary: '#ebe8e4',
  borderSecondary: '#e5e5e5',
  borderHover: '#d6d1cb',

  highlightPrimary: '#00769f',
  highlightRow: 'rgba(0, 130, 175, 0.12)',
  highlightHalo: '#bfe0ec',
  // one accent in the tx tree: the receiver/contract address. Method names
  // and amounts read in ink (ElevenLabs accent discipline).
  highlightReceiver: '#005f80',
  highlightMethodName: '#000000',
  highlightAmount: '#000000',
};
