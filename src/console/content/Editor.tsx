import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  History,
  RotateCcw,
  Save,
  Send,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, call, when } from '../api';
import type { Errors } from './fields';
import {
  AnnouncementForm,
  type Category,
  FaqForm,
  NavigationForm,
  PageForm,
  SettingsForm,
} from './forms';

export type ContentType = 'page' | 'faq' | 'announcement' | 'navigation' | 'settings';
type Rev = { name: string; action: string; at: string; by: string; hasData: boolean };
type Loaded = {
  published: any | null;
  draft: { rev: number; data: any; updatedAt: string } | null;
  revisions: Rev[];
  required: boolean;
};
const ACTION: Record<string, string> = {
  save: 'Draft saved',
  publish: 'Published',
  unpublish: 'Unpublished',
  republish: 'Published again',
  discard: 'Draft discarded',
  delete: 'Deleted',
};
const actionLabel = (a: string) =>
  a.startsWith('restore ') ? 'Earlier version restored to draft' : ACTION[a] || a;

/**
 * Edit one item: changes are saved as a draft, previewed with the real site renderer, then published. Nothing reaches the public
 * site until Publish. Every save and publish is kept in History, and any earlier version can be restored into the draft.
 */
export default function Editor({
  type,
  id,
  blank,
  isNew,
  categories,
  sections,
  onClose,
  onChanged,
}: {
  type: ContentType;
  id: string;
  blank?: any;
  isNew?: boolean;
  categories: Category[];
  sections: string[];
  onClose?: () => void;
  onChanged: () => void;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null),
    [data, setData] = useState<any>(null),
    [baseRev, setBaseRev] = useState(0),
    [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Errors>({}),
    [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null),
    [busy, setBusy] = useState(''),
    [conflict, setConflict] = useState(false);
  const [preview, setPreview] = useState<string | null>(null),
    [showHistory, setShowHistory] = useState(false),
    [viewRev, setViewRev] = useState<{ name: string; data: any } | null>(null),
    [confirm, setConfirm] = useState<string | null>(null);
  const base = `/api/admin/content/${type}/${type === 'page' ? id.split('/').map(encodeURIComponent).join('/') : encodeURIComponent(id)}`;
  const load = useCallback(async () => {
    setMsg(null);
    setConflict(false);
    setErrors({});
    try {
      const d = await call<Loaded>(base);
      setLoaded(d);
      setData(d.draft?.data ?? d.published);
      setBaseRev(d.draft?.rev ?? 0);
      setDirty(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404 && isNew) {
        setLoaded({ published: null, draft: null, revisions: [], required: false });
        setData(blank);
        setBaseRev(0);
        setDirty(true);
      } else setMsg({ kind: 'error', text: (e as Error).message });
    }
  }, [base, isNew, blank]);
  useEffect(() => {
    void load();
  }, [load]);
  // Leaving with unsaved changes asks first (closing the tab, or going back to the list).
  useEffect(() => {
    if (!dirty) return;
    const f = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', f);
    return () => window.removeEventListener('beforeunload', f);
  }, [dirty]);
  const set = (d: any) => {
    setData(d);
    setDirty(true);
    setMsg(null);
  };
  const fail = (e: unknown) => {
    if (e instanceof ApiError) {
      if (e.status === 409) setConflict(true);
      if (e.errors) setErrors(e.errors);
      setMsg({ kind: 'error', text: e.message });
    } else setMsg({ kind: 'error', text: 'Something went wrong. Please try again.' });
  };

  async function save(): Promise<boolean> {
    setBusy('save');
    setErrors({});
    try {
      const r = await call<{ draft: { rev: number; data: any } }>(base, {
        method: 'PUT',
        body: { baseRev, data },
      });
      setBaseRev(r.draft.rev);
      setData(r.draft.data);
      setDirty(false);
      setMsg({ kind: 'ok', text: 'Draft saved. It is not on the site until you publish.' });
      onChanged();
      await refresh();
      return true;
    } catch (e) {
      fail(e);
      return false;
    } finally {
      setBusy('');
    }
  }
  async function refresh() {
    try {
      const d = await call<Loaded>(base);
      setLoaded(d);
    } catch {
      /* keep what is on screen */
    }
  }
  async function act(action: string, extra: object = {}, done = '') {
    setBusy(action);
    setMsg(null);
    try {
      await call(base, { method: 'POST', body: { action, ...extra } });
      onChanged();
      await load();
      if (done) setMsg({ kind: 'ok', text: done });
    } catch (e) {
      fail(e);
    } finally {
      setBusy('');
      setConfirm(null);
    }
  }
  async function publish() {
    if (dirty && !(await save())) return;
    await act('publish', {}, 'Published. The site shows it now.');
  }
  async function remove() {
    setBusy('delete');
    try {
      await call(base, { method: 'DELETE' });
      onChanged();
      setDirty(false);
      onClose?.();
    } catch (e) {
      fail(e);
    } finally {
      setBusy('');
      setConfirm(null);
    }
  }
  async function showPreview() {
    setBusy('preview');
    setErrors({});
    try {
      const r = await call<{ html: string }>('/api/admin/preview', {
        method: 'POST',
        body: { type, id, data },
      });
      setPreview(r.html);
    } catch (e) {
      fail(e);
    } finally {
      setBusy('');
    }
  }
  async function openRev(name: string) {
    try {
      const r = await call<{ data: any }>(`${base}?revision=${encodeURIComponent(name)}`);
      setViewRev({ name, data: r.data });
    } catch (e) {
      fail(e);
    }
  }

  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (preview) closeRef.current?.focus();
  }, [preview]);
  if (!loaded || !data)
    return msg ? (
      <div role="alert" className="notice error">
        <AlertTriangle size={16} />
        {msg.text}
      </div>
    ) : (
      <p className="ad-loading" role="status">
        Loading…
      </p>
    );
  const pub = loaded.published,
    hasDraft = !!loaded.draft || dirty,
    hidden = !!pub?.unpublished,
    canHide = ['page', 'faq', 'announcement'].includes(type) && !loaded.required;
  const state = !pub
    ? 'Not published yet'
    : hidden
      ? 'Hidden from the site'
      : hasDraft
        ? 'Published, with unpublished changes'
        : 'Published';
  const title =
    type === 'settings'
      ? 'Site settings'
      : type === 'navigation'
        ? 'Menus'
        : type === 'faq'
          ? data.question || 'New question'
          : type === 'announcement'
            ? data.message || 'New announcement'
            : data.title || id;
  const back = () => {
    if (dirty && !window.confirm('Leave without saving your changes?')) return;
    onClose?.();
  };
  return (
    <section className="cn-editor" aria-labelledby="cn-ed-h">
      <div className="cn-ed-head">
        {onClose && (
          <button className="text-button" onClick={back}>
            <ArrowLeft size={14} />
            Back to the list
          </button>
        )}
        <h2 id="cn-ed-h">{title}</h2>
        <p className="cn-ed-meta">
          <span className={'cn-badge ' + (!pub || hidden ? 'off' : hasDraft ? 'draft' : 'live')}>
            {state}
          </span>
          {type === 'page' && (
            <span>
              Address:{' '}
              <a href={id === 'home' ? '/' : `/${id}/`} target="_blank" rel="noreferrer">
                {id === 'home' ? '/' : `/${id}/`}
              </a>
            </span>
          )}
          {loaded.draft && <span>Draft saved {when(loaded.draft.updatedAt)}</span>}
        </p>
      </div>
      {msg && (
        <div
          role={msg.kind === 'error' ? 'alert' : 'status'}
          className={msg.kind === 'error' ? 'notice error' : 'notice'}
        >
          {msg.kind === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          {msg.text}
          {conflict && (
            <button className="text-button" onClick={() => void load()}>
              Reload the latest version
            </button>
          )}
        </div>
      )}
      <form
        className="cn-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        noValidate
      >
        {type === 'page' && (
          <PageForm data={data} set={set} errors={errors} categories={categories} />
        )}
        {type === 'faq' && <FaqForm data={data} set={set} errors={errors} sections={sections} />}
        {type === 'announcement' && <AnnouncementForm data={data} set={set} errors={errors} />}
        {type === 'navigation' && <NavigationForm data={data} set={set} errors={errors} />}
        {type === 'settings' && <SettingsForm data={data} set={set} errors={errors} />}
        <div className="cn-actions">
          <button className="btn btn-secondary" type="submit" disabled={!!busy || !dirty}>
            <Save size={15} />
            {busy === 'save' ? 'Saving…' : 'Save draft'}
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => void showPreview()}
            disabled={!!busy}
          >
            <Eye size={15} />
            {busy === 'preview' ? 'Preparing…' : 'Preview'}
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => void publish()}
            disabled={!!busy || (!hasDraft && !!pub && !hidden)}
          >
            <Send size={15} />
            {busy === 'publish' ? 'Publishing…' : 'Publish'}
          </button>
          <span className="cn-spacer" />
          {loaded.draft && !dirty && (
            <button
              className="text-button"
              type="button"
              onClick={() => setConfirm('discard')}
              disabled={!!busy}
            >
              <Undo2 size={14} />
              Discard draft
            </button>
          )}
          {dirty && pub && (
            <button
              className="text-button"
              type="button"
              onClick={() => {
                setData(loaded.draft?.data ?? pub);
                setDirty(false);
                setErrors({});
              }}
            >
              <Undo2 size={14} />
              Undo changes
            </button>
          )}
          {canHide &&
            pub &&
            (hidden ? (
              <button
                className="text-button"
                type="button"
                onClick={() => void act('republish', {}, 'Shown on the site again.')}
                disabled={!!busy}
              >
                <Eye size={14} />
                Show on site
              </button>
            ) : (
              <button
                className="text-button"
                type="button"
                onClick={() => setConfirm('unpublish')}
                disabled={!!busy}
              >
                <EyeOff size={14} />
                Hide from site
              </button>
            ))}
          {canHide && (pub || loaded.draft) && (
            <button
              className="text-button danger"
              type="button"
              onClick={() => setConfirm('delete')}
              disabled={!!busy}
            >
              <Trash2 size={14} />
              Delete
            </button>
          )}
          <button
            className="text-button"
            type="button"
            onClick={() => setShowHistory((h) => !h)}
            aria-expanded={showHistory}
          >
            <History size={14} />
            History ({loaded.revisions.length})
          </button>
        </div>
        {confirm && (
          <div className="cn-confirm" role="alertdialog" aria-labelledby="cn-confirm-t">
            <p id="cn-confirm-t">
              {confirm === 'delete'
                ? 'Delete this from the site? Its history is kept, so it can be restored later.'
                : confirm === 'unpublish'
                  ? 'Hide this from the site? You can show it again at any time.'
                  : 'Discard the draft? The published version stays as it is.'}
            </p>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() =>
                void (confirm === 'delete'
                  ? remove()
                  : act(
                      confirm,
                      {},
                      confirm === 'unpublish' ? 'Hidden from the site.' : 'Draft discarded.',
                    ))
              }
            >
              {confirm === 'delete' ? 'Delete' : confirm === 'unpublish' ? 'Hide' : 'Discard'}
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => setConfirm(null)}>
              Cancel
            </button>
          </div>
        )}
      </form>
      {showHistory && (
        <section className="panel cn-history" aria-label="History">
          <h3>History</h3>
          {loaded.revisions.length === 0 ? (
            <p className="ad-note">No changes yet. The current text is the starting content.</p>
          ) : (
            <ol>
              {loaded.revisions.map((r) => (
                <li key={r.name}>
                  <span>
                    <strong>{actionLabel(r.action)}</strong> · {when(r.at)}
                  </span>
                  {r.hasData && (
                    <span className="cn-history-act">
                      <button className="text-button" onClick={() => void openRev(r.name)}>
                        View
                      </button>
                      <button
                        className="text-button"
                        onClick={() =>
                          void act(
                            'restore',
                            { revision: r.name },
                            'That version is now the draft. Review it, then publish.',
                          )
                        }
                        disabled={!!busy}
                      >
                        <RotateCcw size={13} />
                        Restore to draft
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
          {viewRev && (
            <div className="cn-revview">
              <div className="cn-panel-head">
                <h4>
                  Version from {when(loaded.revisions.find((r) => r.name === viewRev.name)?.at)}
                </h4>
                <button className="icon-button" aria-label="Close" onClick={() => setViewRev(null)}>
                  <X size={14} />
                </button>
              </div>
              <pre>{viewRev.data.body ?? JSON.stringify(viewRev.data, null, 2)}</pre>
            </div>
          )}
        </section>
      )}
      {preview !== null && (
        <div
          className="cn-preview"
          role="dialog"
          aria-modal="true"
          aria-label="Preview"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setPreview(null);
          }}
        >
          <div className="cn-preview-bar">
            <strong>Preview</strong>
            <span>Not saved or published. Links and scripts are switched off in the preview.</span>
            <button ref={closeRef} className="btn btn-secondary" onClick={() => setPreview(null)}>
              <X size={15} />
              Close
            </button>
          </div>
          {/* sandbox with no permissions: the page cannot run scripts or navigate; it only draws. */}
          <iframe title="Page preview" sandbox="" srcDoc={preview} />
        </div>
      )}
    </section>
  );
}
