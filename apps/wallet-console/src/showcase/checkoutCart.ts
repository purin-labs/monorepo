import { locale, t } from '@/marketing/i18n/browser';
import { paymentTokens, type SampleToken } from './sampleTokens';
import plainThumb from './products/baumkuchen-plain-thumb.webp';
import matchaThumb from './products/baumkuchen-matcha-thumb.webp';

/* The sample shop's cart: a plain and a matcha baumkuchen. Prices are in US
   cents; the Japanese page shows yen at a fixed sample rate. Each page pays in
   its own stablecoin, so the amount to pay is the price in the shop's currency. */

export type Delivery = 'standard' | 'express';

export const cart: readonly {
  readonly id: string;
  readonly flavor: string;
  readonly thumb: string;
  readonly cents: number;
}[] = [
  { id: 'plain', flavor: t('flavorPlain'), thumb: plainThumb, cents: 1200 },
  { id: 'matcha', flavor: t('flavorMatcha'), thumb: matchaThumb, cents: 1400 },
];

export const shop = {
  name: t('shopName'),
  order: '2048',
  wallet: `0x5A1E${'0'.repeat(32)}0542`,
} as const;

const yenPerDollar = 150;
const shopCurrency = locale === 'ja' ? 'JPY' : 'USD';

export const expressCents = 600;

// Sample wallet balances, shown with each way to pay.
const balances: Readonly<Record<SampleToken['id'], number>> = {
  'usdc-base': 250,
  'usdc-ethereum': 120,
  'jpyc-ethereum': 25_000,
};

export function subtotalCents(): number {
  return cart.reduce((sum, item) => sum + item.cents, 0);
}

export function totalCents(delivery: Delivery): number {
  return subtotalCents() + (delivery === 'express' ? expressCents : 0);
}

function inShopCurrency(cents: number): number {
  return shopCurrency === 'JPY' ? (cents / 100) * yenPerDollar : cents / 100;
}

const numbers = new Intl.NumberFormat(locale === 'ja' ? 'ja-JP' : 'en-US', {
  minimumFractionDigits: shopCurrency === 'JPY' ? 0 : 2,
  maximumFractionDigits: shopCurrency === 'JPY' ? 0 : 2,
});

/** A price as the shop shows it: dollars in English, yen in Japanese. */
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat(locale === 'ja' ? 'ja-JP' : 'en-US', {
    style: 'currency',
    currency: shopCurrency,
  }).format(inShopCurrency(cents));
}

/** The amount the wallet transfers: whole units and at most two decimals, no grouping. */
export function tokenAmount(cents: number): string {
  const value = inShopCurrency(cents);
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/** The same amount for the shop's own panel, grouped and with its symbol. */
export function formatTokenAmount(token: SampleToken, cents: number): string {
  return `${numbers.format(inShopCurrency(cents))} ${token.symbol}`;
}

export function formatBalance(token: SampleToken): string {
  return numbers.format(balances[token.id]);
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
