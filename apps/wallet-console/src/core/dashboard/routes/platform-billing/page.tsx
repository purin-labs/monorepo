import React from 'react';
import { t } from '@core/i18n';
import { PlatformBillingView } from '../billing/PlatformBillingView';

/** Support billing for every organization. The dashboard opens this route only for a
    platform support session, and the Console API checks the same claim. */
export function PlatformBillingPage(): React.JSX.Element {
  return (
    <div className="dashboard-view" aria-label={t('billingPageLabel')}>
      <PlatformBillingView />
    </div>
  );
}
