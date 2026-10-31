import {
  Archive,
  Check,
  Copy,
  Inbox as InboxIcon,
  Mail,
  Reply,
  Send,
  StickyNote,
  Undo2,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ago, call, when } from './api';
import {
  Badge,
  Empty,
  LoadError,
  Loading,
  Notice,
  PageHead,
  type Tone,
  toast,
  useRise,
} from './ui';

type Enquiry = {
  id: string;
  kind: string;
  status: string;
  createdAt: number;
  name?: string;
  email?: string;
  message: string;
  replies?: { at: number; text: string }[];
  note?: string;
  emailed?: boolean;
  resolvedAt?: number;
};
const FILTERS: [string, string, (e: Enquiry) => boolean][] = [
  ['open', 'Open', (e) => ['new', 'read', 'replied'].includes(e.status)],
  ['resolved', 'Resolved', (e) => e.status === 'resolved'],
  ['archived', 'Archived', (e) => e.status === 'archived'],
  ['all', 'All', () => true],
];
const STATUS: Record<string, [string, Tone]> = {
  new: ['New', 'blue'],
  read: ['Open', 'warn'],
  replied: ['Replied', 'warn'],
  resolved: ['Resolved', 'ok'],
  archived: ['Archived', 'grey'],
};
const KIND: Record<string, [string, Tone]> = {
  contact: ['Enquiry', 'blue'],
  bug: ['Problem', 'warn'],
  feedback: ['Feedback', 'violet'],
};

