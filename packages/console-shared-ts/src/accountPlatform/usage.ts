import {
  contractResult,
  digestValue,
  exactKeys,
  integer,
  invalidContract,
  object,
  textValue,
  utcTimestamp,
  versionOne,
  type PlatformContractError,
  type PlatformResult,
} from './boundary';
import type { DurableSourceEvidenceV1 } from './instances';
import type { PlatformScopeV1, PlatformServiceIdV1 } from './scope';

export type PlatformMeterIdV1 = 'wallet.monthly_active_resource' | 'wallet.execution';

export type WalletMonthlyResourceUsageV1 = {
  readonly meterId: 'wallet.monthly_active_resource';
  readonly quantity: 1;
  readonly unit: 'resource_month';
  readonly evidence: DurableSourceEvidenceV1 & {
    readonly kind: 'wallet_resource';
    readonly environmentId: string;
    readonly resourceId: string;
    readonly reservationId?: never;
  };
};

export type WalletExecutionUsageV1 = {
  readonly meterId: 'wallet.execution';
  readonly quantity: 1;
  readonly unit: 'execution';
  readonly evidence: DurableSourceEvidenceV1 & {
    readonly kind: 'wallet_execution';
    readonly environmentId: string;
    readonly executionId: string;
    readonly quoteVersion: string;
    readonly quotedAt: string;
    readonly reservationId: string;
  };
};

export type PlatformUsageMeasureV1 = WalletMonthlyResourceUsageV1 | WalletExecutionUsageV1;

/** Producer authority comes from authenticated transport, outside the payload. */
export class PlatformUsageEventV1 {
  readonly version = 1;

  private constructor(
    readonly eventId: string,
    readonly instanceId: string,
    readonly occurredAt: string,
    readonly measure: PlatformUsageMeasureV1,
  ) {
    this.seal();
  }

  private seal(): void {
    Object.freeze(this);
  }

  static parse(input: unknown): PlatformResult<PlatformUsageEventV1, PlatformContractError> {
    return contractResult(PlatformUsageEventV1.read, input);
  }

  private static read(input: unknown): PlatformUsageEventV1 {
    const record = object(input, 'usage');
    exactKeys(record, [
      'version',
      'eventId',
      'instanceId',
      'occurredAt',
      'meterId',
      'quantity',
      'unit',
      'evidence',
    ]);
    versionOne(record.version);
    return new PlatformUsageEventV1(
      textValue(record.eventId, 'eventId'),
      textValue(record.instanceId, 'instanceId'),
      utcTimestamp(record.occurredAt, 'occurredAt'),
      readUsageMeasure(record),
    );
  }

  toJSON(): Record<string, unknown> {
    return {
      version: this.version,
      eventId: this.eventId,
      instanceId: this.instanceId,
      occurredAt: this.occurredAt,
      meterId: this.measure.meterId,
      quantity: this.measure.quantity,
      unit: this.measure.unit,
      evidence: this.measure.evidence,
    };
  }
}

function readUsageMeasure(record: Record<string, unknown>): PlatformUsageMeasureV1 {
  const evidence = object(record.evidence, 'evidence');
  const sourceRecordId = textValue(evidence.sourceRecordId, 'sourceRecordId');
  const sourceDigest = digestValue(evidence.sourceDigest, 'sourceDigest');
  switch (record.meterId) {
    case 'wallet.monthly_active_resource':
      exactKeys(evidence, [
        'kind',
        'sourceRecordId',
        'sourceDigest',
        'environmentId',
        'resourceId',
      ]);
      if (
        evidence.kind !== 'wallet_resource' ||
        record.quantity !== 1 ||
        record.unit !== 'resource_month'
      ) {
        return invalidContract('measure');
      }
      return Object.freeze({
        meterId: record.meterId,
        quantity: 1,
        unit: record.unit,
        evidence: Object.freeze({
          kind: evidence.kind,
          sourceRecordId,
          sourceDigest,
          environmentId: textValue(evidence.environmentId, 'environmentId'),
          resourceId: textValue(evidence.resourceId, 'resourceId'),
        }),
      });
    case 'wallet.execution':
      exactKeys(evidence, [
        'kind',
        'sourceRecordId',
        'sourceDigest',
        'environmentId',
        'executionId',
        'quoteVersion',
        'quotedAt',
        'reservationId',
      ]);
      if (
        evidence.kind !== 'wallet_execution' ||
        record.quantity !== 1 ||
        record.unit !== 'execution'
      ) {
        return invalidContract('measure');
      }
      return Object.freeze({
        meterId: record.meterId,
        quantity: 1,
        unit: record.unit,
        evidence: Object.freeze({
          kind: evidence.kind,
          sourceRecordId,
          sourceDigest,
          environmentId: textValue(evidence.environmentId, 'environmentId'),
          executionId: textValue(evidence.executionId, 'executionId'),
          quoteVersion: textValue(evidence.quoteVersion, 'quoteVersion'),
          quotedAt: utcTimestamp(evidence.quotedAt, 'quotedAt'),
          reservationId: textValue(evidence.reservationId, 'reservationId'),
        }),
      });
    default:
      return invalidContract('meterId');
  }
}

