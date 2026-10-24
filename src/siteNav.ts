// The ONE list of site links. The app footer, the landing page, the public pages and their tests all read it, so a link can never point
// somewhere different in one place. `href` is the public address; `appHref` is used instead inside the signed-in app (its own screens).
export interface SiteLink { label: string; href: string; appHref?: string }
export interface SiteLinkGroup { title: string; links: SiteLink[] }

export const HEADER_LINKS: SiteLink[] = [
  { label: 'Packing list', href: '/travel-checklist/' },
  { label: 'Guides', href: '/guides/' },
  { label: 'About', href: '/about/' },
  { label: 'Contact', href: '/contact/' },
];

// Two groups of four so no menu is longer than another.
export const FOOTER_GROUPS: SiteLinkGroup[] = [
  { title: 'Explore', links: [
    { label: 'Flight tracker', href: '/', appHref: '#/' },
    { label: 'Packing list', href: '/travel-checklist/', appHref: '#/checklist' },
    { label: 'Travel guides', href: '/guides/' },
    { label: 'About', href: '/about/' },
  ] },
  { title: 'Help and legal', links: [
    { label: 'Contact us', href: '/contact/' },
    { label: 'Privacy', href: '/privacy/' },
    { label: 'Cookies', href: '/cookies/' },
    { label: 'Terms', href: '/terms/' },
  ] },
];

export const FOOTER_BLURB = 'Flight status, airport details and a packing list you can reuse.';
export const FOOTER_NOTE = 'Flight details can change. Always follow airline and airport instructions.';
