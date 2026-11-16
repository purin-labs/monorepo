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
  flavorDetails,
  flavorLabel,
  flavors,
  formatBalance,
  formatPrice,
  formatTokenAmount,
  prices,
  shop,
  subtotalCents,
  tastingSet,
  totalCents,
  type CheckoutChoice,
  type Delivery,
  type Flavor,
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

function TokenBadge({ token }: { token: SampleToken }): React.JSX.Element {
  return (
    <span className="checkout-token" data-token={token.symbol} aria-hidden="true">
      {token.symbol === 'JPYC' ? '¥' : '$'}
    </span>
  );
}

function Checkout(): React.JSX.Element {
  const [flavor, setFlavor] = React.useState<Flavor>('plain');
  const [open, setOpen] = React.useState(false);
  const [outcome, setOutcome] = React.useState('');
  const finish = React.useCallback((message: string) => {
    setOpen(false);
    setOutcome(message);
  }, []);
  return (
    <section className="checkout-product" aria-labelledby="checkout-product-title">
      <img
        className="checkout-product-image"
        src={flavorDetails(flavor).image}
        alt={t('productImageAlt').replaceAll('{flavor}', flavorLabel(flavor))}
        width={700}
        height={500}
      />
      <div className="checkout-product-heading">
        <span className="checkout-eyebrow">{shop.name}</span>
        <h1 id="checkout-product-title">{t('productBaumkuchen')}</h1>
      </div>
      <p className="checkout-price">{formatPrice(prices.baumkuchen)}</p>
      <div className="checkout-swatches" role="radiogroup" aria-label={t('flavor')}>
        {flavors.map(({ id, swatch }) => (
          <label key={id}>
            <input
              type="radio"
              name="checkout-flavor"
              value={id}
              checked={flavor === id}
              onChange={() => setFlavor(id)}
            />
            <span className="checkout-swatch" style={{ background: swatch }} />
            <span>{flavorLabel(id)}</span>
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
      {open ? <CheckoutReview flavor={flavor} onFinish={finish} /> : null}
    </section>
  );
}

function CheckoutReview({
  flavor,
  onFinish,
}: {
  flavor: Flavor;
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
        flavor={flavor}
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
  flavor,
  choice,
  onDelivery,
  onToken,
  controls,
}: {
  flavor: Flavor;
  choice: CheckoutChoice;
  onDelivery: (delivery: Delivery) => void;
  onToken: (token: SampleToken) => void;
  controls: TransactionReviewControls;
}): React.JSX.Element {
  const total = totalCents(choice.delivery);
  return (
    <>
      <ul className="checkout-items" aria-label={t('yourCart')}>
        <li>
          <img src={flavorDetails(flavor).thumb} alt="" width={36} height={36} />
          <span>
            {t('productBaumkuchen')}
            <small>{flavorLabel(flavor)} · ×1</small>
          </span>
          <span>{formatPrice(prices.baumkuchen)}</span>
        </li>
        <li>
          <img src={tastingSet.thumb} alt="" width={36} height={36} />
          <span>
            {t('productTastingSet')}
            <small>{t('tastingSetFlavors')} · ×1</small>
          </span>
          <span>{formatPrice(prices.tastingSet)}</span>
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
        <dt className="checkout-total">{t('total')}</dt>
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
