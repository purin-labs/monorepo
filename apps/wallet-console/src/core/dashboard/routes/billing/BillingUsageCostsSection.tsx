import React from 'react';
import { t } from '@core/i18n';
import type { PlatformServiceIdV1 } from '@seams-internal/console-shared/accountPlatform';
import { assertNever } from '@seams-internal/console-shared/accountPlatform/boundary';
import {
  DashboardTable,
  DashboardTableCell,
  DashboardTableHeader,
  DashboardTableHeaderCell,
  DashboardTableIntro,
  DashboardTableRow,
  DashboardTableState,
  dashboardTableColumns,
} from '../../components/DashboardTable';
import {
  formatUsdMinor,
  type DashboardBillingCostsState,
  type DashboardBillingUsageCharges,
} from './consoleBillingApi';
import { BillingMetricsGrid } from './billingShared';
import { DashboardPageSkeleton } from '../../components/DashboardSkeleton';
import { platformServiceLabel } from '../services/serviceProjects';

interface BillingCostGroup {
  readonly id: string;
  readonly label: string;
  amountMinor: number;
}

interface BillingCostBreakdown {
  readonly totalMinor: number;
  readonly projects: readonly BillingCostGroup[];
  readonly meters: readonly BillingCostGroup[];
}

const COST_COLUMNS = dashboardTableColumns('2fr', '1fr');
const HISTORICAL_LABEL = t('billingHistoricalCharges');

function selectUsageCostMonth(event: React.ChangeEvent<HTMLInputElement>): void {
  const periodMonthUtc = event.currentTarget.value;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodMonthUtc)) return;
  const target = new URL(window.location.href);
  target.searchParams.set('periodMonthUtc', periodMonthUtc);
  target.hash = 'billing-usage-costs';
  window.location.assign(target);
}

function addCostGroup(
  groups: Map<string, BillingCostGroup>,
  id: string,
  label: string,
  amountMinor: number,
): void {
  const existing = groups.get(id);
  if (existing) {
    existing.amountMinor += amountMinor;
    return;
  }
  groups.set(id, { id, label, amountMinor });
}

function compareCostGroups(left: BillingCostGroup, right: BillingCostGroup): number {
  return left.label.localeCompare(right.label);
}

/** Keeps the charges attributed to one service; historical charges have no service. */
function scopedCharges(
  data: DashboardBillingUsageCharges,
  serviceId: PlatformServiceIdV1,
): DashboardBillingUsageCharges['charges'] {
  return data.charges.filter(
    (charge) => charge.kind === 'instance' && charge.attribution.serviceId === serviceId,
  );
}

function buildCostBreakdown(
  charges: DashboardBillingUsageCharges['charges'],
): BillingCostBreakdown {
  const projects = new Map<string, BillingCostGroup>();
  const meters = new Map<string, BillingCostGroup>();
  let totalMinor = 0;
  for (const charge of charges) {
    totalMinor += charge.amountMinor;
    switch (charge.kind) {
      case 'instance':
        addCostGroup(
          projects,
          `instance:${charge.attribution.scope.projectId}`,
          charge.attribution.scope.projectId,
          charge.amountMinor,
        );
        addCostGroup(meters, `instance:${charge.meterId}`, charge.meterId, charge.amountMinor);
        break;
      case 'historical_organization':
        addCostGroup(projects, 'historical_organization', HISTORICAL_LABEL, charge.amountMinor);
        addCostGroup(meters, 'historical_organization', HISTORICAL_LABEL, charge.amountMinor);
        break;
      default:
        assertNever(charge);
    }
  }
  return {
    totalMinor,
    projects: Array.from(projects.values()).sort(compareCostGroups),
    meters: Array.from(meters.values()).sort(compareCostGroups),
  };
}

function renderCostGroup(group: BillingCostGroup): React.JSX.Element {
  return (
    <DashboardTableRow key={group.id}>
      <DashboardTableCell title={group.label} truncate={false}>
        {group.label}
      </DashboardTableCell>
      <DashboardTableCell align="end">{formatUsdMinor(group.amountMinor)}</DashboardTableCell>
    </DashboardTableRow>
  );
}

