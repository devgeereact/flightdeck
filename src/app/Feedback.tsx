import { Check, MessageSquare, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ga, track } from '../shared/track';

type Kind = 'feedback' | 'bug' | 'contact';
const LABEL: Record<Kind, string> = {
  feedback: 'Share feedback',
  bug: 'Report a problem',
  contact: 'Ask a question',
};
const CHOICE: Record<Kind, string> = {
  feedback: 'Feedback',
  bug: 'A problem',
  contact: 'A question',
};
export default function Feedback({ defaultEmail = '' }: { defaultEmail?: string }) {
  const dlg = useRef<HTMLDialogElement>(null),
    openedAt = useRef(0),
    doneClose = useRef<HTMLButtonElement>(null);
  const [kind, setKind] = useState<Kind>('feedback'),
    [message, setMessage] = useState(''),
    [email, setEmail] = useState(defaultEmail),
    [name, setName] = useState(''),
    [trap, setTrap] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle'),
    [error, setError] = useState('');
  useEffect(() => {
    setEmail((e) => e || defaultEmail);
  }, [defaultEmail]);
  // Once the message is sent the form is replaced, so focus moves to the Close button instead of being lost.
  useEffect(() => {
    if (state === 'sent') doneClose.current?.focus();
  }, [state]);
  const open = () => {
    openedAt.current = Date.now();
    setState('idle');
    setError('');
    dlg.current?.showModal();
    track('feedback_opened');
  };
  const close = () => dlg.current?.close();
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setState('sending');
    try {
      const r = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          message,
          email,
          name,
          website: trap,
          elapsed: Date.now() - openedAt.current,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw Error(j.error || 'Your message could not be sent. Please try again.');
      setState('sent');
      setMessage('');
      ga('feedback_sent', { source: kind });
    } catch (err) {
      setState('idle');
      setError((err as Error).message);
    }
  }
  return (
    <>
      <button className="btn btn-secondary fb-btn" onClick={open} aria-haspopup="dialog">
        <MessageSquare size={15} />
        Feedback
      </button>
      <dialog
        ref={dlg}
        className="fb-dialog"
        aria-labelledby="fb-title"
        onClick={(e) => {
          if (e.target === dlg.current) close();
        }}
      >
        <div className="fb-head">
          <h2 id="fb-title">{LABEL[kind]}</h2>
          <button className="fb-close" onClick={close} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {state === 'sent' ? (
          <div className="fb-done" role="status">
            <Check size={26} />
            <h3>Thank you</h3>
            <p>Your message has been sent. We read everything.</p>
            <button ref={doneClose} className="btn btn-primary" onClick={close}>
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={send}>
            <fieldset className="fb-kinds">
              <legend className="sr-only">What is this about?</legend>
              {(['feedback', 'bug', 'contact'] as Kind[]).map((k) => (
                <label key={k} className={kind === k ? 'fb-kind on' : 'fb-kind'}>
                  <input
                    type="radio"
                    name="fb-kind"
                    value={k}
                    checked={kind === k}
                    onChange={() => setKind(k)}
                  />
                  {CHOICE[k]}
                </label>
              ))}
            </fieldset>
            <label className="fb-f">
              <span>Your message</span>
              <textarea
                required
                minLength={5}
                maxLength={4000}
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  kind === 'bug'
                    ? 'What happened, and what did you expect?'
                    : kind === 'contact'
                      ? 'How can we help?'
                      : 'What would make Flightdeck better for you?'
                }
              />
            </label>
            <div className="fb-row">
              <label className="fb-f">
                <span>Name (optional)</span>
                <input
                  value={name}
                  maxLength={80}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </label>
              <label className="fb-f">
                <span>Email{kind === 'contact' ? '' : ' (optional, for a reply)'}</span>
                <input
                  type="email"
                  required={kind === 'contact'}
                  value={email}
                  maxLength={254}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </label>
            </div>
            <input
              className="fb-trap"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              name="website"
              value={trap}
              onChange={(e) => setTrap(e.target.value)}
            />
            {error && (
              <p role="alert" className="fb-error">
                {error}
              </p>
            )}
            <div className="fb-foot">
              <small>
                We only use your details to reply. See our{' '}
                <a href="/privacy/" target="_blank" rel="noopener">
                  privacy information
                </a>
                .
              </small>
              <button className="btn btn-primary" disabled={state === 'sending'} type="submit">
                <Send size={15} />
                {state === 'sending' ? 'Sending…' : 'Send'}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
