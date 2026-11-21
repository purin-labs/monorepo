import { getActiveFrontendDeployment, selectNetwork } from '@core/runtime';
import type { TopbarContextState } from './types';
import {
  DASHBOARD_UI_QUERY_KEYS,
  persistDashboardSelectedContext,
  readPersistedDashboardSelectedContext,
} from './useDashboardUiPreferences';

/** The overview of an organization and project on this Console origin. */
export function consoleOverviewHref(
  context: Pick<TopbarContextState, 'organization' | 'project'>,
): string {
  const url = new URL('/dashboard/overview', window.location.origin);
  setConsoleContext(url, context);
  return url.pathname + url.search;
}

/* The organization and project that a URL requested, kept in this tab until a signed-in
   dashboard opens. Sign-in carries only this request: a selection that is only saved can
   come from another account in this browser, and as a request it would block the
   dashboard instead of giving way. The GitHub callback returns without URL parameters,
   so the request cannot live in the URL alone. */
const SIGN_IN_CONTEXT_STORAGE_KEY = 'seams-dashboard-sign-in-context-v1';

type ConsoleContextRequest = Pick<TopbarContextState, 'organization' | 'project'>;

export function readConsoleSignInContext(): ConsoleContextRequest {
  try {
    const parsed: unknown = JSON.parse(
      window.sessionStorage.getItem(SIGN_IN_CONTEXT_STORAGE_KEY) || 'null',
    );
    if (!parsed || typeof parsed !== 'object') return { organization: '', project: '' };
    const record = parsed as Partial<Record<keyof ConsoleContextRequest, unknown>>;
    return {
      organization: typeof record.organization === 'string' ? record.organization : '',
      project: typeof record.project === 'string' ? record.project : '',
    };
  } catch {
    return { organization: '', project: '' };
  }
}

export function forgetConsoleSignInContext(): void {
  try {
    window.sessionStorage.removeItem(SIGN_IN_CONTEXT_STORAGE_KEY);
  } catch {}
}

export function rememberConsoleContext(): void {
  const parameters = new URLSearchParams(window.location.search);
  const organization = parameters.get(DASHBOARD_UI_QUERY_KEYS.organization);
  const project = parameters.get(DASHBOARD_UI_QUERY_KEYS.project);
  // Names only what the URL gives, so a new organization drops the saved project.
  persistDashboardSelectedContext({
    ...(organization === null ? {} : { organization }),
    ...(project === null ? {} : { project }),
  });
  if (organization !== null || project !== null) {
    const request: ConsoleContextRequest = {
      organization: organization ?? '',
      project: project ?? '',
    };
    try {
      window.sessionStorage.setItem(SIGN_IN_CONTEXT_STORAGE_KEY, JSON.stringify(request));
    } catch {}
  }
  selectNetwork(getActiveFrontendDeployment().network);
}

function setConsoleContext(
  url: URL,
  context: Pick<TopbarContextState, 'organization' | 'project'>,
): void {
  url.searchParams.set('db_network', getActiveFrontendDeployment().network);
  if (context.organization)
    url.searchParams.set(DASHBOARD_UI_QUERY_KEYS.organization, context.organization);
  if (context.project) url.searchParams.set(DASHBOARD_UI_QUERY_KEYS.project, context.project);
}

export function consoleSessionHref(
  pathname:
    | '/dashboard'
    | '/dashboard/login'
    | '/dashboard/onboarding'
    | '/dashboard/invitations/accept',
): string {
  const selected = readPersistedDashboardSelectedContext();
  const url = new URL(pathname, window.location.origin);
  setConsoleContext(url, {
    organization: selected.organization ?? '',
    project: selected.project ?? '',
  });
  return url.pathname + url.search;
}

/** A page of the sign-in flow, with the organization and project that a URL requested. */
export function consoleSignInHref(
  pathname:
    | '/dashboard'
    | '/dashboard/login'
    | '/dashboard/onboarding'
    | '/dashboard/invitations/accept',
): string {
  const url = new URL(pathname, window.location.origin);
  setConsoleContext(url, readConsoleSignInContext());
  return url.pathname + url.search;
}