function costDimensionLabel(dimension: 'project' | 'meter'): string {
  switch (dimension) {
    case 'project':
      return t('billingDimensionProject');
    case 'meter':
      return t('billingDimensionMeter');
  }
}

function BillingCostTable(props: {
  readonly dimension: 'project' | 'meter';
  readonly groups: readonly BillingCostGroup[];
}): React.JSX.Element {
  const dimensionLabel = costDimensionLabel(props.dimension);
  return (
    <DashboardTable
      ariaLabel={t('billingCostByDimensionLabel', { dimension: dimensionLabel })}
      columns={COST_COLUMNS}
    >
      <DashboardTableIntro>
        <h3 className="dashboard-billing-table__title">
          {t('billingCostByDimension', { dimension: dimensionLabel })}
        </h3>
      </DashboardTableIntro>
      {props.groups.length === 0 ? (
        <DashboardTableState>{t('billingNoUsageCosts')}</DashboardTableState>
      ) : (
        <>
          <DashboardTableHeader>
            <DashboardTableHeaderCell>{dimensionLabel}</DashboardTableHeaderCell>
            <DashboardTableHeaderCell>{t('billingPostedUsageCost')}</DashboardTableHeaderCell>
          </DashboardTableHeader>
          {props.groups.map(renderCostGroup)}
        </>
      )}
    </DashboardTable>
  );
}

/** Shows the usage that is attributed to one service. */
export function BillingUsageCostsSection(props: {
  readonly organizationId: string;
  readonly state: DashboardBillingCostsState;
  readonly serviceId: PlatformServiceIdV1;
}): React.JSX.Element {
  const { state, organizationId, serviceId } = props;
  const serviceLabel = platformServiceLabel(serviceId);
  if (state.kind === 'unavailable' || state.organizationId !== organizationId) {
    return <p className="dashboard-pagination-note">{t('billingUsageCostsUnavailableOrg')}</p>;
  }
  switch (state.kind) {
    case 'loading':
      return (
        <DashboardPageSkeleton
          label={t('billingLoadingUsageCosts')}
          metrics={0}
          rows={3}
          columns={4}
        />
      );
    case 'failed':
      return (
        <p className="dashboard-pagination-note" role="alert">
          {t('billingUsageCostsUnavailable', { error: state.message })}
        </p>
      );
    case 'ready': {
      if (state.data.organizationId !== organizationId) {
        return (
          <p className="dashboard-pagination-note" role="alert">
            {t('billingUsageCostsMismatch')}
          </p>
        );
      }
      const costs = buildCostBreakdown(scopedCharges(state.data, serviceId));
      return (
        <section
          id="billing-usage-costs"
          className="dashboard-view__section dashboard-view__section--plain"
          aria-label={t('billingServiceUsageCostsLabel', { service: serviceLabel })}
        >
          <h2>{t('billingServiceUsageCostsLabel', { service: serviceLabel })}</h2>
          <label className="dashboard-form-field">
            <span>{t('billingUsageCostMonth')}</span>
            <input
              type="month"
              className="dashboard-input"
              value={state.data.periodMonthUtc}
              onChange={selectUsageCostMonth}
            />
          </label>
          <p className="dashboard-pagination-note">
            {t('billingPostedUsageIntro', { period: state.data.periodMonthUtc })}
          </p>
          <BillingMetricsGrid
            ariaLabel={t('billingPostedUsageTotalLabel')}
            metrics={[
              {
                label: t('billingPostedUsageCost'),
                value: formatUsdMinor(costs.totalMinor),
                hint: t('billingCostTotalHint', {
                  subject: serviceLabel,
                  period: state.data.periodMonthUtc,
                }),
              },
            ]}
          />
          <p className="dashboard-pagination-note">
            {t('billingServiceOnlyNote', { service: serviceLabel })}
          </p>
          <div className="dashboard-view-grid">
            <BillingCostTable dimension="project" groups={costs.projects} />
            <BillingCostTable dimension="meter" groups={costs.meters} />
          </div>
        </section>
      );
    }
    default:
      return assertNever(state);
  }
}
