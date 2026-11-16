import { locale, t } from '@/marketing/i18n/browser';
import { paymentTokens, type SampleToken } from './sampleTokens';

/* The sample shop that both checkout frames describe: a tote bag with a
   notebook already in the cart. Prices are in US cents; the Japanese page
   shows yen at a fixed sample rate and pays in JPYC first. */

export type Color = 'sand' | 'olive' | 'black';
export type Delivery = 'standard' | 'express';

export const colors: readonly { readonly id: Color; readonly swatch: string }[] = [
  { id: 'sand', swatch: '#d8c4a0' },
  { id: 'olive', swatch: '#6b6f4a' },
  { id: 'black', swatch: '#2c2b29' },
];

export const shop = {
  name: 'Studio North',
  order: '2048',
  wallet: `0x5A1E${'0'.repeat(32)}0542`,
} as const;

const yenPerDollar = 150;
const shopCurrency = locale === 'ja' ? 'JPY' : 'USD';
const toteCents = 4800;
const notebookCents = 1200;
const expressCents = 900;

// Sample wallet balances, shown beside each way to pay.
const balances: Readonly<Record<SampleToken['id'], number>> = {
  'usdc-base': 250,
  'usdt-ethereum': 120,
  'jpyc-ethereum': 25_000,
};

export const prices = {
  tote: toteCents,
  notebook: notebookCents,
  express: expressCents,
} as const;

export function colorLabel(color: Color): string {
  switch (color) {
    case 'sand':
      return t('colorSand');
    case 'olive':
      return t('colorOlive');
    case 'black':
      return t('colorBlack');
  }
}

export function subtotalCents(): number {
  return toteCents + notebookCents;
}

export function totalCents(delivery: Delivery): number {
  return subtotalCents() + (delivery === 'express' ? expressCents : 0);
}

function inCurrency(cents: number, currency: SampleToken['currency']): number {
  return currency === 'JPY' ? (cents / 100) * yenPerDollar : cents / 100;
}

function numberFormat(currency: SampleToken['currency']): Intl.NumberFormat {
  return new Intl.NumberFormat(locale === 'ja' ? 'ja-JP' : 'en-US', {
    minimumFractionDigits: currency === 'JPY' ? 0 : 2,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  });
}

/** A price as the shop shows it: dollars in English, yen in Japanese. */
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat(locale === 'ja' ? 'ja-JP' : 'en-US', {
    style: 'currency',
    currency: shopCurrency,
  }).format(inCurrency(cents, shopCurrency));
}

/** The amount the wallet transfers: whole units and at most two decimals, no grouping. */
export function tokenAmount(token: SampleToken, cents: number): string {
  const value = inCurrency(cents, token.currency);
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/** The same amount for the shop's own panel, grouped and with its symbol. */
export function formatTokenAmount(token: SampleToken, cents: number): string {
  return `${numberFormat(token.currency).format(inCurrency(cents, token.currency))} ${token.symbol}`;
}

export function formatBalance(token: SampleToken): string {
  return numberFormat(token.currency).format(balances[token.id]);
}

/** Shown when the token's currency is not the shop's, so the total can be checked. */
export function exchangeRate(token: SampleToken): string | null {
  if (token.currency === shopCurrency) return null;
  return `1 ${token.symbol} = ${formatPrice(token.currency === 'USD' ? 100 : 100 / yenPerDollar)}`;
}

export type CheckoutChoice = {
  readonly token: SampleToken;
  readonly delivery: Delivery;
};

export function choiceQuery(choice: CheckoutChoice): string {
  return `pay=${choice.token.id}&delivery=${choice.delivery}`;
}

export function choiceFrom(params: URLSearchParams): CheckoutChoice {
  const pay = params.get('pay');
  return {
    token: paymentTokens.find((token) => token.id === pay) ?? paymentTokens[0],
    delivery: params.get('delivery') === 'express' ? 'express' : 'standard',
  };
}
