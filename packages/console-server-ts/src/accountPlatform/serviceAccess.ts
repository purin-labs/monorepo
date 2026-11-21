import type { ConsoleGoogleLoginResult } from '../boundary/providerIdentity';
import type { D1DatabaseLike } from '../boundary/d1';
import { ensureAccountServiceAccessD1Schema } from './accessSchema';

export interface D1AccountServiceAccessOptions {
  readonly database: D1DatabaseLike;
  readonly namespace: string;
  readonly now?: () => Date;
}

function now(): Date {
  return new Date();
}

export class D1AccountServiceAccess {
  private readonly database: D1DatabaseLike;
  private readonly namespace: string;
  private readonly clock: () => Date;

  constructor(options: D1AccountServiceAccessOptions) {
    this.database = options.database;
    this.namespace = options.namespace;
    this.clock = options.now ?? now;
  }

  async ensureSchema(): Promise<void> {
    await ensureAccountServiceAccessD1Schema(this.database);
  }

  async recordVerifiedGoogleIdentity(
    verified: Extract<ConsoleGoogleLoginResult, { readonly ok: true }>,
    verificationReceiptId: string,
  ): Promise<void> {
    if (verified.userId !== `google:${verified.sub}`) {
      throw new Error('Verified Google identity does not match its provider subject');
    }
    const email =
      verified.emailVerified === true && verified.email ? verified.email.toLowerCase() : null;
    await this.database
      .prepare(
        `INSERT INTO platform_provider_identities
      (namespace, user_id, provider_issuer, provider_subject, verification_receipt_id, verified_email, display_name, created_at_ms)
      VALUES (?, ?, 'https://accounts.google.com', ?, ?, ?, ?, ?)
      ON CONFLICT(namespace, user_id) DO UPDATE SET
        verified_email = excluded.verified_email,
        display_name = excluded.display_name`,
      )
      .bind(
        this.namespace,
        verified.userId,
        verified.sub,
        verificationReceiptId,
        email,
        verified.name ?? null,
        this.clock().getTime(),
      )
      .run();
  }
}