/** Enquiries and feedback: read, reply by email, keep a private note, and mark as resolved or archived. */
export default function Inbox({ onUnread }: { onUnread: (n: number) => void }) {
  const [data, setData] = useState<{ items: Enquiry[]; total: number; unread: number } | null>(
      null,
    ),
    [err, setErr] = useState<unknown>(null),
    [filter, setFilter] = useState('open'),
    [sel, setSel] = useState<string | null>(null);
  const [replying, setReplying] = useState(false),
    [replyText, setReplyText] = useState(''),
    [sending, setSending] = useState(false);
  const [noting, setNoting] = useState(false),
    [noteText, setNoteText] = useState(''),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setErr(null);
    try {
      const d = await call('/api/admin/enquiries');
      setData(d);
      onUnread(d.unread);
    } catch (e) {
      setErr(e);
    }
  }, [onUnread]);
  useEffect(() => {
    void load();
  }, [load]);
  const test = FILTERS.find((f) => f[0] === filter)?.[2] ?? (() => true);
  const shown = data ? data.items.filter(test) : [];
  // Choose the first message of the filter when nothing (or nothing visible) is chosen.
  useEffect(() => {
    if (!data) return;
    if (!sel || !data.items.some((x) => x.id === sel)) setSel(shown[0]?.id ?? null);
  }, [data, sel, shown]);
  const m = data?.items.find((x) => x.id === sel) ?? null;
  const choose = (id: string | null) => {
    setSel(id);
    setReplying(false);
    setNoting(false);
    setReplyText('');
    setErr(null);
  };
  const patch = async (id: string, body: { status?: string; note?: string }, msg: string) => {
    setErr(null);
    setBusy(true);
    try {
      const j = await call(`/api/admin/enquiries/${id}`, { method: 'PATCH', body });
      setData(
        (d) =>
          d && {
            ...d,
            unread: j.unread,
            items: d.items.map((x) =>
              x.id === id
                ? {
                    ...x,
                    ...body,
                    ...(body.note === '' ? { note: undefined } : {}),
                    ...(body.status === 'resolved' ? { resolvedAt: Date.now() } : {}),
                  }
                : x,
            ),
          },
      );
      onUnread(j.unread);
      toast(msg);
      return true;
    } catch (e) {
      setErr(e);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const sendReply = async (id: string) => {
    setSending(true);
    setErr(null);
    try {
      const j = await call(`/api/admin/enquiries/${id}/reply`, {
        method: 'POST',
        body: { message: replyText },
      });
      setData(
        (d) =>
          d && {
            ...d,
            unread: j.unread,
            items: d.items.map((x) =>
              x.id === id
                ? {
                    ...x,
                    status: 'replied',
                    replies: [...(x.replies || []), { at: Date.now(), text: replyText }],
                  }
                : x,
            ),
          },
      );
      onUnread(j.unread);
      setReplying(false);
      setReplyText('');
      toast('Reply sent.');
    } catch (e) {
      setErr(e);
    } finally {
      setSending(false);
    }
  };
  const copyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      toast('Email address copied.');
    } catch {
      toast(email);
    }
  };
  const root = useRef<HTMLDivElement>(null),
    detail = useRef<HTMLDivElement>(null);
  useRise(root, [!!data]);
  useRise(detail, [sel], !!data);

  const head = (
    <PageHead
      title="Enquiries and feedback"
      lede="Messages from the contact form on the website and feedback from the app."
    />
  );
  if (!data)
    return (
      <div className="cs-stack" ref={root}>
        {head}
        {err ? (
          <LoadError error={err} retry={() => void load()} />
        ) : (
          <Loading label="Loading messages…" />
        )}
      </div>
    );
  const kind = (k: string) => KIND[k] ?? [k, 'grey' as Tone];
  const status = (s: string) => STATUS[s] ?? [s, 'grey' as Tone];
  return (
    <div className="cs-stack" ref={root}>
      {head}
      <section className="cs-panel" aria-label="Messages">
        <div className="cs-toolbar">
          <div className="cs-chips cn-filters" role="group" aria-label="Show messages">
            {FILTERS.map(([id, label, f]) => (
              <button
                type="button"
                key={id}
                className="cs-chip"
                aria-pressed={filter === id}
                onClick={() => {
                  setFilter(id);
                  choose(data.items.find(f)?.id ?? null);
                }}
              >
                {label} <span className="cs-chip-n cs-num">{data.items.filter(f).length}</span>
              </button>
            ))}
          </div>
        </div>
        {data.items.length === 0 ? (
          <Empty icon={<InboxIcon size={22} />} title="No messages yet">
            When someone uses the Feedback button or the contact form, it appears here and is
            emailed to you if an address is set up.
          </Empty>
        ) : (
          <div className="cs-ibx">
            <div className="cs-ibx-list">
              {shown.length === 0 ? (
                <p className="cs-empty">Nothing here. Everything is answered.</p>
              ) : (
                shown.map((x) => (
                  <button
                    type="button"
                    key={x.id}
                    className={x.status === 'new' ? 'cs-msg unread' : 'cs-msg'}
                    aria-current={x.id === sel ? 'true' : undefined}
                    onClick={() => choose(x.id)}
                  >
                    <span className="cs-msg-r1">
                      <b>
                        {x.status === 'new' && <span className="cs-sr">Unread: </span>}
                        {x.name || x.email || 'Anonymous'}
                      </b>
                      <time className="cs-num">{ago(x.createdAt)}</time>
                    </span>
                    <span className="cs-msg-p">{x.message}</span>
                    <span className="cs-msg-tags">
                      <Badge tone={kind(x.kind)[1]} dot={false}>
                        {kind(x.kind)[0]}
                      </Badge>
                      <Badge dot={false}>{status(x.status)[0]}</Badge>
                    </span>
                  </button>
                ))
              )}
            </div>
            <div className="cs-ibx-detail" ref={detail}>
              {!m ? (
                <p className="cs-empty">Choose a message.</p>
              ) : (
                <>
                  <div className="cs-ibx-head">
                    <div>
                      <h2>
                        {kind(m.kind)[0]} from {m.name || 'someone without a name'}
                      </h2>
                      <p className="cs-label">
                        {[m.name, m.email, when(m.createdAt)].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <Badge tone={status(m.status)[1]}>{status(m.status)[0]}</Badge>
                  </div>
                  {err ? <LoadError error={err} /> : null}
                  <div className="cs-ibx-body">{m.message}</div>
                  {(m.replies || []).length > 0 && (
                    <ul className="cs-notes blue">
                      {(m.replies || []).map((r) => (
                        <li key={r.at}>
                          <small>You replied · {when(r.at)}</small>
                          {r.text}
                        </li>
                      ))}
                    </ul>
                  )}
                  {m.note && !noting && (
                    <ul className="cs-notes">
                      <li>
                        <small>Private note, only you can see it</small>
                        {m.note}
                      </li>
                    </ul>
                  )}
                  {m.status === 'resolved' && m.resolvedAt && (
                    <p className="cs-label">Resolved {when(m.resolvedAt)}</p>
                  )}
                  {!m.emailed && (
                    <p className="cs-label">Not emailed to you: no notification address is set.</p>
                  )}
                  {replying ? (
                    <form
                      className="cs-ibx-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void sendReply(m.id);
                      }}
                    >
                      <label className="cs-label" htmlFor="cs-reply">
                        Your reply to {m.name || m.email}. It is emailed to them, and their answer
                        comes back to your inbox.
                      </label>
                      <textarea
                        id="cs-reply"
                        className="cs-input cs-textarea"
                        rows={5}
                        maxLength={4000}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                      />
                      <div className="cs-ibx-acts">
                        <button
                          className="cs-btn primary sm"
                          type="submit"
                          disabled={sending || replyText.trim().length < 2}
                        >
                          <Send size={16} aria-hidden="true" />
                          {sending ? 'Sending…' : 'Send reply'}
                        </button>
                        <button
                          className="cs-btn ghost sm"
                          type="button"
                          onClick={() => {
                            setReplying(false);
                            setReplyText('');
                          }}
                        >
                          Cancel
                        </button>
                        <span className="cs-label cs-num cs-push">{replyText.length} / 4000</span>
                      </div>
                    </form>
                  ) : noting || !m.note ? (
                    <form
                      className="cs-ibx-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const text = noting ? noteText : noteText.trim();
                        if (!noting && !text) return;
                        void patch(
                          m.id,
                          { note: text },
                          text.trim() ? 'Note saved.' : 'Note removed.',
                        ).then((ok) => {
                          if (ok) {
                            setNoting(false);
                            setNoteText('');
                          }
                        });
                      }}
                    >
                      <label className="cs-label" htmlFor="cs-note">
                        Private note, only you can see it
                      </label>
                      <textarea
                        id="cs-note"
                        className="cs-input cs-textarea"
                        rows={3}
                        maxLength={2000}
                        placeholder="What you did, or what to check"
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                      />
                      <div className="cs-ibx-acts">
                        <button className="cs-btn ghost sm" type="submit" disabled={busy}>
                          <StickyNote size={16} aria-hidden="true" />
                          {noting ? 'Save note' : 'Add note'}
                        </button>
                        {noting && (
                          <button
                            className="cs-btn ghost sm"
                            type="button"
                            onClick={() => {
                              setNoting(false);
                              setNoteText('');
                            }}
                          >
                            Cancel
                          </button>
                        )}
                        {m.email && !noting && (
                          <>
                            <button
                              className="cs-btn ghost sm"
                              type="button"
                              onClick={() => setReplying(true)}
                            >
                              <Reply size={16} aria-hidden="true" />
                              Reply by email
                            </button>
                            <button
                              className="cs-btn ghost sm"
                              type="button"
                              onClick={() => void copyEmail(m.email || '')}
                            >
                              <Copy size={16} aria-hidden="true" />
                              Copy email address
                            </button>
                          </>
                        )}
                      </div>
                    </form>
                  ) : (
                    <div className="cs-ibx-acts">
                      <button
                        className="cs-btn ghost sm"
                        type="button"
                        onClick={() => {
                          setNoting(true);
                          setNoteText(m.note || '');
                        }}
                      >
                        <StickyNote size={16} aria-hidden="true" />
                        Edit note
                      </button>
                      {m.email && (
                        <>
                          <button
                            className="cs-btn ghost sm"
                            type="button"
                            onClick={() => setReplying(true)}
                          >
                            <Reply size={16} aria-hidden="true" />
                            Reply by email
                          </button>
                          <button
                            className="cs-btn ghost sm"
                            type="button"
                            onClick={() => void copyEmail(m.email || '')}
                          >
                            <Copy size={16} aria-hidden="true" />
                            Copy email address
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  {!m.email && (
                    <p className="cs-label">
                      <Mail size={14} aria-hidden="true" /> No email address was given, so this
                      cannot be replied to.
                    </p>
                  )}
                  <div className="cs-ibx-status">
                    {m.status === 'new' ? (
                      <button
                        className="cs-btn quiet sm"
                        type="button"
                        disabled={busy}
                        onClick={() => void patch(m.id, { status: 'read' }, 'Marked as read.')}
                      >
                        Mark as read
                      </button>
                    ) : (
                      <button
                        className="cs-btn quiet sm"
                        type="button"
                        disabled={busy}
                        onClick={() => void patch(m.id, { status: 'new' }, 'Marked as unread.')}
                      >
                        Mark as unread
                      </button>
                    )}
                    {m.status !== 'archived' && (
                      <button
                        className="cs-btn quiet sm"
                        type="button"
                        disabled={busy}
                        onClick={() => void patch(m.id, { status: 'archived' }, 'Archived.')}
                      >
                        <Archive size={16} aria-hidden="true" />
                        Archive
                      </button>
                    )}
                    {m.status === 'resolved' || m.status === 'archived' ? (
                      <button
                        className="cs-btn primary sm cs-push"
                        type="button"
                        disabled={busy}
                        onClick={() => void patch(m.id, { status: 'read' }, 'Reopened.')}
                      >
                        <Undo2 size={16} aria-hidden="true" />
                        Reopen
                      </button>
                    ) : (
                      <button
                        className="cs-btn primary sm cs-push"
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void patch(m.id, { status: 'resolved' }, 'Marked as resolved.')
                        }
                      >
                        <Check size={16} aria-hidden="true" />
                        Mark resolved
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </section>
      {err && !m ? <Notice kind="error">{String((err as Error).message)}</Notice> : null}
    </div>
  );
}
