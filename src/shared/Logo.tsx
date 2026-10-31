/* The Flightdeck mark (31 Oct 2026): a runway line, a take-off arc and an amber destination dot on a blue tile.
   The same drawing is public/icon.svg and the PHP constant Site::LOGO; change all three together. */
export function LogoMark({ size = 34, title }: { size?: number; title?: string }) {
  return (
    <svg
      className="fd-logo"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      <rect width="64" height="64" rx="18" fill="#1866FF" />
      <path
        d="M23 47H50"
        stroke="#fff"
        strokeOpacity=".5"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        d="M15 47C17 30 29.5 19.5 45 18.5"
        fill="none"
        stroke="#fff"
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      <circle cx="15" cy="47" r="5.5" fill="#1866FF" stroke="#fff" strokeWidth="4" />
      <circle cx="47.5" cy="18" r="7" fill="#FFB618" />
    </svg>
  );
}

/* Logo plus the wordmark. `href` defaults to the public home page. */
export function Brand({
  href = '/',
  size = 34,
  className = '',
}: {
  href?: string;
  size?: number;
  className?: string;
}) {
  return (
    <a className={`fd-brand ${className}`.trim()} href={href} aria-label="Flightdeck home">
      <LogoMark size={size} />
      <span className="fd-brand-word">Flightdeck</span>
    </a>
  );
}