export type BillingChargeAttributionV1 =
  | {
      readonly kind: 'instance';
      readonly scope: PlatformScopeV1;
      readonly serviceId: PlatformServiceIdV1;
      readonly instanceId: string;
    }
  | {
      readonly kind: 'historical_organization';
      readonly namespace: string;
      readonly organizationId: string;
      readonly billingAccountId: string;
      readonly scope?: never;
      readonly serviceId?: never;
      readonly instanceId?: never;
    };

export type PlatformUsageReceiptV1 =
  | {
      readonly kind: 'charged';
      readonly chargeId: string;
      readonly amountMinor: number;
      readonly priceVersion: string;
      readonly reason?: never;
    }
  | {
      readonly kind: 'recorded_without_charge';
      readonly reason: 'meter_already_counted' | 'nonbillable_outcome';
      readonly chargeId?: never;
      readonly amountMinor?: never;
      readonly priceVersion?: never;
    };

export type UsageRecordingResultV1 = PlatformResult<
  PlatformUsageReceiptV1,
  {
    readonly code:
      | 'scope_forbidden'
      | 'meter_unknown'
      | 'event_conflict'
      | 'price_unavailable'
      | 'insufficient_funds';
  }
>;

export type PlatformUsageEventDataV1 = Readonly<{
  version: 1;
  eventId: string;
  instanceId: string;
  occurredAt: string;
}> &
  PlatformUsageMeasureV1;

export class ReserveFundsRequestV1 {
  readonly version = 1;

  private constructor(
    readonly operationId: string,
    readonly instanceId: string,
    readonly executionId: string,
    readonly requestedMinor: number,
    readonly priceVersion: string,
  ) {
    this.seal();
  }

  private seal(): void {
    Object.freeze(this);
  }

  static parse(input: unknown): PlatformResult<ReserveFundsRequestV1, PlatformContractError> {
    return contractResult(ReserveFundsRequestV1.read, input);
  }

  private static read(input: unknown): ReserveFundsRequestV1 {
    const record = object(input, 'reservation');
    exactKeys(record, [
      'version',
      'operationId',
      'instanceId',
      'executionId',
      'requestedMinor',
      'priceVersion',
    ]);
    versionOne(record.version);
    return new ReserveFundsRequestV1(
      textValue(record.operationId, 'operationId'),
      textValue(record.instanceId, 'instanceId'),
      textValue(record.executionId, 'executionId'),
      integer(record.requestedMinor, 'requestedMinor', 0),
      textValue(record.priceVersion, 'priceVersion'),
    );
  }
}

/** Free plan counts. Only production environments produce these facts. */
export type PlatformPlanUsageMeasureV1 =
  | {
      readonly kind: 'production_active_user';
      readonly environmentId: string;
      readonly userKey: string;
      readonly signatureId?: never;
    }
  | {
      readonly kind: 'production_signature';
      readonly environmentId: string;
      readonly signatureId: string;
      readonly userKey?: never;
    };

/** A plan usage fact carries no price; shared billing counts it once per key and month. */
export class PlatformPlanUsageEventV1 {
  readonly version = 1;
  readonly kind = 'plan_usage';

  private constructor(
    readonly eventId: string,
    readonly instanceId: string,
    readonly occurredAt: string,
    readonly measure: PlatformPlanUsageMeasureV1,
  ) {
    this.seal();
  }

  private seal(): void {
    Object.freeze(this);
  }

  static parse(input: unknown): PlatformResult<PlatformPlanUsageEventV1, PlatformContractError> {
    return contractResult(PlatformPlanUsageEventV1.read, input);
  }

  private static read(input: unknown): PlatformPlanUsageEventV1 {
    const record = object(input, 'planUsage');
    exactKeys(record, ['version', 'kind', 'eventId', 'instanceId', 'occurredAt', 'measure']);
    versionOne(record.version);
    if (record.kind !== 'plan_usage') return invalidContract('kind');
    const measure = object(record.measure, 'measure');
    const environmentId = textValue(measure.environmentId, 'environmentId');
    let value: PlatformPlanUsageMeasureV1;
    switch (measure.kind) {
      case 'production_active_user':
        exactKeys(measure, ['kind', 'environmentId', 'userKey']);
        value = Object.freeze({
          kind: measure.kind,
          environmentId,
          userKey: textValue(measure.userKey, 'userKey'),
        });
        break;
      case 'production_signature':
        exactKeys(measure, ['kind', 'environmentId', 'signatureId']);
        value = Object.freeze({
          kind: measure.kind,
          environmentId,
          signatureId: textValue(measure.signatureId, 'signatureId'),
        });
        break;
      default:
        return invalidContract('measure.kind');
    }
    return new PlatformPlanUsageEventV1(
      textValue(record.eventId, 'eventId'),
      textValue(record.instanceId, 'instanceId'),
      utcTimestamp(record.occurredAt, 'occurredAt'),
      value,
    );
  }

  toJSON(): Record<string, unknown> {
    return {
      version: this.version,
      kind: this.kind,
      eventId: this.eventId,
      instanceId: this.instanceId,
      occurredAt: this.occurredAt,
      measure: this.measure,
    };
  }
}

export type PlanUsageRecordingResultV1 = PlatformResult<
  { readonly kind: 'counted' | 'already_counted' | 'not_production' },
  { readonly code: 'scope_forbidden' | 'billing_credit_exhausted' }
>;
