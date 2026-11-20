import { Building2, LayoutGrid, LifeBuoy } from 'lucide-react';
import type { SiteLocale } from './LanguageSelector';
import type { DropdownPane } from './SiteNavbar';

/* Links open the contact form with this target. Each site's router keeps the
   current page and adds the hash, so the form opens over that page. */
export const CONTACT_LINK_TARGET = '#contact';

// Each message requires both languages. `{company}` is the name of the company.
const messages = {
  aboutUs: { en: 'About Us', ja: '{company}について' },
  company: { en: 'Company', ja: '企業情報' },
  companyCopy: {
    en: 'Who we are and what we are building',
    ja: '私たちのチームと、つくっているもの',
  },
  ourProducts: { en: 'Our Products', ja: 'プロダクト一覧' },
  ourProductsCopy: {
    en: 'Everything we build at {company}',
    ja: '{company}がつくるすべてのプロダクト',
  },
  support: { en: 'Support', ja: 'サポート' },
  supportCopy: { en: 'Get help from the team', ja: 'チームに相談' },
  contactUs: { en: 'Contact us', ja: 'お問い合わせ' },
  companyOverview: { en: 'View company overview', ja: '会社概要を見る' },
  companyMission: {
    en: 'Learn more about the {company} team and mission',
    ja: '{company}のチームとミッションを知る',
  },
} satisfies Record<string, Record<SiteLocale, string>>;

export type AboutMenu = {
  pane: DropdownPane;
  /** Where the About Us trigger itself leads. */
  href: string;
  labels: { companyOverview: string; companyMission: string };
};

/* The About Us menu, the same on the company site and on the Wallet site, apart
   from the company name that each site shows. Its links are company-site paths:
   each site's router resolves them, so on the Wallet site '/' and '/company/'
   lead to the company site. */
export function aboutMenu(locale: SiteLocale, company: string): AboutMenu {
  const t = (key: keyof typeof messages): string =>
    messages[key][locale].replace('{company}', company);
  return {
    pane: {
      id: 'about',
      label: t('aboutUs'),
      kicker: t('company'),
      rows: [
        {
          title: t('company'),
          description: t('companyCopy'),
          to: '/company/',
          icon: Building2,
          field: 'sky-sand',
        },
        {
          title: t('ourProducts'),
          description: t('ourProductsCopy'),
          to: '/',
          icon: LayoutGrid,
          field: 'teal-peach',
        },
        {
          title: t('support'),
          description: t('supportCopy'),
          to: CONTACT_LINK_TARGET,
          icon: LifeBuoy,
          field: 'coral-tide',
        },
      ],
      footerLinks: [{ label: t('contactUs'), to: CONTACT_LINK_TARGET }],
    },
    href: '/company/',
    labels: { companyOverview: t('companyOverview'), companyMission: t('companyMission') },
  };
}
