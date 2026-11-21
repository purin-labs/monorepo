import React from 'react';
import { DashboardPage } from '@core/dashboard/page';
import { DashboardLoginPage } from '@core/dashboard/login/page';
import { InvitationAcceptancePage } from '@core/dashboard/routes/invitations/page';
import { DashboardToaster } from '@core/dashboard/components/DashboardToaster';
import { normalizePathname } from '@core/router/siteRouting';
import { DASHBOARD_COMPOSITION } from './dashboardConfig';

function readLocation(): string {
  return window.location.pathname + window.location.search + window.location.hash;
}

function subscribeLocation(update: () => void): () => void {
  window.addEventListener('popstate', update);
  window.addEventListener('site:navigate', update);
  return unsubscribeLocation.bind(null, update);
}

function unsubscribeLocation(update: () => void): void {
  window.removeEventListener('popstate', update);
  window.removeEventListener('site:navigate', update);
}

export function ConsoleApp(): React.JSX.Element {
  const location = React.useSyncExternalStore(subscribeLocation, readLocation, readLocation);
  const pathname = normalizePathname(location);
  if (pathname === '/dashboard/invitations/accept') return <InvitationAcceptancePage />;
  if (pathname === '/dashboard/login') return <DashboardLoginPage />;
  return (
    <>
      <DashboardPage
        composition={DASHBOARD_COMPOSITION}
        pathname={pathname === '/' ? '/dashboard' : pathname}
      />
      <DashboardToaster />
    </>
  );
}
