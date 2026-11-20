import React from 'react';
import { SiteNavbar, type NavbarStaticProps } from '@seams-internal/site-navbar';
import { ArrowRightAnim } from '../ArrowRightAnim';
import PurinWordmark from '../icons/PurinWordmark';
import { useSiteRouter } from '@/app/router/useSiteRouter';
import { getSiteNavbarConfig } from './navbarConfig';
import { useLocale } from '@/i18n/browser';
import { LanguageSelector } from '@/i18n/LanguageSelector';

export type { NavbarStaticProps };

/* The shared navbar asks for a wordmark 17px high, the size of a wide, low mark.
   The Purin wordmark is taller for its width, so it takes more of the 36px row. */
function NavbarWordmark({ className }: { className?: string }): React.JSX.Element {
  return <PurinWordmark className={className} height={26} />;
}

export function NavbarStatic(props: NavbarStaticProps = {}): React.JSX.Element {
  const router = useSiteRouter();
  const locale = useLocale();
  return (
    <SiteNavbar
      {...props}
      config={getSiteNavbarConfig(locale)}
      languageSelector={<LanguageSelector placement="navbar" />}
      router={router}
      Wordmark={NavbarWordmark}
      Arrow={ArrowRightAnim}
    />
  );
}

export default NavbarStatic;
