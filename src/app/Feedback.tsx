import { Check, Mail, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ga, track } from '../shared/track';

type Kind = 'feedback' | 'bug' | 'contact';
const LABEL: Record<Kind, string> = {
  feedback: 'Send feedback',
  bug: 'Report a problem',
  contact: 'Ask a question',
};
const CHOICE: Record<Kind, string> = {
  feedback: 'Feedback',
  bug: 'A problem',
  contact: 'A question',
};
const MAX = 4000;
const OPEN_EVENT = 'fd:feedback';
/** Opens the feedback dialog from anywhere in the app (sidebar, help page). The top bar has its own button. */
export const openFeedback = () => window.dispatchEvent(new Event(OPEN_EVENT));

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
    if (!dlg.current?.open) dlg.current?.showModal?.();
    track('feedback_opened');
  };
  useEffect(() => {
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);
  const close = () => dlg.current?.close();
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (message.trim().length < 5) {
      setError('Write a little more so the owner can act on it, at least 5 characters.');
      return;
    }
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
      <button
        type="button"
        className="icon-btn fb-btn"
        onClick={open}
        aria-haspopup="dialog"
        aria-label="Send feedback"
        title="Send feedback"
      >
        <Mail size={20} aria-hidden="true" />
      </button>
      <dialog
        ref={dlg}
        className="dialog fb-dialog"
        aria-labelledby="fb-title"
        onClick={(e) => {
          if (e.target === dlg.current) close();
        }}
      >
        <div className="dialog-head fb-head">
          <div>
            <h2 id="fb-title">{LABEL[kind]}</h2>
            <p className="label">It arrives in the owner's inbox.</p>
          </div>
          <button type="button" className="icon-btn fb-close" onClick={close} aria-label="Close">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {state === 'sent' ? (
          <div className="fb-done" role="status">
            <span className="tile">
              <Check size={26} aria-hidden="true" />
            </span>
            <h3>Thank you</h3>
            <p>Your message has been sent. We read everything.</p>
            <button ref={doneClose} type="button" className="btn btn-primary" onClick={close}>
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={send} noValidate className="fb-form">
            <fieldset className="form-row fb-kinds">
              <legend className="sr-only">What is this about?</legend>
              <span className="form-label" aria-hidden="true">
                What is this about?
              </span>
              <div className="chips">
                {(['feedback', 'bug', 'contact'] as Kind[]).map((k) => (
                  <label key={k} className={kind === k ? 'chip fb-kind on' : 'chip fb-kind'}>
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
              </div>
            </fieldset>
            <label className="form-row fb-f">
              <span className="form-label">Tell us what happened</span>
              <textarea
                className="textarea"
                required
                minLength={5}
                maxLength={MAX}
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  kind === 'bug'
                    ? 'What happened, and what did you expect?'
                    : kind === 'contact'
                      ? 'How can we help?'
                      : 'For example: BA117 showed no terminal on Saturday morning.'
                }
              />
              <span className="form-help">
                <span>Include the flight number and date if it is about a result.</span>
                <span className="fd-data">
                  {message.length} / {MAX}
                </span>
              </span>
            </label>
            <div className="fb-row">
              <label className="form-row fb-f">
                <span className="form-label">Name (optional)</span>
                <input
                  className="input"
                  value={name}
                  maxLength={80}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </label>
              <label className="form-row fb-f">
                <span className="form-label">
                  Email{kind === 'contact' ? '' : ' (optional, for a reply)'}
                </span>
                <input
                  className="input"
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
              <p role="alert" className="field-error fb-error">
                {error}
              </p>
            )}
            <div className="dialog-foot fb-foot">
              <small>
                We only use your details to reply. See our{' '}
                <a href="/privacy/" target="_blank" rel="noopener">
                  privacy information
                </a>
                .
              </small>
              <button type="button" className="btn btn-ghost" onClick={close}>
                Cancel
              </button>
              <button className="btn btn-primary" disabled={state === 'sending'} type="submit">
                <Send size={16} aria-hidden="true" />
                {state === 'sending' ? 'Sending…' : 'Send feedback'}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
