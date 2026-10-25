// The default site links. The app footer reads them, and scripts/seed-content.mjs copies them into the CMS seed, so the public site
// starts with the same links (after that the owner edits the site's links in the console). `href` is the public address; `appHref`
// is used instead inside the app (its own screens).
export interface SiteLink { label: string; href: string; appHref?: string }
export interface SiteLinkGroup { title: string; links: SiteLink[] }

export const HEADER_LINKS: SiteLink[] = [
  { label: 'How it works', href: '/how-it-works/' },
  { label: 'Coverage', href: '/coverage/' },
  { label: 'Guides', href: '/guides/' },
  { label: 'Packing list', href: '/travel-checklist/' },
  { label: 'Help', href: '/help/' },
];

export const FOOTER_GROUPS: SiteLinkGroup[] = [
  { title: 'Flightdeck', links: [
    { label: 'Open the app', href: '/app/', appHref: '#/' },
    { label: 'How it works', href: '/how-it-works/' },
    { label: 'Data and coverage', href: '/coverage/' },
    { label: 'Help and FAQ', href: '/help/' },
  ] },
  { title: 'Guides and tools', links: [
    { label: 'Travel guides', href: '/guides/' },
    { label: 'Printable packing list', href: '/travel-checklist/', appHref: '#/checklist' },
  ] },
  { title: 'About', links: [
    { label: 'About Flightdeck', href: '/about/' },
    { label: 'Contact us', href: '/contact/' },
    { label: 'Accessibility', href: '/accessibility/' },
  ] },
  { title: 'Legal', links: [
    { label: 'Privacy', href: '/privacy/' },
    { label: 'Cookies', href: '/cookies/' },
    { label: 'Terms', href: '/terms/' },
  ] },
];

export const FOOTER_BLURB = 'Flight status, airport details and a packing list you can reuse.';
export const FOOTER_NOTE = 'Flight details can change. Always follow airline and airport instructions.';
