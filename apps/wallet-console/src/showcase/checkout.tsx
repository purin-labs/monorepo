import { t } from '@/marketing/i18n/browser';
import './embeddedFocus';
import '@seams/wallet/react/styles';
import './showcase.css';
import './checkout.css';
import React from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { TransactionReviewControls } from '@seams/wallet/react';
import { CheckoutSession } from './checkoutSession';
import {
  colorLabel,
  colors,
  exchangeRate,
  formatBalance,
  formatPrice,
  formatTokenAmount,
  prices,
  shop,
  subtotalCents,
  totalCents,
  type CheckoutChoice,
  type Color,
  type Delivery,
} from './checkoutCart';
import { paymentTokens, type SampleToken } from './sampleTokens';
import { configureModalBackdrop } from './modalBackdrop';
import { applyCheckoutPalette } from './checkoutAppearance';

configureModalBackdrop();
applyCheckoutPalette(document.documentElement);

/* A sample shop's checkout: the shop's own product card and checkout panel,
   which hands off to the SDK's wallet approval in one resizing modal. The
   product card stays live behind the receipt toast, so the page is still
   usable while the payment settles. */

function swatch(color: Color): string {
  return colors.find((entry) => entry.id === color)?.swatch ?? colors[0].swatch;
}

function ToteArt({ color }: { color: Color }): React.JSX.Element {
  return (
    <svg className="checkout-art" viewBox="0 0 64 64" aria-hidden="true">
      <path
        d="M24 24v-5a8 8 0 0 1 16 0v5"
        fill="none"
        stroke="#7a5a3a"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path d="M15 24h34l-2.6 26.4a4 4 0 0 1-4 3.6H21.6a4 4 0 0 1-4-3.6Z" fill={swatch(color)} />
      <path d="M15.5 29h33" stroke="rgb(0 0 0 / 0.14)" strokeWidth="1.5" />
    </svg>
  );
}

function NotebookArt(): React.JSX.Element {
  return (
    <svg className="checkout-art" viewBox="0 0 64 64" aria-hidden="true">
      <rect x="19" y="13" width="26" height="38" rx="3" fill="#c49a6c" />
      <rect x="21" y="16" width="26" height="38" rx="3" fill="#d6b087" />
      <rect x="40" y="16" width="2.5" height="38" fill="#2c2b29" />
    </svg>
  );
}

function TokenBadge({ token }: { token: SampleToken }): React.JSX.Element {
  return (
    <span className="checkout-token" data-token={token.id} aria-hidden="true">
      {token.currency === 'JPY' ? '¥' : token.symbol === 'USDT' ? '₮' : '$'}
    </span>
  );
}

function Checkout(): React.JSX.Element {
  const [color, setColor] = React.useState<Color>('sand');
  const [open, setOpen] = React.useState(false);
  const [outcome, setOutcome] = React.useState('');
  const finish = React.useCallback((message: string) => {
    setOpen(false);
    setOutcome(message);
  }, []);
  return (
    <section className="checkout-product" aria-labelledby="checkout-product-title">
      <div className="checkout-product-art">
        <ToteArt color={color} />
      </div>
      <div className="checkout-product-heading">
        <span className="checkout-eyebrow">{shop.name}</span>
        <h1 id="checkout-product-title">{t('productTote')}</h1>
      </div>
      <p className="checkout-price">{formatPrice(prices.tote)}</p>
      <div className="checkout-swatches" role="radiogroup" aria-label={t('color')}>
        {colors.map(({ id }) => (
          <label key={id} title={colorLabel(id)}>
            <input
              type="radio"
              name="checkout-color"
              value={id}
              checked={color === id}
              onChange={() => setColor(id)}
            />
            <span className="checkout-swatch" style={{ background: swatch(id) }} />
            <span>{colorLabel(id)}</span>
          </label>
        ))}
      </div>
      <button
        className="checkout-buy"
        type="button"
        disabled={open}
        onClick={() => {
          setOutcome('');
          setOpen(true);
        }}
      >
        <span>{t('buyNow')}</span>
        <span aria-hidden="true">→</span>
      </button>
      {outcome ? (
        <p className="checkout-outcome" role="status">
          {outcome}
        </p>
      ) : null}
      {open ? <CheckoutReview color={color} onFinish={finish} /> : null}
    </section>
  );
}

