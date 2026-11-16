import { locale, t } from '@/marketing/i18n/browser';
import './embeddedFocus';
import '@wallet-ui/sdk/wallet-ui.css';
import './showcase.css';
import {
  mountConfirmationSurface,
  type ConfirmationSurfaceHandle,
  type ConfirmSurfaceModel,
} from '@wallet-ui/core/signingEngine/uiConfirm/ui/preact/mountConfirmationSurface';
import { buildDisplayTreeFromModel } from '@wallet-ui/core/signingEngine/uiConfirm/ui/transaction-display/tree';
import type {
  TransactionReceiptState,
  TransactionReceiptView,
} from '@wallet-ui/core/signingEngine/uiConfirm/ui/transaction-receipt';
import type {
  TxDisplayField,
  TxDisplayModel,
} from '@wallet-ui/core/signingEngine/interfaces/display';
import { VoicePrompt } from '@seams/voice-capture/card';
import { showcaseAppearance, showcasePreset } from './showcaseTheme';
import { schedulePlayback } from './playbackClock';
import { playReceiptLifecycle } from './receiptLifecycle';
import { transitionReceiptView } from './receiptTransition';
import { sendExplorerLinksHome } from './sampleExplorer';
import { configureModalBackdrop } from './modalBackdrop';
import { sampleEvmAccount, stablecoin, stablecoinAmount, tokenTransferModel } from './sampleTokens';

configureModalBackdrop();

type DemoState =
  | { readonly kind: 'review' }
  | { readonly kind: 'voice'; readonly prompt: VoicePrompt; readonly playback: VoicePlayback }
  | { readonly kind: 'receipt'; readonly prompt: VoicePrompt };

type SampleTrade = {
  readonly transaction: TxDisplayModel;
  readonly network: string;
  readonly explorer: string;
  readonly receiptHash: string;
};

const nearExplorer = 'https://nearblocks.io/';

function tradeLabel(asset: string): string {
  return t('voiceTradeAction').replaceAll('{asset}', asset).replaceAll('{receiveAsset}', 'USDC');
}

function tradeFields(minimumReceived: string, account: string): TxDisplayField[] {
  return [
    { label: t('minimumReceived'), value: `${minimumReceived} USDC` },
    { label: t('slippageLimit'), value: '0.5%' },
    { label: t('receivingAccount'), value: account },
    { label: t('quoteValidity'), value: t('exampleQuoteValidity') },
  ];
}

/** The English page sells NEAR for USDC on NEAR. */
function nearTrade(): SampleTrade {
  const signer = 'alex.near';
  return {
    transaction: {
      chain: 'near',
      signerAccount: signer,
      operations: [
        {
          id: 'swap',
          kind: 'near.action',
          actionType: 'functionCall',
          label: tradeLabel('NEAR'),
          fields: tradeFields('28.40', signer),
        },
      ],
      totals: {
        nativeValue: '10',
        nativeSymbol: 'NEAR',
        estimatedFee: '0.00005',
        feeSymbol: 'NEAR',
      },
    },
    network: 'NEAR',
    explorer: nearExplorer,
    receiptHash: '4wBqpZM9xaSheZzJSMawUKKwhdpChKbZ5eu5ky4Vigw',
  };
}

/** The Japanese page sells JPYC for USDC: the wallet sends JPYC to the swap's deposit address. */
function stablecoinTrade(): SampleTrade {
  return {
    transaction: tokenTransferModel({
      token: stablecoin,
      amount: stablecoinAmount,
      signer: sampleEvmAccount,
      recipient: `0xD3F0${'0'.repeat(32)}5A11`,
      label: tradeLabel(stablecoin.symbol),
      fields: tradeFields('9.60', sampleEvmAccount),
    }),
    network: stablecoin.network,
    explorer: stablecoin.explorer,
    receiptHash: `0x3c9e${'0'.repeat(56)}5a17`,
  };
}

const trade = locale === 'ja' ? stablecoinTrade() : nearTrade();

/**
 * A VoiceID unlock opens a signing session, and the session signs without a
 * voice check per transaction. This demo starts with a session that has run
 * out, so Confirm with VoiceID steps the session up inside the confirm card:
 * the capture replaces the review, and the receipt then takes over the card.
 * The page simulates the capture and the signature without microphone or API
 * requests.
 */
export class VoiceIdDemo {
  private readonly stage: HTMLElement;
  private handle: ConfirmationSurfaceHandle | null = null;
  private state: DemoState = { kind: 'review' };
  private receipt: TransactionReceiptState = { kind: 'signing' };
  private view: TransactionReceiptView = 'expanded';
  private stopLifecycle: () => void = noPlayback;

  constructor() {
    const stage = document.getElementById('root');
    if (!stage) throw new Error('The VoiceID demo root is unavailable.');
    this.stage = stage;
    sendExplorerLinksHome(this.stage, trade.explorer);
    this.start();
  }

