import { object, textValue } from '@seams-internal/console-shared/accountPlatform/boundary';
import { AuthenticatedAccountServiceProducerV1 } from './serviceIngressAuth';
import {
  createAccountPlatformServiceIngress,
  type AccountPlatformServiceIngressHandler,
} from './http';
import type { D1AccountServiceAccess } from './serviceAccess';
import type { D1AccountMembershipFacade } from './membershipFacade';
import type { ConsoleBillingPrepaidReservationService } from '../billingPrepaidReservations/service';
import type { D1BillingUsageService } from '../billing/usage';
import type { Logger } from '../boundary/logger';

export interface AccountServiceIngressEnvironment {
  readonly PANTRY_DEPLOYMENT_ID?: string;
  readonly PANTRY_ACCOUNT_ASSERTION_ISSUER?: string;
  readonly PANTRY_ACCOUNT_ASSERTION_AUDIENCE?: string;
  readonly PANTRY_ACCOUNT_USER_ASSERTION_KEY_ID?: string;
  readonly PANTRY_ACCOUNT_USER_ASSERTION_PUBLIC_JWK_JSON?: string;
  readonly PANTRY_GOOGLE_OIDC_CLIENT_ID?: string;
}

interface AccountServiceIngressServices {
  readonly serviceAccess: D1AccountServiceAccess;
  readonly serviceMemberships: D1AccountMembershipFacade;
  readonly funds: ConsoleBillingPrepaidReservationService;
  readonly billingUsage: D1BillingUsageService;
  readonly logger?: Logger | null;
}

function publicAssertionJwk(input: string): JsonWebKey {
  const record = object(JSON.parse(input), 'Pantry user assertion public JWK');
  if (record.kty !== 'OKP' || record.crv !== 'Ed25519' || record.d !== undefined) {
    throw new Error('Pantry user assertions require an Ed25519 public JWK');
  }
  return { kty: 'OKP', crv: 'Ed25519', x: textValue(record.x, 'public JWK x') };
}

export async function createAccountPlatformServiceIngressFromEnvironment(
  environment: AccountServiceIngressEnvironment,
  services: AccountServiceIngressServices,
): Promise<AccountPlatformServiceIngressHandler | null> {
  const producer = await createAccountServiceProducerFromEnvironment(environment);
  if (!producer) return null;
  return createAccountPlatformServiceIngress({
    producer,
    access: services.serviceAccess,
    memberships: services.serviceMemberships,
    funds: services.funds,
    billingUsage: services.billingUsage,
    logger: services.logger,
  });
}

export async function createAccountServiceProducerFromEnvironment(
  environment: AccountServiceIngressEnvironment,
): Promise<AuthenticatedAccountServiceProducerV1 | null> {
  const values = [
    environment.PANTRY_DEPLOYMENT_ID,
    environment.PANTRY_ACCOUNT_ASSERTION_ISSUER,
    environment.PANTRY_ACCOUNT_ASSERTION_AUDIENCE,
    environment.PANTRY_ACCOUNT_USER_ASSERTION_KEY_ID,
    environment.PANTRY_ACCOUNT_USER_ASSERTION_PUBLIC_JWK_JSON,
    environment.PANTRY_GOOGLE_OIDC_CLIENT_ID,
  ];
  let configured = false;
  for (const value of values) if (value !== undefined) configured = true;
  if (!configured) return null;
  return AuthenticatedAccountServiceProducerV1.fromServiceBinding({
    authority: {
      serviceId: 'satyr',
      deploymentId: textValue(environment.PANTRY_DEPLOYMENT_ID, 'PANTRY_DEPLOYMENT_ID'),
    },
    userAssertion: {
      issuer: textValue(
        environment.PANTRY_ACCOUNT_ASSERTION_ISSUER,
        'PANTRY_ACCOUNT_ASSERTION_ISSUER',
      ),
      audience: textValue(
        environment.PANTRY_ACCOUNT_ASSERTION_AUDIENCE,
        'PANTRY_ACCOUNT_ASSERTION_AUDIENCE',
      ),
      keyId: textValue(
        environment.PANTRY_ACCOUNT_USER_ASSERTION_KEY_ID,
        'PANTRY_ACCOUNT_USER_ASSERTION_KEY_ID',
      ),
      publicJwk: publicAssertionJwk(
        textValue(
          environment.PANTRY_ACCOUNT_USER_ASSERTION_PUBLIC_JWK_JSON,
          'PANTRY_ACCOUNT_USER_ASSERTION_PUBLIC_JWK_JSON',
        ),
      ),
    },
    googleClientId: textValue(
      environment.PANTRY_GOOGLE_OIDC_CLIENT_ID,
      'PANTRY_GOOGLE_OIDC_CLIENT_ID',
    ),
  });
}
