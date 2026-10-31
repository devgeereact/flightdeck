import { AlertTriangle, ExternalLink, ImagePlus } from 'lucide-react';
import { type ReactNode, useEffect, useId, useState } from 'react';
import { ApiError, call, when } from '../api';
import {
  AreaField,
  Choice,
  type Errors,
  FormSection,
  LinesEditor,
  ListEditor,
  SelectField,
  TextField,
} from './fields';

// One form per content type. Each edits a plain object that is sent to the server as it is; the server validates it again.
export type Category = { id: string; title: string };
type F = { data: any; set: (d: any) => void; errors: Errors };
const at = (d: any, k: string, v: unknown) => ({ ...d, [k]: v });

/** The page's address with the site in front. Fixed: existing addresses never change, so links and search results keep working. */
function Address({ id, live }: { id: string; live: boolean }) {
  const uid = useId();
  const path = id === 'home' ? '/' : `/${id}/`;
  return (
    <div className="cn-field">
      <label htmlFor={uid}>Address</label>
      <div className="cs-slug">
        <span className="cs-num">{location.host}/</span>
        <input
          id={uid}
          className="cs-input cs-num"
          value={id === 'home' ? '' : `${id}/`}
          readOnly
          aria-readonly="true"
          aria-describedby={`${uid}-hint`}
        />
      </div>
      <div className="cs-help" id={`${uid}-hint`}>
        <span>Addresses stay fixed so links keep working.</span>
        {live && (
          <a className="cs-quiet" href={path} target="_blank" rel="noreferrer">
            Open the live page <ExternalLink size={14} aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  );
}

function Group({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="cs-fieldset">
      <legend>{legend}</legend>
      {children}
    </fieldset>
  );
}

export function PageForm({
  data,
  set,
  errors,
  categories,
  id,
  live,
}: F & { categories: Category[]; id: string; live: boolean }) {
  const legalish =
    ['legal', 'about'].includes(data.kind) || ['privacy', 'cookies', 'terms'].includes(id);
  if (data.kind === 'home')
    return <HomeForm data={data} set={set} errors={errors} id={id} live={live} />;
  return (
    <>
      <TextField
        label="Title"
        path="title"
        errors={errors}
        value={data.title || ''}
        onChange={(v) => set(at(data, 'title', v))}
        max={120}
        hint={
          data.kind === 'guide'
            ? 'Shown as the heading and in search results (keep it under about 58 characters).'
            : 'The page heading and the browser tab.'
        }
      />
      <Address id={id} live={live} />
      <AreaField
        label="Search description"
        path="description"
        errors={errors}
        value={data.description || ''}
        onChange={(v) => set(at(data, 'description', v))}
        max={300}
        rows={2}
        hint="Shown under the heading and in search results. About 150 characters works best."
      />
      {data.kind === 'guide' && (
        <>
          <SelectField
            label="Guide section"
            path="category"
            errors={errors}
            value={data.category || ''}
            onChange={(v) => set(at(data, 'category', v))}
            options={[
              ['', 'Choose…'],
              ...categories.map((c) => [c.id, c.title] as [string, string]),
            ]}
          />
          <LinesEditor
            label="Key points (shown at the top)"
            items={data.takeaways || []}
            onChange={(v) => set(at(data, 'takeaways', v))}
            max={5}
            maxLen={200}
            path="takeaways"
            errors={errors}
          />
        </>
      )}
      <AreaField
        label={
          data.kind === 'checklist' ||
          data.kind === 'index' ||
          data.kind === 'contact' ||
          data.kind === 'help'
            ? 'Introduction'
            : 'Text'
        }
        path="body"
        errors={errors}
        value={data.body || ''}
        onChange={(v) => set(at(data, 'body', v))}
        max={60000}
        rows={data.kind === 'page' || data.kind === 'guide' || legalish ? 22 : 5}
        markdown
      />
      {(legalish || data.kind === 'guide') && (
        <TextField
          type="date"
          label="Last reviewed"
          path="lastReviewed"
          errors={errors}
          value={data.lastReviewed || ''}
          onChange={(v) => set(at(data, 'lastReviewed', v))}
          hint="Leave empty to use the site-wide review date from Settings."
        />
      )}
    </>
  );
}

function HomeForm({ data, set, errors, id, live }: F & { id: string; live: boolean }) {
  const hero = data.hero || {},
    cov = data.coverage || { columns: [] },
    fin = data.final || {};
  const card = (path: string, label: string) => (it: any, s: (v: any) => void, i: number) => (
    <>
      <TextField
        label={`${label} ${i + 1} title`}
        path={`${path}.${i}.title`}
        errors={errors}
        value={it.title || ''}
        onChange={(v) => s({ ...it, title: v })}
        max={60}
      />
      <AreaField
        label={`${label} ${i + 1} text`}
        path={`${path}.${i}.text`}
        errors={errors}
        value={it.text || ''}
        onChange={(v) => s({ ...it, text: v })}
        max={300}
        rows={2}
      />
    </>
  );
  return (
    <>
      <TextField
        label="Page title (browser tab and search results)"
        path="title"
        errors={errors}
        value={data.title || ''}
        onChange={(v) => set(at(data, 'title', v))}
        max={120}
      />
      <Address id={id} live={live} />
      <AreaField
        label="Description (search results and link previews)"
        path="description"
        errors={errors}
        value={data.description || ''}
        onChange={(v) => set(at(data, 'description', v))}
        max={300}
        rows={2}
      />
      <Group legend="Home page hero">
        <TextField
          label="Small label above the headline"
          path="hero.eyebrow"
          errors={errors}
          value={hero.eyebrow || ''}
          onChange={(v) => set(at(data, 'hero', { ...hero, eyebrow: v }))}
          max={60}
        />
        <TextField
          label="Headline"
          path="hero.title"
          errors={errors}
          value={hero.title || ''}
          onChange={(v) => set(at(data, 'hero', { ...hero, title: v }))}
          max={90}
        />
        <AreaField
          label="Text under the headline"
          path="hero.text"
          errors={errors}
          value={hero.text || ''}
          onChange={(v) => set(at(data, 'hero', { ...hero, text: v }))}
          max={400}
          rows={3}
        />
        <LinesEditor
          label="Points under the flight lookup"
          items={data.points || []}
          onChange={(v) => set(at(data, 'points', v))}
          max={5}
          maxLen={120}
          path="points"
          errors={errors}
        />
      </Group>
      <Group legend="How it works (exactly three steps)">
        <ListEditor
          label="Steps"
          items={data.steps || []}
          onChange={(v) => set(at(data, 'steps', v))}
          make={() => ({ title: '', text: '' })}
          max={3}
          path="steps"
          errors={errors}
          render={card('steps', 'Step')}
          plain
        />
      </Group>
      <Group legend="What you get">
        <ListEditor
          label="Features"
          items={data.features || []}
          onChange={(v) => set(at(data, 'features', v))}
          make={() => ({ title: '', text: '' })}
          max={9}
          path="features"
          errors={errors}
          render={card('features', 'Feature')}
          plain
        />
      </Group>
      <Group legend="Honest about the data">
        <TextField
          label="Title"
          path="coverage.title"
          errors={errors}
          value={cov.title || ''}
          onChange={(v) => set(at(data, 'coverage', { ...cov, title: v }))}
          max={60}
        />
        <TextField
          label="Text"
          path="coverage.text"
          errors={errors}
          value={cov.text || ''}
          onChange={(v) => set(at(data, 'coverage', { ...cov, text: v }))}
          max={300}
        />
        <ListEditor
          label="Columns"
          items={cov.columns || []}
          onChange={(v) => set(at(data, 'coverage', { ...cov, columns: v }))}
          make={() => ({ title: '', items: [] })}
          max={4}
          path="coverage.columns"
          errors={errors}
          render={(c: any, s, i) => (
            <>
              <TextField
                label={`Column ${i + 1} title`}
                path={`coverage.columns.${i}.title`}
                errors={errors}
                value={c.title || ''}
                onChange={(v) => s({ ...c, title: v })}
                max={60}
              />
              <LinesEditor
                label={`Column ${i + 1} points`}
                items={c.items || []}
                onChange={(v) => s({ ...c, items: v })}
                max={6}
                maxLen={160}
                path={`coverage.columns.${i}.items`}
                errors={errors}
              />
            </>
          )}
        />
      </Group>
      <Group legend="Closing band">
        <TextField
          label="Title"
          path="final.title"
          errors={errors}
          value={fin.title || ''}
          onChange={(v) => set(at(data, 'final', { ...fin, title: v }))}
          max={80}
        />
        <AreaField
          label="Text"
          path="final.text"
          errors={errors}
          value={fin.text || ''}
          onChange={(v) => set(at(data, 'final', { ...fin, text: v }))}
          max={300}
          rows={2}
        />
      </Group>
      <p className="cs-label">
        The flight lookup form and the sample flight are part of the page design and always show.
        The sample is labelled as not a real flight.
      </p>
    </>
  );
}

export function FaqForm({ data, set, errors, sections }: F & { sections: string[] }) {
  return (
    <>
      <TextField
        label="Question"
        path="question"
        errors={errors}
        value={data.question || ''}
        onChange={(v) => set(at(data, 'question', v))}
        max={200}
      />
      <AreaField
        label="Answer"
        path="answer"
        errors={errors}
        value={data.answer || ''}
        onChange={(v) => set(at(data, 'answer', v))}
        max={4000}
        rows={6}
        markdown
      />
      <TextField
        label="Section on the help page"
        path="category"
        errors={errors}
        value={data.category || ''}
        onChange={(v) => set(at(data, 'category', v))}
        max={60}
        hint={sections.length ? `Existing sections: ${sections.join(', ')}` : undefined}
      />
      <TextField
        type="number"
        label="Order (lower shows first; the home page shows the first four)"
        path="order"
        errors={errors}
        value={String(data.order ?? 0)}
        onChange={(v) => set(at(data, 'order', Math.max(0, parseInt(v || '0', 10) || 0)))}
      />
    </>
  );
}

// datetime-local works in the browser's own time; the server stores UTC.
const toLocal = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const fromLocal = (v: string) => {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().replace(/\.\d{3}Z$/, 'Z');
};

export function AnnouncementForm({ data, set, errors }: F) {
  return (
    <>
      <AreaField
        label="Message (plain text)"
        path="message"
        errors={errors}
        value={data.message || ''}
        onChange={(v) => set(at(data, 'message', v))}
        max={280}
        rows={2}
      />
      <Choice
        label="Style"
        name="ann-level"
        value={data.level || 'info'}
        onChange={(v) => set(at(data, 'level', v))}
        options={[
          ['info', 'Information'],
          ['warning', 'Warning'],
        ]}
      />
      <Choice
        label="Where it shows"
        name="ann-where"
        value={data.where || 'site'}
        onChange={(v) => set(at(data, 'where', v))}
        options={[
          ['site', 'Website'],
          ['app', 'App'],
          ['both', 'Both'],
        ]}
      />
      <div className="cs-row">
        <TextField
          type="datetime-local"
          label="Start (optional, your local time)"
          path="start"
          errors={errors}
          value={toLocal(data.start || '')}
          onChange={(v) => set(at(data, 'start', fromLocal(v)))}
        />
        <TextField
          type="datetime-local"
          label="End (optional, your local time)"
          path="end"
          errors={errors}
          value={toLocal(data.end || '')}
          onChange={(v) => set(at(data, 'end', fromLocal(v)))}
        />
      </div>
      <div className="cs-row">
        <TextField
          label="Link text (optional)"
          path="link.label"
          errors={errors}
          value={data.linkLabel || ''}
          onChange={(v) => set(at(data, 'linkLabel', v))}
          max={40}
        />
        <TextField
          label="Link address"
          path="link.href"
          errors={errors}
          value={data.linkHref || ''}
          onChange={(v) => set(at(data, 'linkHref', v))}
          hint="A site path such as /coverage/, or https://…"
        />
      </div>
    </>
  );
}

/** Menus: the header links as rows, then each footer group with its links. */
export function NavigationForm({ data, set, errors }: F) {
  const link = (path: string) => (l: any, s: (v: any) => void, i: number) => (
    <div className="cs-row">
      <TextField
        label={`Link ${i + 1} text`}
        path={`${path}.${i}.label`}
        errors={errors}
        value={l.label || ''}
        onChange={(v) => s({ ...l, label: v })}
        max={40}
        compact
      />
      <TextField
        label={`Link ${i + 1} address`}
        compact
        path={`${path}.${i}.href`}
        errors={errors}
        value={l.href || ''}
        onChange={(v) => s({ ...l, href: v })}
      />
    </div>
  );
  return (
    <>
      <FormSection
        title="Header"
        sub={`Shown in this order, 1 to 7 links. The "Open the app" button is always added at the end.`}
      >
        <ListEditor
          label="Top menu"
          items={data.header || []}
          onChange={(v) => set(at(data, 'header', v))}
          make={() => ({ label: '', href: '/' })}
          max={7}
          path="header"
          errors={errors}
          addLabel="Add link"
          plain
          render={link('header')}
        />
      </FormSection>
      <FormSection
        title="Footer"
        sub="1 to 5 groups of up to 8 links. The app's own footer keeps its built-in links."
      >
        <ListEditor
          label="Footer groups"
          items={data.footer || []}
          onChange={(v) => set(at(data, 'footer', v))}
          make={() => ({ title: '', links: [{ label: '', href: '/' }] })}
          max={5}
          path="footer"
          errors={errors}
          addLabel="Add group"
          plain
          grid
          render={(g: any, s, gi) => (
            <div className="cs-footgroup">
              <TextField
                label={`Group ${gi + 1} title`}
                path={`footer.${gi}.title`}
                errors={errors}
                value={g.title || ''}
                onChange={(v) => s({ ...g, title: v })}
                max={40}
                compact
              />
              <ListEditor
                label={`Group ${gi + 1} links`}
                items={g.links || []}
                onChange={(v) => s({ ...g, links: v })}
                make={() => ({ label: '', href: '/' })}
                max={8}
                path={`footer.${gi}.links`}
                errors={errors}
                addLabel="Add link"
                plain
                render={link(`footer.${gi}.links`)}
              />
            </div>
          )}
        />
      </FormSection>
    </>
  );
}

/** Site settings in header-row sections, as in the approved prototype. Only the settings the server really keeps are shown. */
export function SettingsForm({ data, set, errors }: F) {
  return (
    <>
      <FormSection
        title="Site identity"
        sub="Shown in the header, the browser tab and search results."
        two
      >
        <TextField
          label="Site name"
          path="siteName"
          errors={errors}
          value={data.siteName || ''}
          onChange={(v) => set(at(data, 'siteName', v))}
          max={60}
          hint="Used in page titles and next to the logo."
        />
        <TextField
          label="Tagline"
          path="tagline"
          errors={errors}
          value={data.tagline || ''}
          onChange={(v) => set(at(data, 'tagline', v))}
          max={80}
          hint="A short line about the site, used in page titles."
        />
        <TextField
          type="email"
          label="Contact email"
          path="contactEmail"
          errors={errors}
          value={data.contactEmail || ''}
          onChange={(v) => set(at(data, 'contactEmail', v))}
          max={254}
          hint="Shown publicly on the contact page and in the footer."
          wide
        />
      </FormSection>
      <FormSection title="Legal pages" sub="Used in the privacy, cookies and terms pages." two>
        <TextField
          label="Who runs the site"
          path="ownerName"
          errors={errors}
          value={data.ownerName || ''}
          onChange={(v) => set(at(data, 'ownerName', v))}
          max={80}
          hint="Fills {{ownerName}} in the legal pages."
        />
        <TextField
          type="date"
          label="Last reviewed"
          path="lastReviewed"
          errors={errors}
          value={data.lastReviewed || ''}
          onChange={(v) => set(at(data, 'lastReviewed', v))}
          hint="For legal pages and guides without their own date."
        />
      </FormSection>
      <FormSection title="Footer" sub="The text under every public page.">
        <TextField
          label="Footer description"
          path="footerBlurb"
          errors={errors}
          value={data.footerBlurb || ''}
          onChange={(v) => set(at(data, 'footerBlurb', v))}
          max={160}
          hint="One sentence beside the logo."
        />
        <TextField
          label="Footer note"
          path="footerNote"
          errors={errors}
          value={data.footerNote || ''}
          onChange={(v) => set(at(data, 'footerNote', v))}
          max={200}
          hint="Keep the safety advice: flight details can change."
        />
      </FormSection>
      <FormSection
        title="Analytics"
        sub="Google Analytics 4. It loads only after a visitor accepts analytics cookies."
      >
        <TextField
          label="Measurement ID"
          path="gaId"
          errors={errors}
          value={data.gaId || ''}
          onChange={(v) => set(at(data, 'gaId', v.toUpperCase().trim()))}
          max={20}
          hint="Starts with G-. Leave empty to use the ID set when the site was built."
        />
      </FormSection>
      <FormSection
        title="Maintenance page"
        sub="Shown on every public page while maintenance is switched on (Visibility, on the right)."
      >
        <TextField
          label="Message"
          path="maintenanceMessage"
          errors={errors}
          value={data.maintenanceMessage || ''}
          onChange={(v) => set(at(data, 'maintenanceMessage', v))}
          max={200}
          hint="For example: Flightdeck is being updated. Back by 9am."
        />
      </FormSection>
      <FormSection
        title="Link preview image"
        sub="Shown when someone shares a Flightdeck link. 1200 × 630 pixels works best."
      >
        <MediaPicker
          value={data.socialImage || ''}
          onChange={(v) => set(at(data, 'socialImage', v))}
          error={errors.socialImage}
        />
        <p className="cs-label">
          The site address ({data.siteUrl}) is set by hosting and cannot be changed here. Provider
          keys and other private settings live only on the server and never appear in the console.
        </p>
      </FormSection>
    </>
  );
}

function MediaPicker({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const [m, setM] = useState<{
      available: boolean;
      items: { url: string; bytes: number; at: string }[];
    } | null>(null),
    [busy, setBusy] = useState(false),
    [err, setErr] = useState('');
  const load = () =>
    call('/api/admin/media')
      .then(setM)
      .catch((e) => setErr((e as Error).message));
  useEffect(() => {
    void load();
  }, []);
  const upload = async (f: File) => {
    setErr('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type)) {
      setErr('Use a PNG, JPEG or WebP image.');
      return;
    }
    if (f.size > 2097152) {
      setErr('Images can be at most 2 MB.');
      return;
    }
    setBusy(true);
    try {
      const r = await call<{ url: string }>('/api/admin/media', { method: 'POST', raw: f });
      onChange(r.url);
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <fieldset className="cs-media">
      <legend className="cs-sr">Link preview image</legend>
      {(error || err) && (
        <p className="cs-err" role="alert">
          <AlertTriangle size={14} aria-hidden="true" />
          {error || err}
        </p>
      )}
      <div className="cs-media-grid">
        <label className={value === '' ? 'cs-media-item on' : 'cs-media-item'}>
          <input type="radio" name="social" checked={value === ''} onChange={() => onChange('')} />
          <img src="/og-image.png" alt="" loading="lazy" />
          <span>Default image</span>
        </label>
        {m?.items.map((it) => (
          <label key={it.url} className={value === it.url ? 'cs-media-item on' : 'cs-media-item'}>
            <input
              type="radio"
              name="social"
              checked={value === it.url}
              onChange={() => onChange(it.url)}
            />
            <img src={it.url} alt="" loading="lazy" />
            <span>Uploaded {when(it.at)}</span>
          </label>
        ))}
      </div>
      {m && !m.available ? (
        <p className="cs-label">
          Uploads are switched off: the server is missing the image library (GD).
        </p>
      ) : (
        <label className="cs-btn ghost sm cs-upload">
          <ImagePlus size={16} aria-hidden="true" />
          {busy ? 'Uploading…' : 'Upload an image'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="cs-sr"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void upload(f);
            }}
          />
        </label>
      )}
    </fieldset>
  );
}