function CheckoutReview({
  color,
  onFinish,
}: {
  color: Color;
  onFinish: (message: string) => void;
}): React.JSX.Element | null {
  const [session, setSession] = React.useState<CheckoutSession | null>(null);
  const [delivery, setDelivery] = React.useState<Delivery>('standard');
  const [token, setToken] = React.useState<SampleToken>(paymentTokens[0]);
  React.useEffect(() => {
    const next = new CheckoutSession(onFinish);
    setSession(next);
    return next.dispose;
  }, [onFinish]);
  if (!session) return null;
  const choice: CheckoutChoice = { token, delivery };
  return createPortal(
    <section className="seams-transaction-review-content checkout-review" ref={session.observe}>
      <div className="checkout-review-heading">
        <h2>{t('checkoutTitle')}</h2>
        <span className="checkout-eyebrow">
          {shop.name} · {t('orderNumber').replaceAll('{order}', shop.order)}
        </span>
      </div>
      <CheckoutPanel
        color={color}
        choice={choice}
        onDelivery={setDelivery}
        onToken={setToken}
        controls={{
          continueToWallet: () => session.continueToWallet(choice),
          cancel: session.cancel,
          fail: session.fail,
        }}
      />
    </section>,
    session.slot,
  );
}

function CheckoutPanel({
  color,
  choice,
  onDelivery,
  onToken,
  controls,
}: {
  color: Color;
  choice: CheckoutChoice;
  onDelivery: (delivery: Delivery) => void;
  onToken: (token: SampleToken) => void;
  controls: TransactionReviewControls;
}): React.JSX.Element {
  const total = totalCents(choice.delivery);
  const rate = exchangeRate(choice.token);
  return (
    <>
      <ul className="checkout-items" aria-label={t('yourCart')}>
        <li>
          <ToteArt color={color} />
          <span>
            {t('productTote')}
            <small>{colorLabel(color)} · ×1</small>
          </span>
          <span>{formatPrice(prices.tote)}</span>
        </li>
        <li>
          <NotebookArt />
          <span>
            {t('productNotebook')}
            <small>{t('notebookKraft')} · ×1</small>
          </span>
          <span>{formatPrice(prices.notebook)}</span>
        </li>
      </ul>
      <dl className="checkout-ship">
        <dt>{t('shipTo')}</dt>
        <dd>
          {t('sampleCustomer')}
          <small>{t('sampleAddress')}</small>
        </dd>
      </dl>
      <fieldset className="checkout-choices">
        <legend>{t('delivery')}</legend>
        <label>
          <input
            type="radio"
            name="checkout-delivery"
            checked={choice.delivery === 'standard'}
            onChange={() => onDelivery('standard')}
          />
          <span>
            {t('standardDelivery')}
            <small>{t('standardDays')}</small>
          </span>
          <strong>{t('free')}</strong>
        </label>
        <label>
          <input
            type="radio"
            name="checkout-delivery"
            checked={choice.delivery === 'express'}
            onChange={() => onDelivery('express')}
          />
          <span>
            {t('expressDelivery')}
            <small>{t('expressDays')}</small>
          </span>
          <strong>{formatPrice(prices.express)}</strong>
        </label>
      </fieldset>
      <fieldset className="checkout-choices">
        <legend>{t('payFromWallet')}</legend>
        {paymentTokens.map((token) => (
          <label key={token.id}>
            <input
              type="radio"
              name="checkout-token"
              checked={choice.token.id === token.id}
              onChange={() => onToken(token)}
            />
            <TokenBadge token={token} />
            <span>
              {token.symbol}{' '}
              <span className="checkout-network">
                {t('onNetwork').replaceAll('{network}', token.network)}
              </span>
              <small>{t('balance').replaceAll('{amount}', formatBalance(token))}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <dl className="checkout-totals">
        <dt>{t('subtotal')}</dt>
        <dd>{formatPrice(subtotalCents())}</dd>
        <dt>{t('shipping')}</dt>
        <dd>{choice.delivery === 'express' ? formatPrice(prices.express) : t('free')}</dd>
        <dt>{t('networkFee')}</dt>
        <dd>{t('paidByShop').replaceAll('{shop}', shop.name)}</dd>
        <dt className="checkout-total">
          {t('total')}
          {rate ? <span className="checkout-rate">{rate}</span> : null}
        </dt>
        <dd className="checkout-total">{formatTokenAmount(choice.token, total)}</dd>
      </dl>
      <div className="checkout-actions">
        <button className="checkout-confirm" type="button" onClick={controls.continueToWallet}>
          <span>
            {t('payTotal').replaceAll('{amount}', formatTokenAmount(choice.token, total))}
          </span>
          <span aria-hidden="true">→</span>
        </button>
        <button className="checkout-cancel" type="button" onClick={controls.cancel}>
          {t('backToShop')}
        </button>
      </div>
    </>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(<Checkout />);
