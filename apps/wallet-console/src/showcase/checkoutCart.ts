import { locale, t } from '@/marketing/i18n/browser';
import { paymentTokens, type SampleToken } from './sampleTokens';
import plainImage from './products/baumkuchen-plain.webp';
import plainThumb from './products/baumkuchen-plain-thumb.webp';
import blackSesameImage from './products/baumkuchen-black-sesame.webp';
import blackSesameThumb from './products/baumkuchen-black-sesame-thumb.webp';
import matchaImage from './products/baumkuchen-matcha.webp';
import matchaThumb from './products/baumkuchen-matcha-thumb.webp';
import tastingSetThumb from './products/baumkuchen-set-thumb.webp';

/* The sample shop that both checkout frames describe: a baumkuchen in the
   chosen flavor, with a tasting set already in the cart. Prices are in US
   cents; the Japanese page shows yen at a fixed sample rate. Each page pays in
   its own stablecoin, so the amount to pay is the price in the shop's currency. */

export type Flavor = 'plain' | 'black-sesame' | 'matcha';
export type Delivery = 'standard' | 'express';

export const flavors: readonly {
  readonly id: Flavor;
  readonly swatch: string;
  readonly image: string;
  readonly thumb: string;
}[] = [
  { id: 'plain', swatch: '#e3c48d', image: plainImage, thumb: plainThumb },
  { id: 'black-sesame', swatch: '#3a3836', image: blackSesameImage, thumb: blackSesameThumb },
  { id: 'matcha', swatch: '#7c9a3a', image: matchaImage, thumb: matchaThumb },
];

export const tastingSet = { thumb: tastingSetThumb } as const;

export const shop = {
  name: t('shopName'),
  order: '2048',
  wallet: `0x5A1E${'0'.repeat(32)}0542`,
} as const;

const yenPerDollar = 150;
const shopCurrency = locale === 'ja' ? 'JPY' : 'USD';

export const prices = {
  baumkuchen: 1200,
  tastingSet: 1800,
  express: 600,
} as const;

// Sample wallet balances, shown with each way to pay.
const balances: Readonly<Record<SampleToken['id'], number>> = {
  'usdc-base': 250,
  'usdc-ethereum': 120,
  'jpyc-ethereum': 25_000,
};

export function flavorLabel(flavor: Flavor): string {
  switch (flavor) {
    case 'plain':
      return t('flavorPlain');
    case 'black-sesame':
      return t('flavorBlackSesame');
    case 'matcha':
      return t('flavorMatcha');
  }
}

export function flavorDetails(flavor: Flavor): (typeof flavors)[number] {
  return flavors.find((entry) => entry.id === flavor) ?? flavors[0];
}

export function subtotalCents(): number {
  return prices.baumkuchen + prices.tastingSet;
}

export function totalCents(delivery: Delivery): number {
  return subtotalCents() + (delivery === 'express' ? prices.express : 0);
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
