import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Plus } from 'lucide-react';
import { Fragment, type ReactNode, useEffect, useRef, useState } from 'react';
import { faqs as builtInFaqs } from '../../content/site-content.mjs';
import { fromAny, motionAllowed, withMotion } from '../shared/motion';
import { AccountButton } from './auth';

gsap.registerPlugin(useGSAP);

// The same answers as the public help page: the published FAQ from /api/site (edited in the owner console), with the
// build-time seed (content/site-content.mjs) as the offline fallback. Links in the safe Markdown subset become
// real links; anything else stays plain text.
function answer(text: string): ReactNode {
  const out: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    out.push(text.slice(last, m.index));
    const href = m[2];
    out.push(
      /^(\/|https:\/\/)/.test(href) ? (
        <a
          key={m.index}
          href={href}
          {...(href.startsWith('https:') ? { rel: 'noopener', target: '_blank' } : {})}
        >
          {m[1]}
        </a>
      ) : (
        m[1]
      ),
    );
    last = m.index + m[0].length;
  }
  out.push(text.slice(last));
  return out.map((x, i) => <Fragment key={i}>{x}</Fragment>);
}
const COUNT = [
  'No',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
];

export default function HelpView({
  onFeedback,
  onInstall,
  account,
}: {
  onFeedback: () => void;
  onInstall: () => void;
  account: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [faqs, setFaqs] = useState<{ id: string; question: string; answer: string }[]>(builtInFaqs);
  useEffect(() => {
    const ac = new AbortController();
    fetch('/api/site', { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j && Array.isArray(j.faqs) && j.faqs.length) setFaqs(j.faqs);
      })
      .catch(() => {
        /* offline or aborted: keep the built-in answers */
      });
    return () => ac.abort();
  }, []);
  const root = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      withMotion(() => {
        fromAny(gsap, q('.vh > *, .acc, .helpside > *'), {
          autoAlpha: 0,
          y: 18,
          duration: 0.55,
          ease: 'power3.out',
          stagger: 0.07,
        });
      });
    },
    { scope: root },
  );
  const toggle = (id: string) => {
    const next = open === id ? null : id;
    setOpen(next);
    if (next && motionAllowed())
      requestAnimationFrame(() => {
        const p = document.getElementById('ha-' + next);
        if (p) gsap.from(p, { height: 0, duration: 0.3, ease: 'power3.out', clearProps: 'height' });
      });
  };
  return (
    <section className="help-view" aria-labelledby="hp-h" ref={root}>
      <div className="vh">
        <div>
          <h1 id="hp-h">Help and FAQ</h1>
          <p>
            {COUNT[faqs.length] || faqs.length} short answers about the data, your account and the
            app.
          </p>
        </div>
      </div>
      <div className="help">
        <div className="panel acc">
          {faqs.map((f) => (
            <div className="acc-item" key={f.id}>
              <h2>
                <button
                  type="button"
                  className="acc-btn"
                  id={'hb-' + f.id}
                  aria-expanded={open === f.id}
                  aria-controls={'ha-' + f.id}
                  onClick={() => toggle(f.id)}
                >
                  <span>{f.question}</span>
                  <span className="pm" aria-hidden="true">
                    <Plus size={16} />
                  </span>
                </button>
              </h2>
              <div
                className="acc-panel"
                id={'ha-' + f.id}
                role="region"
                aria-labelledby={'hb-' + f.id}
                hidden={open !== f.id}
              >
                <p>{answer(f.answer)}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="helpside">
          <div className="panel">
            <h2>Send feedback</h2>
            <p>Something wrong with a result, or an idea? It goes straight to the owner.</p>
            <button type="button" className="btn btn-primary btn-sm" onClick={onFeedback}>
              Write feedback
            </button>
          </div>
          <div className="panel">
            <h2>Install Flightdeck</h2>
            <p>
              Add it to your home screen. It opens like an app and keeps your last results when you
              lose signal.
            </p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onInstall}>
              Show me how
            </button>
          </div>
          <div className="panel">
            <h2>Your data</h2>
            <p>
              {account
                ? 'Saved flights and lists stay on your account. You can delete everything from Account and data.'
                : 'Saved flights and lists stay on this device.'}
            </p>
            {account ? (
              <AccountButton />
            ) : (
              <a className="btn btn-ghost btn-sm" href="/privacy/">
                Privacy information
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