  private model(capture: HTMLElement | null): ConfirmSurfaceModel {
    return {
      appearance: showcaseAppearance(locale),
      content: {
        kind: 'transaction',
        capture,
        review: {
          model: trade.transaction,
          tree: buildDisplayTreeFromModel(trade.transaction),
          detailsInitiallyOpen: false,
        },
        header: {
          heading: t('reviewTrade'),
          website: { kind: 'ready', text: 'shop.example.com' },
          chainDetails: { kind: 'ready', text: trade.network },
        },
        body: { kind: 'empty' },
        prompt: { kind: 'session' },
        transaction: {
          tree: null,
          theme: showcasePreset.mode,
          explorers: { near: nearExplorer, evm: stablecoin.explorer },
          decision: { kind: 'ready', onConfirm: this.confirm },
          confirmText: t('confirmWithVoiceId'),
          cancelText: t('cancel'),
          onCancel: this.start,
        },
      },
    };
  }

  /** Every run starts at the trade review. */
  private start = (): void => {
    this.stopLifecycle();
    this.stopLifecycle = noPlayback;
    if (this.state.kind === 'voice') this.state.playback.stop();
    if (this.state.kind !== 'review') this.state.prompt.dispose();
    this.state = { kind: 'review' };
    this.view = 'expanded';
    this.handle?.dispose();
    this.handle = mountConfirmationSurface({
      parent: this.stage,
      presentation: { variant: 'modal', context: 'wallet-iframe' },
      model: this.model(null),
      onClosed: noPlayback,
    });
  };

  private confirm = (): void => {
    if (this.state.kind !== 'review') return;
    const prompt = new VoicePrompt(
      document,
      t('confirmWithVoiceId'),
      'the market is open',
      'segments',
    );
    // The confirm card's toolbar closes the step-up, as in the SDK.
    prompt.record.hidden = true;
    prompt.cancel.hidden = true;
    this.state = { kind: 'voice', prompt, playback: new VoicePlayback(prompt, this.sign) };
    this.handle?.update(this.model(prompt.element));
  };

  /** The voice check renewed the session, so the wallet signs and the receipt follows. */
  private sign = (): void => {
    if (this.state.kind !== 'voice') return;
    this.state = { kind: 'receipt', prompt: this.state.prompt };
    this.stopLifecycle = playReceiptLifecycle(this.showReceipt, trade.receiptHash);
  };

  private showReceipt = (state: TransactionReceiptState): void => {
    this.receipt = state;
    this.handle?.showReceipt({
      subject: 'transaction',
      state,
      view: this.view,
      onView: this.changeView,
      onDismiss: this.start,
    });
  };

  private changeView = (next: TransactionReceiptView): void => {
    if (!this.handle || next === this.view) return;
    this.view = next;
    transitionReceiptView(this.handle.element, next, this.showReceipt.bind(null, this.receipt));
  };
}

type VoicePlaybackState = 'listening' | 'checking' | 'settled' | 'cancelled';

/** The canvas clock controls the simulated speech and speaker check. */
class VoicePlayback {
  private state: VoicePlaybackState = 'listening';
  private stopDelay: () => void = noPlayback;
  private stopActivity: () => void = noPlayback;
  private tick = 0;

  constructor(
    private readonly prompt: VoicePrompt,
    private readonly verified: () => void,
  ) {
    prompt.element.dataset.tradeStage = this.state;
    prompt.title.textContent = t('voiceReadAloud');
    prompt.capture({ kind: 'listening' });
    prompt.status.textContent = t('voiceListening');
    this.activity();
    this.stopDelay = schedulePlayback(this.check, 3000);
  }

  stop = (): void => {
    this.state = 'cancelled';
    this.stopDelay();
    this.stopActivity();
  };

  private check = (): void => {
    if (this.state !== 'listening') return;
    this.state = 'checking';
    this.stopActivity();
    this.prompt.capture({ kind: 'activity', rms: 0, speech: false });
    this.prompt.capture({ kind: 'processing' });
    this.prompt.element.dataset.tradeStage = this.state;
    this.prompt.status.textContent = t('voiceChecking');
    this.stopDelay = schedulePlayback(this.finish, 1500);
  };

  private finish = (): void => {
    if (this.state !== 'checking') return;
    this.state = 'settled';
    this.verified();
  };

  private activity = (): void => {
    if (this.state !== 'listening') return;
    this.tick += 1;
    const syllable = Math.sin(this.tick * 0.45) ** 2;
    const contour = 0.7 + 0.3 * Math.sin(this.tick * 0.13);
    this.prompt.capture({ kind: 'activity', rms: 0.05 + syllable * contour * 0.13, speech: true });
    this.stopActivity = schedulePlayback(this.activity, 32);
  };
}

function noPlayback(): void {}
