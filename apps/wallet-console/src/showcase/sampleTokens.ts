import { locale } from '@/marketing/i18n/browser';
import type {
  TxDisplayField,
  TxDisplayModel,
} from '@wallet-ui/core/signingEngine/interfaces/display';

/* The stablecoins the demos pay with. The contracts are the real ones, so the
   wallet names each token and shows its artwork; the accounts and amounts are
   samples and nothing is signed or sent. */

export type SampleToken = {
  readonly id: 'usdc-base' | 'usdc-ethereum' | 'jpyc-ethereum';
  readonly symbol: string;
  readonly decimals: number;
  readonly contract: string;
  readonly chainId: number;
  readonly network: string;
  readonly explorer: string;
  readonly fee: string;
};

const usdcOnBase: SampleToken = {
  id: 'usdc-base',
  symbol: 'USDC',
  decimals: 6,
  contract: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  chainId: 8453,
  network: 'Base',
  explorer: 'https://basescan.org/',
  fee: '0.000001',
};

const usdcOnEthereum: SampleToken = {
  id: 'usdc-ethereum',
  symbol: 'USDC',
  decimals: 6,
  contract: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  chainId: 1,
  network: 'Ethereum',
  explorer: 'https://etherscan.io/',
  fee: '0.00005',
};

const jpycOnEthereum: SampleToken = {
  id: 'jpyc-ethereum',
  symbol: 'JPYC',
  decimals: 18,
  contract: '0xe7c3d8c9a439fede00d2600032d5db0be71c3c29',
  chainId: 1,
  network: 'Ethereum',
  explorer: 'https://etherscan.io/',
  fee: '0.00005',
};

/** English pages pay in USDC, Japanese pages in JPYC (which the wallet lists on Ethereum). */
export const paymentTokens: readonly SampleToken[] =
  locale === 'ja' ? [jpycOnEthereum] : [usdcOnBase, usdcOnEthereum];

export const stablecoin = paymentTokens[0];

/** What the transfer and VoiceID demos move, in whole tokens. */
export const stablecoinAmount = locale === 'ja' ? '1500' : '15';

export const sampleEvmAccount = `0x4201${'0'.repeat(32)}891c`;

function baseUnits(amount: string, decimals: number): string {
  const [whole, fraction = ''] = amount.split('.');
  return BigInt(whole + fraction.padEnd(decimals, '0')).toString();
}

/**
 * An ERC-20 transfer as the wallet reviews it: the token amount is the
 * headline. A sponsored transfer costs the sender no network fee, so the
 * review shows none. Without a signer the review leaves out its account card.
 */
export function tokenTransferModel(transfer: {
  readonly token: SampleToken;
  readonly amount: string;
  readonly signer: string | null;
  readonly recipient: string;
  readonly label: string;
  readonly fields?: TxDisplayField[];
  readonly sponsored?: boolean;
}): TxDisplayModel {
  const { token, amount } = transfer;
  return {
    chain: 'evm',
    chainId: token.chainId,
    ...(transfer.signer ? { signerAccount: transfer.signer } : {}),
    operations: [
      {
        id: 'transfer',
        kind: 'generic.contractCall',
        label: transfer.label,
        to: token.contract,
        ...(transfer.fields ? { fields: transfer.fields } : {}),
      },
    ],
    tokenTransfers: {
      layout: 'headline',
      transfer: {
        tokenContract: token.contract,
        recipient: transfer.recipient,
        baseUnits: baseUnits(amount, token.decimals),
        amount: { value: amount, symbol: token.symbol, verified: true },
      },
    },
    ...(transfer.sponsored ? {} : { totals: { estimatedFee: token.fee, feeSymbol: 'ETH' } }),
  };
}
