import { LogoMark } from './shared/Logo';
import { FOOTER_BLURB, FOOTER_GROUPS, FOOTER_NOTE } from './siteNav';
import './siteFooter.css';

// Same markup as the PHP-rendered public pages (php/private/src/Site/Site.php). `inApp`: inside the signed-in app the tracker and packing list point at the app's own screens.
export default function SiteFooter({ inApp = false }: { inApp?: boolean }) {
  const year = new Date().getFullYear();
  return (
    <footer className="sf" aria-label="Site">
      <div className="sf-in">
        <div className="sf-top">
          <div className="sf-about">
            <a className="fd-brand sf-brand" href={inApp ? '#/' : '/'} aria-label="Flightdeck home">
              <LogoMark />
              <span className="fd-brand-word">Flightdeck</span>
            </a>
            <p className="sf-blurb">{FOOTER_BLURB}</p>
          </div>
          <div className="sf-cols">
            {FOOTER_GROUPS.map((g) => (
              <nav className="sf-col" key={g.title} aria-label={g.title}>
                <h2>{g.title}</h2>
                <ul>
                  {g.links.map((l) => (
                    <li key={l.label}>
                      <a href={inApp && l.appHref ? l.appHref : l.href}>{l.label}</a>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        <div className="sf-base">
          <p>{FOOTER_NOTE}</p>
          <p>
            © {year} Flightdeck · <a href="/about/#photo-credits">Photo credits</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
