import { ArrowLeft, Eye, RotateCcw, Send, Trash2, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, ago, call, when } from '../api';
import {
  Badge,
  Dialog,
  LoadError,
  Loading,
  Notice,
  PageHead,
  Panel,
  Switch,
  type Tone,
  toast,
  useRise,
} from '../ui';
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
  unpublish: 'Hidden from the site',
  republish: 'Published again',
  discard: 'Draft discarded',
  delete: 'Deleted',
};
const actionLabel = (a: string) =>
  a.startsWith('restore ') ? 'Earlier version restored to draft' : ACTION[a] || a;
const WHERE_SETTINGS: [string, string][] = [
  ['Header and tab title', 'Site name and tagline'],
  ['Contact page and footer', 'Contact email'],
  ['Privacy, cookies and terms', 'Who runs the site, last reviewed'],
  ['Every page footer', 'Description and note'],
  ['Shared links', 'Link preview image'],
];

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
  onTitle,
  backLabel = 'Back to the list',
}: {
  type: ContentType;
  id: string;
  blank?: any;
  isNew?: boolean;
  categories: Category[];
  sections: string[];
  onClose?: () => void;
  onChanged: () => void;
  onTitle?: (t: string | null) => void;
  backLabel?: string;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null),
    [data, setData] = useState<any>(null),
    [baseRev, setBaseRev] = useState(0),
    [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Errors>({}),
    [msg, setMsg] = useState<string | null>(null),
    [loadErr, setLoadErr] = useState<unknown>(null),
    [busy, setBusy] = useState(''),
    [conflict, setConflict] = useState(false);
  const [preview, setPreview] = useState<string | null>(null),
    [allHistory, setAllHistory] = useState(false),
    [viewRev, setViewRev] = useState<{ name: string; data: any } | null>(null),
    [confirm, setConfirm] = useState<'discard' | 'unpublish' | 'delete' | null>(null),
    [ads, setAds] = useState<boolean | null>(null);
  const base = `/api/admin/content/${type}/${type === 'page' ? id.split('/').map(encodeURIComponent).join('/') : encodeURIComponent(id)}`;
  const load = useCallback(async () => {
    setMsg(null);
    setConflict(false);
    setErrors({});
    setLoadErr(null);
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
      } else setLoadErr(e);
    }
  }, [base, isNew, blank]);
  useEffect(() => {
    void load();
  }, [load]);
  // Site settings show whether adverts are on. That is set on the server only, so it is read, never changed, here.
  useEffect(() => {
    if (type !== 'settings') return;
    call<{ ads: boolean }>('/api/admin/system')
      .then((s) => setAds(!!s.ads))
      .catch(() => setAds(null));
  }, [type]);
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
  // After a refused save, move to the first field the server marked.
  useEffect(() => {
    if (!Object.keys(errors).length) return;
    const el = document.querySelector<HTMLElement>('.cs-ed [aria-invalid="true"]');
    el?.focus();
  }, [errors]);
  const set = (d: any) => {
    setData(d);
    setDirty(true);
    setMsg(null);
  };
  const fail = (e: unknown) => {
    if (e instanceof ApiError) {
      if (e.status === 409) setConflict(true);
      if (e.errors) setErrors(e.errors);
      setMsg(e.message);
    } else setMsg('Something went wrong. Please try again.');
  };

  async function refresh() {
    try {
      setLoaded(await call<Loaded>(base));
    } catch {
      /* keep what is on screen */
    }
  }
  async function save(quiet = false): Promise<boolean> {
    setBusy('save');
    setErrors({});
    setMsg(null);
    try {
      const r = await call<{ draft: { rev: number; data: any } }>(base, {
        method: 'PUT',
        body: { baseRev, data },
      });
      setBaseRev(r.draft.rev);
      setData(r.draft.data);
      setDirty(false);
      if (!quiet) toast('Draft saved. It is not on the site until you publish.');
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
  async function act(action: string, extra: object = {}, done = '') {
    setBusy(action);
    setMsg(null);
    try {
      await call(base, { method: 'POST', body: { action, ...extra } });
      onChanged();
      await load();
      if (done) toast(done);
    } catch (e) {
      fail(e);
    } finally {
      setBusy('');
      setConfirm(null);
    }
  }
  async function publish() {
    if (dirty && !(await save(true))) return;
    await act('publish', {}, 'Published. The site shows it now.');
  }
  async function remove() {
    setBusy('delete');
    try {
      await call(base, { method: 'DELETE' });
      onChanged();
      setDirty(false);
      toast('Deleted. Its history is kept, so it can be restored.');
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

  const title = !data
    ? ''
    : type === 'settings'
      ? 'Site settings'
      : type === 'navigation'
        ? 'Menus'
        : type === 'faq'
          ? data.question || 'New question'
          : type === 'announcement'
            ? data.message || 'New announcement'
            : data.title || id;
  useEffect(() => {
    if (title) onTitle?.(title);
  }, [title, onTitle]);
  const root = useRef<HTMLDivElement>(null);
  useRise(root, [!!loaded]);

  const back = onClose && (
    <button
      type="button"
      className="cs-back"
      onClick={() => {
        if (dirty && !window.confirm('Leave without saving your changes?')) return;
        onClose();
      }}
    >
      <ArrowLeft size={16} aria-hidden="true" />
      {backLabel}
    </button>
  );
  if (!loaded || !data)
    return (
      <div className="cs-stack" ref={root}>
        {back && <div className="cs-vh small">{back}</div>}
        {loadErr ? <LoadError error={loadErr} retry={() => void load()} /> : <Loading />}
      </div>
    );
  const pub = loaded.published,
    hasDraft = !!loaded.draft || dirty,
    hidden = !!pub?.unpublished,
    canHide = ['page', 'faq', 'announcement'].includes(type) && !loaded.required,
    isSettings = type === 'settings',
    single = type === 'settings' || type === 'navigation';
  const [stateText, stateTone]: [string, Tone] = dirty
    ? ['Unsaved changes', 'warn']
    : !pub
      ? ['Draft only', 'violet']
      : hidden
        ? ['Hidden', 'grey']
        : loaded.draft
          ? ['Changes not published', 'warn']
          : ['Published', 'ok'];
  const lastPub = loaded.revisions.find((r) => r.action === 'publish' || r.action === 'republish');
  const revs = allHistory ? loaded.revisions : loaded.revisions.slice(0, 6);
  const nothingToPublish = !hasDraft && !!pub && !hidden;
  const lede = isSettings
    ? 'Names and text used across every public page.'
    : type === 'navigation'
      ? 'The links in the website header and footer.'
      : undefined;

  return (
    <div className="cs-stack" ref={root}>
      <PageHead
        small={!single}
        back={back}
        title={title}
        lede={lede}
        actions={<Badge tone={stateTone}>{stateText}</Badge>}
      />
      {msg && (
        <Notice
          kind="error"
          action={
            conflict && (
              <button type="button" className="cs-linkbtn" onClick={() => void load()}>
                Reload the latest version
              </button>
            )
          }
        >
          {msg}
        </Notice>
      )}
      <div className="cs-ed">
        <form
          id="cs-edform"
          className={single ? 'cs-panel cs-form sectioned' : 'cs-panel cs-form'}
          onSubmit={(e) => {
            e.preventDefault();
            void (isSettings ? publish() : save());
          }}
          noValidate
        >
          {type === 'page' && (
            <PageForm
              data={data}
              set={set}
              errors={errors}
              categories={categories}
              id={id}
              live={!!pub && !hidden}
            />
          )}
          {type === 'faq' && <FaqForm data={data} set={set} errors={errors} sections={sections} />}
          {type === 'announcement' && <AnnouncementForm data={data} set={set} errors={errors} />}
          {type === 'navigation' && <NavigationForm data={data} set={set} errors={errors} />}
          {isSettings && <SettingsForm data={data} set={set} errors={errors} />}
        </form>
        <div className="cs-aside">
          <Panel title="Publishing" actions={<Badge tone={stateTone}>{stateText}</Badge>}>
            <div className="cs-pb cs-aside-pb">
              <div className="cs-aside-acts">
                <button
                  className="cs-btn primary"
                  type="button"
                  onClick={() => void publish()}
                  disabled={!!busy || nothingToPublish}
                >
                  <Send size={16} aria-hidden="true" />
                  {busy === 'publish' ? 'Publishing…' : isSettings ? 'Save and publish' : 'Publish'}
                </button>
                {isSettings ? (
                  <button
                    className="cs-btn ghost"
                    type="button"
                    disabled={!dirty || !!busy}
                    onClick={() => {
                      setData(loaded.draft?.data ?? pub);
                      setDirty(false);
                      setErrors({});
                      setMsg(null);
                      toast('Changes discarded.');
                    }}
                  >
                    Discard changes
                  </button>
                ) : (
                  <>
                    <button
                      className="cs-btn ghost"
                      type="button"
                      onClick={() => void showPreview()}
                      disabled={!!busy}
                    >
                      <Eye size={16} aria-hidden="true" />
                      {busy === 'preview' ? 'Preparing…' : 'Preview'}
                    </button>
                    <button
                      className="cs-btn ghost"
                      type="submit"
                      form="cs-edform"
                      disabled={!!busy || !dirty}
                    >
                      {busy === 'save' ? 'Saving…' : 'Save draft'}
                    </button>
                  </>
                )}
                {loaded.draft && !dirty && (
                  <button
                    className="cs-btn quiet danger-text"
                    type="button"
                    onClick={() => setConfirm('discard')}
                    disabled={!!busy}
                  >
                    <Undo2 size={16} aria-hidden="true" />
                    Discard draft
                  </button>
                )}
                {dirty && pub && !isSettings && (
                  <button
                    className="cs-btn quiet"
                    type="button"
                    onClick={() => {
                      setData(loaded.draft?.data ?? pub);
                      setDirty(false);
                      setErrors({});
                    }}
                  >
                    <Undo2 size={16} aria-hidden="true" />
                    Undo changes
                  </button>
                )}
                {isSettings && (
                  <button
                    className="cs-btn quiet"
                    type="button"
                    onClick={() => void showPreview()}
                    disabled={!!busy}
                  >
                    <Eye size={16} aria-hidden="true" />
                    {busy === 'preview' ? 'Preparing…' : 'Preview the home page'}
                  </button>
                )}
              </div>
              <p className="cs-label">
                {dirty
                  ? 'Unsaved changes'
                  : loaded.draft
                    ? `Draft saved ${ago(loaded.draft.updatedAt)}`
                    : 'No unpublished changes'}
                {lastPub ? ` · last published ${ago(lastPub.at)}` : pub ? '' : ' · never published'}
              </p>
            </div>
          </Panel>
          {canHide && (
            <Panel>
              <div className="cs-pb">
                <div className="cs-swrow">
                  <div>
                    <b>Hidden</b>
                    <small>
                      {pub
                        ? type === 'page'
                          ? 'Hidden pages answer "not found" and leave the sitemap.'
                          : 'Hidden items stay here but are not shown on the site.'
                        : 'Publish it first; then it can be hidden.'}
                    </small>
                  </div>
                  <Switch
                    checked={hidden}
                    label="Hide from the site"
                    disabled={!pub || !!busy}
                    onChange={() =>
                      hidden
                        ? void act('republish', {}, 'Shown on the site again.')
                        : setConfirm('unpublish')
                    }
                  />
                </div>
                {(pub || loaded.draft) && (
                  <button
                    className="cs-btn quiet danger-text cs-del"
                    type="button"
                    onClick={() => setConfirm('delete')}
                    disabled={!!busy}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    Delete
                  </button>
                )}
              </div>
            </Panel>
          )}
          {isSettings && (
            <Panel title="Visibility">
              <div className="cs-pb">
                <div className="cs-swrow">
                  <div>
                    <b>Adverts</b>
                    <small>
                      {ads === null
                        ? 'Set in the private server config, not here.'
                        : ads
                          ? 'On. Set in the private server config, not here.'
                          : 'Locked off. Flightdeck is free and non-commercial; this is set on the server.'}
                    </small>
                  </div>
                  <Switch checked={!!ads} label="Adverts, set on the server" disabled />
                </div>
              </div>
            </Panel>
          )}
          {isSettings && (
            <Panel title="Where these appear">
              <ul className="cs-hist">
                {WHERE_SETTINGS.map(([a, b]) => (
                  <li key={a}>
                    <span>
                      <b>{a}</b>
                      <small>{b}</small>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel title="History" className="cn-history">
            {loaded.revisions.length === 0 ? (
              <p className="cs-empty">No changes yet. The current text is the starting content.</p>
            ) : (
              <ul className="cs-hist">
                {revs.map((r) => (
                  <li key={r.name}>
                    <span>
                      <b>{actionLabel(r.action)}</b>
                      <small className="cs-num">{when(r.at)}</small>
                    </span>
                    {r.hasData && (
                      <span className="cs-hist-acts">
                        <button
                          type="button"
                          className="cs-btn quiet sm"
                          onClick={() => void openRev(r.name)}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="cs-btn quiet sm"
                          onClick={() =>
                            void act(
                              'restore',
                              { revision: r.name },
                              'That version is now the draft. Review it, then publish.',
                            )
                          }
                          disabled={!!busy}
                        >
                          <RotateCcw size={16} aria-hidden="true" />
                          Restore
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {loaded.revisions.length > 6 && (
              <div className="cs-panel-foot">
                <button
                  type="button"
                  className="cs-linkbtn"
                  onClick={() => setAllHistory((a) => !a)}
                >
                  {allHistory ? 'Show the latest 6' : `Show all ${loaded.revisions.length}`}
                </button>
              </div>
            )}
          </Panel>
        </div>
      </div>
      {confirm && (
        <Dialog
          role="alertdialog"
          title={
            confirm === 'delete'
              ? 'Delete this from the site?'
              : confirm === 'unpublish'
                ? 'Hide this from the site?'
                : 'Discard this draft?'
          }
          sub={
            confirm === 'delete'
              ? 'Its history is kept, so it can be restored later.'
              : confirm === 'unpublish'
                ? 'It stays here and you can show it again at any time.'
                : 'Your unpublished changes are lost. The published version stays as it is.'
          }
          onClose={() => setConfirm(null)}
          footer={
            <>
              <button type="button" className="cs-btn ghost" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button
                type="button"
                data-autofocus
                className="cs-btn danger"
                disabled={!!busy}
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
            </>
          }
        >
          {null}
        </Dialog>
      )}
      {viewRev && (
        <Dialog
          wide
          title={`Version from ${when(loaded.revisions.find((r) => r.name === viewRev.name)?.at)}`}
          sub="Read only. Restore it from the history list to make it the draft."
          onClose={() => setViewRev(null)}
        >
          <pre className="cs-revview">
            {viewRev.data.body ?? JSON.stringify(viewRev.data, null, 2)}
          </pre>
        </Dialog>
      )}
      {preview !== null && (
        <Dialog
          wide
          className="cn-preview"
          title="Preview"
          sub="How the draft will look once published. Visitors cannot see it yet. Links and scripts are switched off."
          onClose={() => setPreview(null)}
          footer={
            <button
              type="button"
              className="cs-btn ghost"
              data-autofocus
              onClick={() => setPreview(null)}
            >
              Close
            </button>
          }
        >
          <div className="cs-prev">
            <div className="cs-prev-bar" aria-hidden="true">
              <i />
              <i />
              <i />
              <span className="cs-num">
                {location.host}
                {type === 'page'
                  ? id === 'home'
                    ? '/'
                    : `/${id}/`
                  : type === 'faq'
                    ? '/help/'
                    : '/'}
              </span>
            </div>
            {/* sandbox with no permissions: the page cannot run scripts or navigate; it only draws. */}
            <iframe title="Page preview" sandbox="" srcDoc={preview} />
          </div>
        </Dialog>
      )}
    </div>
  );
}
