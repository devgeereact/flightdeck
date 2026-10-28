import {
  AlertTriangle,
  CheckCircle2,
  Inbox as InboxIcon,
  Mail,
  Reply,
  Send,
  StickyNote,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { call, when } from './api';

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
const STATUS_LABEL: Record<string, string> = {
  new: 'New',
  read: 'Read',
  replied: 'Replied',
  resolved: 'Resolved',
  archived: 'Archived',
};
const KIND_LABEL: Record<string, string> = {
  contact: 'Question',
  bug: 'Problem',
  feedback: 'Feedback',
};

/** Enquiries and feedback: read, reply by email, add a private note, and mark as resolved or archived. */
export default function Inbox({ onUnread }: { onUnread: (n: number) => void }) {
  const [data, setData] = useState<{ items: Enquiry[]; total: number; unread: number } | null>(
      null,
    ),
    [err, setErr] = useState(''),
    [filter, setFilter] = useState('open');
  const [replyFor, setReplyFor] = useState<string | null>(null),
    [replyText, setReplyText] = useState(''),
    [sending, setSending] = useState(false),
    [done, setDone] = useState('');
  const [noteFor, setNoteFor] = useState<string | null>(null),
    [noteText, setNoteText] = useState('');
  const load = useCallback(async () => {
    setErr('');
    try {
      const d = await call('/api/admin/enquiries');
      setData(d);
      onUnread(d.unread);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [onUnread]);
  useEffect(() => {
    void load();
  }, [load]);
  const patch = async (id: string, body: { status?: string; note?: string }, msg: string) => {
    setErr('');
    setDone('');
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
      setDone(msg);
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const sendReply = async (id: string) => {
    setSending(true);
    setErr('');
    setDone('');
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
      setReplyFor(null);
      setReplyText('');
      setDone('Reply sent.');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSending(false);
    }
  };
  if (!data)
    return err ? (
      <div role="alert" className="notice error">
        <AlertTriangle size={16} />
        {err}{' '}
        <button className="text-button" onClick={() => void load()}>
          Try again
        </button>
      </div>
    ) : (
      <p className="ad-loading" role="status">
        Loading messages…
      </p>
    );
  const test = FILTERS.find((f) => f[0] === filter)![2];
  const shown = data.items.filter(test);
  return (
    <div className="cn-inbox">
      <div className="cn-filters" role="group" aria-label="Show messages">
        {FILTERS.map(([id, label, f]) => (
          <button
            key={id}
            className={filter === id ? 'on' : ''}
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
          >
            {label}
            <span className="cn-n">{data.items.filter(f).length}</span>
          </button>
        ))}
      </div>
      {err && (
        <div role="alert" className="notice error">
          <AlertTriangle size={16} />
          {err}
        </div>
      )}
      {done && (
        <div role="status" className="notice">
          <CheckCircle2 size={16} />
          {done}
        </div>
      )}
      {data.items.length === 0 ? (
        <section className="panel ad-emptybox">
          <InboxIcon size={28} />
          <h2>No messages yet</h2>
          <p>
            When someone uses the Feedback button or the contact form, it appears here and is
            emailed to you if an address is set up.
          </p>
        </section>
      ) : shown.length === 0 ? (
        <section className="panel ad-emptybox">
          <CheckCircle2 size={28} />
          <h2>Nothing here</h2>
          <p>No messages match this filter.</p>
        </section>
      ) : (
        <ul className="ad-enq">
          {shown.map((m) => (
            <li key={m.id} className={'panel ' + (m.status === 'new' ? 'new' : '')}>
              <div className="ad-enq-top">
                <span className="pill">{KIND_LABEL[m.kind] || m.kind}</span>
                <strong>{m.name || 'Anonymous'}</strong>
                {m.email && (
                  <a
                    href={`mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent('Re: your message to Flightdeck')}`}
                  >
                    <Mail size={12} />
                    {m.email}
                  </a>
                )}
                <time>{when(m.createdAt)}</time>
                <span className={'pill st-' + m.status}>{STATUS_LABEL[m.status] || m.status}</span>
              </div>
              <p className="ad-enq-msg">{m.message}</p>
              {(m.replies || []).map((r, i) => (
                <div className="ad-reply" key={i}>
                  <span>
                    <Reply size={12} />
                    You replied · {when(r.at)}
                  </span>
                  <p>{r.text}</p>
                </div>
              ))}
              {m.note && noteFor !== m.id && (
                <div className="cn-note">
                  <span>
                    <StickyNote size={12} />
                    Private note (only you see this)
                  </span>
                  <p>{m.note}</p>
                </div>
              )}
              {m.status === 'resolved' && m.resolvedAt && (
                <p className="ad-note">Resolved {when(m.resolvedAt)}</p>
              )}
              {replyFor === m.id ? (
                <form
                  className="ad-reply-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void sendReply(m.id);
                  }}
                >
                  <label>
                    <span>Your reply to {m.name || m.email}</span>
                    <textarea
                      autoFocus
                      rows={5}
                      maxLength={4000}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write your reply. It is emailed to the sender, and their answer comes back to your inbox."
                    />
                  </label>
                  <div className="ad-enq-act">
                    <button
                      className="btn btn-primary"
                      type="submit"
                      disabled={sending || replyText.trim().length < 2}
                    >
                      <Send size={14} />
                      {sending ? 'Sending…' : 'Send reply'}
                    </button>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => {
                        setReplyFor(null);
                        setReplyText('');
                      }}
                    >
                      Cancel
                    </button>
                    <small>{replyText.length}/4000</small>
                  </div>
                </form>
              ) : noteFor === m.id ? (
                <form
                  className="ad-reply-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void patch(
                      m.id,
                      { note: noteText },
                      noteText.trim() ? 'Note saved.' : 'Note removed.',
                    ).then(() => setNoteFor(null));
                  }}
                >
                  <label>
                    <span>Private note (never emailed, never shown to the sender)</span>
                    <textarea
                      autoFocus
                      rows={3}
                      maxLength={2000}
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                    />
                  </label>
                  <div className="ad-enq-act">
                    <button className="btn btn-primary" type="submit">
                      Save note
                    </button>
                    <button className="text-button" type="button" onClick={() => setNoteFor(null)}>
                      Cancel
                    </button>
                    <small>{noteText.length}/2000</small>
                  </div>
                </form>
              ) : (
                <div className="ad-enq-act">
                  {m.email ? (
                    <button
                      className="text-button primary"
                      onClick={() => {
                        setReplyFor(m.id);
                        setReplyText('');
                        setDone('');
                      }}
                    >
                      <Reply size={13} />
                      Reply by email
                    </button>
                  ) : (
                    <small>No email address was given, so this cannot be replied to.</small>
                  )}
                  <button
                    className="text-button"
                    onClick={() => {
                      setNoteFor(m.id);
                      setNoteText(m.note || '');
                    }}
                  >
                    <StickyNote size={13} />
                    {m.note ? 'Edit note' : 'Add note'}
                  </button>
                  {m.status !== 'resolved' && (
                    <button
                      className="text-button"
                      onClick={() =>
                        void patch(m.id, { status: 'resolved' }, 'Marked as resolved.')
                      }
                    >
                      <CheckCircle2 size={13} />
                      Resolve
                    </button>
                  )}
                  {(['read', 'archived', 'new'] as const)
                    .filter((x) => x !== m.status)
                    .map((x) => (
                      <button
                        key={x}
                        className="text-button"
                        onClick={() =>
                          void patch(
                            m.id,
                            { status: x },
                            `Marked as ${STATUS_LABEL[x].toLowerCase()}.`,
                          )
                        }
                      >
                        Mark as {STATUS_LABEL[x].toLowerCase()}
                      </button>
                    ))}
                  {!m.emailed && <small>Not emailed (no notification address was set)</small>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
