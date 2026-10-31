import { History } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ago, call, when } from './api';
import { Empty, LoadError, Loading, PageHead, Panel, useRise } from './ui';

type Entry = { at: string; by: string; action: string };

/** What changed, when, and by whom (a short fingerprint of the account, never the account id). Newest first. */
export default function AuditView() {
  const [items, setItems] = useState<Entry[]>([]),
    [you, setYou] = useState(''),
    [err, setErr] = useState<unknown>(null),
    [loaded, setLoaded] = useState(false),
    [more, setMore] = useState(true),
    [busy, setBusy] = useState(false);
  const load = useCallback(async (offset: number) => {
    setErr(null);
    setBusy(true);
    try {
      const d = await call<{ entries: Entry[]; you: string }>(`/api/admin/audit?offset=${offset}`);
      setYou(d.you);
      setItems((x) => (offset ? [...x, ...d.entries] : d.entries));
      setMore(d.entries.length === 100);
    } catch (e) {
      setErr(e);
    } finally {
      setLoaded(true);
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void load(0);
  }, [load]);
  const root = useRef<HTMLDivElement>(null);
  useRise(root, [loaded]);
  return (
    <div className="cs-stack" ref={root}>
      <PageHead
        title="Audit log"
        lede="Every change made in the console, newest first. It cannot be edited. To undo a content change, open the item and restore an earlier version from its history."
      />
      {err ? <LoadError error={err} retry={() => void load(items.length)} /> : null}
      {!loaded ? (
        <Loading />
      ) : items.length === 0 ? (
        !err && (
          <Panel>
            <Empty icon={<History size={22} />} title="Nothing changed yet">
              Content changes, publishes, restores, uploads and enquiry actions appear here.
            </Empty>
          </Panel>
        )
      ) : (
        <Panel>
          <ul className="cs-hist">
            {items.map((e, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: the log is append-only and has no ids
              <li key={i}>
                <span>
                  <b>{e.action}</b>
                  <small>
                    {e.by === you ? 'You' : <code>{e.by}</code>} · {when(e.at)}
                  </small>
                </span>
                <time className="cs-label cs-num" dateTime={e.at}>
                  {ago(e.at)}
                </time>
              </li>
            ))}
          </ul>
          {more && (
            <div className="cs-panel-foot">
              <button
                type="button"
                className="cs-btn ghost sm"
                onClick={() => void load(items.length)}
                disabled={busy}
              >
                {busy ? 'Loading…' : 'Show older'}
              </button>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
