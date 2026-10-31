import { AlertTriangle, Pencil, Plus, Search, Send, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { call, when } from '../api';
import {
  Badge,
  type ContentState,
  contentState,
  Dialog,
  Empty,
  LoadError,
  Loading,
  PageHead,
  Panel,
  StateBadge,
  Switch,
  toast,
  useRise,
} from '../ui';
import Editor, { type ContentType } from './Editor';
import type { Category } from './forms';

type Item = {
  id: string;
  label: string;
  kind: string | null;
  category: string | null;
  published: boolean;
  unpublished: boolean;
  hasDraft: boolean;
  updatedAt: string | null;
  required: boolean;
};
export type Section = 'pages' | 'guides' | 'faqs' | 'announcements' | 'navigation' | 'settings';
const TYPE: Record<Section, ContentType> = {
  pages: 'page',
  guides: 'page',
  faqs: 'faq',
  announcements: 'announcement',
  navigation: 'navigation',
  settings: 'settings',
};
const STATES: ContentState[] = ['Published', 'Changes not published', 'Draft only', 'Hidden'];
const stamp = () => Date.now().toString(36);
const slugify = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
const contentPath = (type: ContentType, id: string) =>
  `/api/admin/content/${type}/${type === 'page' ? id.split('/').map(encodeURIComponent).join('/') : encodeURIComponent(id)}`;

/** A list of items with their state, and the editor for the one that is open (#/admin/<section>/<id>). */
export default function ContentSection({
  section,
  openId,
  navigate,
  onTitle,
}: {
  section: Section;
  openId: string | null;
  navigate: (id: string | null) => void;
  onTitle: (t: string | null) => void;
}) {
  const type = TYPE[section];
  const [items, setItems] = useState<Item[] | null>(null),
    [categories, setCategories] = useState<Category[]>([]),
    [err, setErr] = useState<unknown>(null);
  const [creating, setCreating] = useState<{ id: string; blank: any } | null>(null);
  const load = useCallback(async () => {
    setErr(null);
    try {
      const d = await call<{ items: Item[]; categories: Category[] }>(`/api/admin/content/${type}`);
      setItems(d.items);
      setCategories(d.categories);
    } catch (e) {
      setErr(e);
    }
  }, [type]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reload when the section changes
  useEffect(() => {
    void load();
    setCreating(null);
  }, [load, section]);
  const single = section === 'navigation' || section === 'settings';
  if (single)
    return (
      <Editor
        type={type}
        id={section === 'navigation' ? 'main' : 'site'}
        categories={categories}
        sections={[]}
        onChanged={() => void load()}
        onTitle={onTitle}
      />
    );
  const sections = [...new Set((items || []).map((i) => i.category).filter(Boolean) as string[])];
  if (creating || openId) {
    const id = creating?.id ?? (openId as string);
    const known = (items || []).some((i) => i.id === id);
    return (
      <Editor
        key={id}
        type={type}
        id={id}
        isNew={!!creating && !known}
        blank={creating?.blank}
        categories={categories}
        sections={sections}
        backLabel={
          section === 'faqs'
            ? 'All questions'
            : section === 'announcements'
              ? 'All announcements'
              : `All ${section}`
        }
        onClose={() => {
          setCreating(null);
          navigate(null);
          void load();
        }}
        onChanged={() => void load()}
        onTitle={onTitle}
      />
    );
  }
  const create = (id: string, blank: any) => {
    setCreating({ id, blank });
    navigate(id);
  };
  const props = { items, categories, err, load, open: navigate, create };
  if (section === 'faqs') return <FaqList {...props} />;
  if (section === 'announcements') return <AnnouncementList {...props} />;
  return <PageList {...props} guides={section === 'guides'} />;
}

type ListProps = {
  items: Item[] | null;
  categories: Category[];
  err: unknown;
  load: () => Promise<void>;
  open: (id: string) => void;
  create: (id: string, blank: any) => void;
};

/** Pages and guides: search, filter by state, and a table that opens the editor. */
function PageList({
  items,
  categories,
  err,
  load,
  open,
  create,
  guides,
}: ListProps & { guides: boolean }) {
  const [q, setQ] = useState(''),
    [f, setF] = useState<'all' | ContentState>('all'),
    [newOpen, setNewOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useRise(root, [!!items]);
  const all = (items || [])
    .filter((i) => (guides ? i.kind === 'guide' : i.kind !== 'guide'))
    .sort((a, b) => Number(b.id === 'home') - Number(a.id === 'home'));
  const rows = all.filter(
    (i) =>
      (f === 'all' || contentState(i) === f) &&
      `${i.label} ${i.id}`.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const cat = Object.fromEntries(categories.map((c) => [c.id, c.title]));
  const noun = guides ? 'guide' : 'page';
  return (
    <div className="cs-stack" ref={root}>
      <PageHead
        title={guides ? 'Guides' : 'Pages'}
        lede={
          guides
            ? `${all.length} travel guides, each in a section of the guides page.`
            : 'Every public page. Changes are saved as drafts and go live when you publish.'
        }
        actions={
          <button type="button" className="cs-btn primary sm" onClick={() => setNewOpen(true)}>
            <Plus size={16} aria-hidden="true" />
            New {noun}
          </button>
        }
      />
      {err ? <LoadError error={err} retry={() => void load()} /> : null}
      {!items ? (
        !err && <Loading />
      ) : (
        <Panel>
          <div className="cs-toolbar">
            <div className="cs-search">
              <Search size={18} aria-hidden="true" />
              <label className="cs-sr" htmlFor="cs-lq">
                Search {guides ? 'guides' : 'pages'}
              </label>
              <input
                id="cs-lq"
                className="cs-input"
                placeholder="Search by title or address"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="cs-chips" role="group" aria-label="Filter by state">
              {(['all', ...STATES] as const).map((k) => (
                <button
                  type="button"
                  key={k}
                  className="cs-chip"
                  aria-pressed={f === k}
                  onClick={() => setF(k)}
                >
                  {k === 'all' ? 'All' : k}{' '}
                  <span className="cs-chip-n cs-num">
                    {k === 'all' ? all.length : all.filter((i) => contentState(i) === k).length}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="cs-tw">
            <table className="cs-table cs-list">
              <thead>
                <tr>
                  <th>Title</th>
                  {guides && <th>Section</th>}
                  <th>State</th>
                  <th className="num">Draft saved</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map((i) => (
                    <tr key={i.id} className="cs-click" onClick={() => open(i.id)}>
                      <td>
                        <a
                          className="cs-t"
                          href={`#/admin/${guides ? 'guides' : 'pages'}/${encodeURIComponent(i.id)}`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            open(i.id);
                          }}
                        >
                          {i.label || i.id}
                        </a>
                        <span className="cs-s cs-num">/{i.id === 'home' ? '' : `${i.id}/`}</span>
                      </td>
                      {guides && <td className="cs-muted">{cat[i.category || ''] || '—'}</td>}
                      <td>
                        <StateBadge state={contentState(i)} />
                      </td>
                      <td className="num cs-muted">{i.updatedAt ? when(i.updatedAt) : '—'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={guides ? 4 : 3} className="cs-empty-cell">
                      {all.length
                        ? 'Nothing matches. Clear the search or choose another filter.'
                        : `No ${noun}s yet.`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {newOpen && (
        <NewPageDialog
          guides={guides}
          categories={categories}
          taken={(items || []).map((i) => i.id)}
          onClose={() => setNewOpen(false)}
          onCreate={(id, blank) => {
            setNewOpen(false);
            create(id, blank);
          }}
        />
      )}
    </div>
  );
}

function NewPageDialog({
  guides,
  categories,
  taken,
  onClose,
  onCreate,
}: {
  guides: boolean;
  categories: Category[];
  taken: string[];
  onClose: () => void;
  onCreate: (id: string, blank: any) => void;
}) {
  const [slug, setSlug] = useState(''),
    [catId, setCatId] = useState(''),
    [err, setErr] = useState('');
  const submit = () => {
    const s = slugify(slug);
    const id = guides ? `guides/${s}` : s;
    if (!s) return setErr('Type an address, such as my-page.');
    if (taken.includes(id)) return setErr('A page with that address already exists.');
    if (guides && !catId) return setErr('Choose a guide section.');
    onCreate(
      id,
      guides
        ? { kind: 'guide', title: '', description: '', body: '', category: catId, takeaways: [] }
        : { kind: 'page', title: '', description: '', body: '' },
    );
  };
  return (
    <Dialog
      title={guides ? 'New guide' : 'New page'}
      sub="The address cannot be changed after the first publish, so links keep working."
      onClose={onClose}
    >
      <form
        className="cs-form-grid"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="cn-field">
          <label htmlFor="cs-new-slug">Address</label>
          <div className="cs-slug">
            <span className="cs-num">
              {location.host}/{guides ? 'guides/' : ''}
            </span>
            <input
              id="cs-new-slug"
              className="cs-input cs-num"
              value={slug}
              placeholder={guides ? 'my-new-guide' : 'my-new-page'}
              aria-invalid={!!err}
              aria-describedby="cs-new-help"
              onChange={(e) => setSlug(e.target.value)}
            />
          </div>
          <div className="cs-help" id="cs-new-help">
            <span>
              Lowercase words joined by hyphens.
              {slug && slugify(slug) !== slug ? ` It will be /${slugify(slug)}/.` : ''}
            </span>
          </div>
        </div>
        {guides && (
          <div className="cn-field">
            <label htmlFor="cs-new-cat">Section</label>
            <select
              id="cs-new-cat"
              className="cs-input"
              value={catId}
              onChange={(e) => setCatId(e.target.value)}
            >
              <option value="">Choose…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        )}
        {err && (
          <p className="cs-err" role="alert">
            <AlertTriangle size={14} aria-hidden="true" />
            {err}
          </p>
        )}
        <div className="cs-dialog-foot">
          <button type="button" className="cs-btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="cs-btn primary">
            Start the draft
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** Help and FAQ: the questions in the order the help page shows them, with a single "Publish changes" for every waiting draft. */
function FaqList({ items, err, load, open, create }: ListProps) {
  const [confirm, setConfirm] = useState<'publish' | Item | null>(null),
    [busy, setBusy] = useState(false),
    [actErr, setActErr] = useState<unknown>(null);
  const root = useRef<HTMLDivElement>(null);
  useRise(root, [!!items]);
  const list = items || [];
  const waiting = list.filter((i) => i.hasDraft && !i.unpublished);
  const publishAll = async () => {
    setBusy(true);
    setActErr(null);
    try {
      for (const i of waiting)
        await call(contentPath('faq', i.id), { method: 'POST', body: { action: 'publish' } });
      toast('Help and FAQ published. The website shows it now.');
    } catch (e) {
      setActErr(e);
    } finally {
      setBusy(false);
      setConfirm(null);
      void load();
    }
  };
  const remove = async (i: Item) => {
    setBusy(true);
    setActErr(null);
    try {
      await call(contentPath('faq', i.id), { method: 'DELETE' });
      toast('Question deleted. Its history is kept, so it can be restored.');
    } catch (e) {
      setActErr(e);
    } finally {
      setBusy(false);
      setConfirm(null);
      void load();
    }
  };
  return (
    <div className="cs-stack" ref={root}>
      <PageHead
        title="Help and FAQ"
        lede={`${list.length} questions, shown on the help page in this order. The first four also show on the home page.`}
        actions={
          <>
            <button
              type="button"
              className="cs-btn ghost sm"
              onClick={() =>
                create(`faq-${stamp()}`, {
                  question: '',
                  answer: '',
                  category: '',
                  order: list.length + 1,
                })
              }
            >
              <Plus size={16} aria-hidden="true" />
              Add a question
            </button>
            <button
              type="button"
              className="cs-btn primary sm"
              disabled={!waiting.length || busy}
              onClick={() => setConfirm('publish')}
            >
              <Send size={16} aria-hidden="true" />
              Publish changes
            </button>
          </>
        }
      />
      {err ? <LoadError error={err} retry={() => void load()} /> : null}
      {actErr ? <LoadError error={actErr} /> : null}
      {waiting.length > 0 && (
        <div className="cs-banner warn">
          <AlertTriangle size={16} aria-hidden="true" />
          You have changes that visitors cannot see yet ({waiting.length}{' '}
          {waiting.length === 1 ? 'question' : 'questions'}).
        </div>
      )}
      {!items ? (
        !err && <Loading />
      ) : (
        <Panel>
          {list.length === 0 ? (
            <Empty>No questions yet. Add the first one.</Empty>
          ) : (
            <div className="cs-tw">
              <table className="cs-table">
                <thead>
                  <tr>
                    <th className="cs-w-num">#</th>
                    <th>Question</th>
                    <th>State</th>
                    <th className="num">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((i, n) => (
                    <tr key={i.id}>
                      <td className="cs-muted cs-num">{n + 1}</td>
                      <td>
                        <span className="cs-t">{i.label || 'Untitled question'}</span>
                        <span className="cs-s">{i.category || 'No section'}</span>
                      </td>
                      <td>
                        <StateBadge state={contentState(i)} />
                      </td>
                      <td>
                        <div className="cs-rowacts">
                          <button
                            type="button"
                            className="cs-ib"
                            aria-label={`Edit "${i.label}"`}
                            onClick={() => open(i.id)}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            className="cs-ib"
                            aria-label={`Delete "${i.label}"`}
                            onClick={() => setConfirm(i)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
      <p className="cs-label">
        To change the order, open a question and set its Order number. Lower numbers show first.
      </p>
      {confirm && (
        <Dialog
          role="alertdialog"
          title={confirm === 'publish' ? 'Publish the help page changes?' : 'Delete this question?'}
          sub={
            confirm === 'publish'
              ? `${waiting.length} ${waiting.length === 1 ? 'question goes' : 'questions go'} live: ${waiting.map((w) => w.label).join('; ')}.`
              : `"${confirm.label}" leaves the help page. Its history is kept, so it can be restored.`
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
                className={confirm === 'publish' ? 'cs-btn primary' : 'cs-btn danger'}
                disabled={busy}
                onClick={() => void (confirm === 'publish' ? publishAll() : remove(confirm))}
              >
                {busy ? 'Working…' : confirm === 'publish' ? 'Publish' : 'Delete'}
              </button>
            </>
          }
        >
          {null}
        </Dialog>
      )}
    </div>
  );
}

type Ann = { level?: string; where?: string; start?: string; end?: string };
const WHERE: Record<string, string> = { site: 'Website', app: 'App', both: 'Website and app' };
const fmtWhen = (iso?: string) =>
  iso
    ? new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/London',
      }).format(new Date(iso))
    : '';

/** Announcements: one row each, with a switch that shows or hides it on the site straight away. */
function AnnouncementList({ items, err, load, open, create }: ListProps) {
  const [detail, setDetail] = useState<Record<string, Ann>>({}),
    [busy, setBusy] = useState<string | null>(null),
    [confirm, setConfirm] = useState<Item | null>(null),
    [actErr, setActErr] = useState<unknown>(null);
  const root = useRef<HTMLDivElement>(null);
  useRise(root, [!!items]);
  const list = items || [];
  // Style, place and times are not in the list, so each announcement (there are only a few) is read once.
  const ids = list.map((i) => i.id).join(',');
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the list of ids
  useEffect(() => {
    const ctl = new AbortController();
    for (const i of list.slice(0, 12))
      call<{ published: Ann | null; draft: { data: Ann } | null }>(
        contentPath('announcement', i.id),
        {
          signal: ctl.signal,
        },
      )
        .then((d) => setDetail((x) => ({ ...x, [i.id]: d.draft?.data ?? d.published ?? {} })))
        .catch(() => {});
    return () => ctl.abort();
  }, [ids]);
  const toggle = async (i: Item) => {
    const live = i.published && !i.unpublished;
    setBusy(i.id);
    setActErr(null);
    try {
      await call(contentPath('announcement', i.id), {
        method: 'POST',
        body: { action: live ? 'unpublish' : i.published ? 'republish' : 'publish' },
      });
      toast(
        live ? 'Announcement switched off.' : 'Announcement is live. Open the website to see it.',
      );
    } catch (e) {
      setActErr(e);
    } finally {
      setBusy(null);
      void load();
    }
  };
  const remove = async (i: Item) => {
    setBusy(i.id);
    try {
      await call(contentPath('announcement', i.id), { method: 'DELETE' });
      toast('Announcement deleted.');
    } catch (e) {
      setActErr(e);
    } finally {
      setBusy(null);
      setConfirm(null);
      void load();
    }
  };
  return (
    <div className="cs-stack" ref={root}>
      <PageHead
        title="Announcements"
        lede="A short line at the top of the website, the app, or both, optionally between two times."
        actions={
          <button
            type="button"
            className="cs-btn primary sm"
            onClick={() =>
              create(`ann-${stamp()}`, {
                message: '',
                level: 'info',
                where: 'site',
                start: '',
                end: '',
                linkLabel: '',
                linkHref: '',
              })
            }
          >
            <Plus size={16} aria-hidden="true" />
            New announcement
          </button>
        }
      />
      {err ? <LoadError error={err} retry={() => void load()} /> : null}
      {actErr ? <LoadError error={actErr} /> : null}
      {!items ? (
        !err && <Loading />
      ) : (
        <Panel>
          {list.length === 0 ? (
            <Empty>
              No announcements. Add one for things like a provider outage or a new feature.
            </Empty>
          ) : (
            <div className="cs-tw">
              <table className="cs-table">
                <thead>
                  <tr>
                    <th>Message</th>
                    <th>Tone</th>
                    <th>Showing</th>
                    <th className="num">Live</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((i) => {
                    const a = detail[i.id];
                    const live = i.published && !i.unpublished;
                    return (
                      <tr key={i.id}>
                        <td>
                          <span className="cs-t">{i.label || 'Untitled announcement'}</span>
                          <span className="cs-s">
                            {a ? WHERE[a.where || 'site'] : ' '}
                            {i.hasDraft ? ' · changes not published' : ''}
                          </span>
                        </td>
                        <td>
                          {a ? (
                            a.level === 'warning' ? (
                              <Badge tone="warn">Warning</Badge>
                            ) : (
                              <Badge tone="blue">Information</Badge>
                            )
                          ) : (
                            <span className="cs-muted">…</span>
                          )}
                        </td>
                        <td className="cs-muted">
                          {!a
                            ? '…'
                            : a.start || a.end
                              ? `${fmtWhen(a.start) || 'now'} to ${fmtWhen(a.end) || 'no end'}`
                              : 'Until switched off'}
                        </td>
                        <td>
                          <div className="cs-rowacts">
                            <Switch
                              checked={live}
                              label={`Show "${i.label}"`}
                              disabled={busy === i.id}
                              onChange={() => void toggle(i)}
                            />
                            <button
                              type="button"
                              className="cs-ib"
                              aria-label={`Edit "${i.label}"`}
                              onClick={() => open(i.id)}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              className="cs-ib"
                              aria-label={`Delete "${i.label}"`}
                              onClick={() => setConfirm(i)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
      <p className="cs-label">
        Switching one on publishes it straight away. Open the website to see it.
      </p>
      {confirm && (
        <Dialog
          role="alertdialog"
          title="Delete this announcement?"
          sub="If it is live, it disappears from the site straight away. Its history is kept."
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
                disabled={busy === confirm.id}
                onClick={() => void remove(confirm)}
              >
                Delete
              </button>
            </>
          }
        >
          {null}
        </Dialog>
      )}
    </div>
  );
}
