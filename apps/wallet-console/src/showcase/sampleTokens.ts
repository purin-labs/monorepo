import { locale } from '@/marketing/i18n/browser';
import type {
  TxDisplayField,
  TxDisplayModel,
} from '@wallet-ui/core/signingEngine/interfaces/display';

/* The stablecoin each language's demos pay with: USDC on Base in English and
   JPYC on Ethereum in Japanese. The contracts are the real ones, so the wallet
   names the token and shows its artwork; the accounts and amounts are samples
   and nothing is signed or sent. */

type SampleToken = {
  readonly symbol: string;
  readonly decimals: number;
  readonly contract: string;
  readonly chainId: number;
  readonly network: string;
  readonly explorer: string;
  readonly fee: string;
  /** What the demos move, in whole tokens. */
  readonly sampleAmount: string;
};

const usdcOnBase: SampleToken = {
  symbol: 'USDC',
  decimals: 6,
  contract: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  chainId: 8453,
  network: 'Base',
  explorer: 'https://basescan.org/',
  fee: '0.000001',
  sampleAmount: '15',
};

const jpycOnEthereum: SampleToken = {
  symbol: 'JPYC',
  decimals: 18,
  contract: '0xe7c3d8c9a439fede00d2600032d5db0be71c3c29',
  chainId: 1,
  network: 'Ethereum',
  explorer: 'https://etherscan.io/',
  fee: '0.00005',
  sampleAmount: '1500',
};

export const stablecoin = locale === 'ja' ? jpycOnEthereum : usdcOnBase;

export const sampleEvmAccount = `0x4201${'0'.repeat(32)}891c`;

/** An ERC-20 transfer as the wallet reviews it: the token amount is the headline. */
export function tokenTransferModel(transfer: {
  readonly recipient: string;
  readonly label: string;
  readonly fields?: TxDisplayField[];
}): TxDisplayModel {
  const token = stablecoin;
  const baseUnits = BigInt(token.sampleAmount) * 10n ** BigInt(token.decimals);
  return {
    chain: 'evm',
    chainId: token.chainId,
    signerAccount: sampleEvmAccount,
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
        baseUnits: baseUnits.toString(),
        amount: { value: token.sampleAmount, symbol: token.symbol, verified: true },
      },
    },
    totals: { estimatedFee: token.fee, feeSymbol: 'ETH' },
  };
}
