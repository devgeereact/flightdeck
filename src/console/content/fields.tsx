import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { type ReactNode, useId, useRef } from 'react';

// Form fields for the content editors. Every field shows the server's error for its path (for example "hero.title").
// Layout from the approved console prototype: label, control, then a help row with the hint on the left and the character
// count on the right (red once it passes the limit), then the error.
export type Errors = Record<string, string>;
type Base = {
  label: string;
  path: string;
  errors: Errors;
  hint?: ReactNode;
  wide?: boolean;
  /** Menu rows: the label is read by screen readers only, and the count shows only once it passes the limit. */
  compact?: boolean;
};

function Wrap({
  label,
  path,
  errors,
  hint,
  id,
  count,
  max,
  wide,
  compact,
  children,
  after,
}: Base & {
  id: string;
  count?: number;
  max?: number;
  children: ReactNode;
  after?: ReactNode;
}) {
  const err = errors[path];
  const counted = max !== undefined && count !== undefined && (!compact || count > max);
  return (
    <div className={`cn-field${err ? ' invalid' : ''}${wide ? ' wide' : ''}`}>
      <label htmlFor={id} className={compact ? 'cs-sr' : undefined}>
        {label}
      </label>
      {children}
      {(hint || counted) && (
        <div className="cs-help" id={`${id}-hint`}>
          <span>{hint}</span>
          {counted && (
            <span className={count > max ? 'cs-count-n over cs-num' : 'cs-count-n cs-num'}>
              {count} / {max}
            </span>
          )}
        </div>
      )}
      {err && (
        <p className="cn-err cs-err" id={`${id}-err`} role="alert">
          {err}
        </p>
      )}
      {after}
    </div>
  );
}
const described = (id: string, hint: unknown, err: unknown) =>
  [hint ? `${id}-hint` : '', err ? `${id}-err` : ''].filter(Boolean).join(' ') || undefined;

export function TextField({
  value,
  onChange,
  max,
  type = 'text',
  ...b
}: Base & { value: string; onChange: (v: string) => void; max?: number; type?: string }) {
  const id = useId();
  const counted = type === 'text' || type === 'email';
  return (
    <Wrap {...b} id={id} count={counted ? value.length : undefined} max={max}>
      <input
        id={id}
        className={type === 'email' || type === 'number' ? 'cs-input cs-num' : 'cs-input'}
        type={type}
        value={value}
        maxLength={max ? max + 50 : undefined}
        aria-invalid={!!b.errors[b.path]}
        aria-describedby={described(id, b.hint || (max && counted), b.errors[b.path])}
        onChange={(e) => onChange(e.target.value)}
      />
    </Wrap>
  );
}

const MD: [string, string, string][] = [
  ['h2', 'H2', 'Heading'],
  ['b', 'B', 'Bold'],
  ['i', 'I', 'Italic'],
  ['ul', 'List', 'List item'],
  ['a', 'Link', 'Link'],
];

export function AreaField({
  value,
  onChange,
  max,
  rows = 4,
  markdown = false,
  ...b
}: Base & {
  value: string;
  onChange: (v: string) => void;
  max?: number;
  rows?: number;
  markdown?: boolean;
}) {
  const id = useId();
  const ta = useRef<HTMLTextAreaElement>(null);
  // Formatting buttons insert safe Markdown at the cursor (or around the selection), then put the cursor back.
  const insert = (kind: string) => {
    const t = ta.current;
    if (!t) return;
    const s = t.selectionStart,
      e = t.selectionEnd,
      sel = value.slice(s, e);
    const lineStart = s === 0 || value[s - 1] === '\n';
    const ins =
      kind === 'b'
        ? `**${sel || 'bold text'}**`
        : kind === 'i'
          ? `*${sel || 'italic text'}*`
          : kind === 'a'
            ? `[${sel || 'link text'}](/)`
            : `${lineStart ? '' : '\n'}${kind === 'h2' ? '## ' : '- '}${sel || (kind === 'h2' ? 'Heading' : 'Item')}`;
    const next = value.slice(0, s) + ins + value.slice(e);
    onChange(next);
    requestAnimationFrame(() => {
      t.focus();
      t.setSelectionRange(s + ins.length, s + ins.length);
    });
  };
  const hint =
    b.hint ?? (markdown ? 'Safe Markdown: headings, bold, lists and links. No HTML.' : undefined);
  return (
    <Wrap
      {...b}
      hint={hint}
      id={id}
      count={value.length}
      max={max}
      after={markdown ? <MarkdownHelp /> : undefined}
    >
      {markdown ? (
        <div className="cs-mdwrap">
          <div className="cs-fmt" role="toolbar" aria-label={`Formatting for ${b.label}`}>
            {MD.map(([k, l, a]) => (
              <button
                type="button"
                key={k}
                aria-label={a}
                title={a}
                className={k === 'i' ? 'it' : undefined}
                onClick={() => insert(k)}
              >
                {l}
              </button>
            ))}
          </div>
          <textarea
            ref={ta}
            id={id}
            rows={rows}
            value={value}
            className="cs-input cs-textarea cs-md"
            spellCheck
            aria-invalid={!!b.errors[b.path]}
            aria-describedby={described(id, true, b.errors[b.path])}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      ) : (
        <textarea
          id={id}
          rows={rows}
          value={value}
          className="cs-input cs-textarea"
          spellCheck
          aria-invalid={!!b.errors[b.path]}
          aria-describedby={described(id, hint || max, b.errors[b.path])}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Wrap>
  );
}

export function SelectField({
  value,
  onChange,
  options,
  ...b
}: Base & { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  const id = useId();
  return (
    <Wrap {...b} id={id}>
      <select
        id={id}
        className="cs-input"
        value={value}
        aria-invalid={!!b.errors[b.path]}
        aria-describedby={described(id, b.hint, b.errors[b.path])}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </Wrap>
  );
}

/** A small set of choices shown as chips (radio buttons underneath, so the keyboard works as expected). */
export function Choice({
  value,
  onChange,
  options,
  label,
  name,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  label: string;
  name: string;
}) {
  return (
    <fieldset className="cs-choice">
      <legend>{label}</legend>
      <div className="cs-choice-row">
        {options.map(([v, l]) => (
          <label key={v} className={value === v ? 'on' : undefined}>
            <input
              type="radio"
              name={name}
              value={v}
              checked={value === v}
              onChange={() => onChange(v)}
            />
            {l}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function MarkdownHelp() {
  return (
    <details className="cs-mdhelp">
      <summary>More formatting</summary>
      <ul>
        <li>
          <code>## Heading</code> and <code>### Smaller heading</code>
        </li>
        <li>
          <code>**bold**</code>, <code>*italic*</code>, <code>`code`</code>
        </li>
        <li>
          <code>[link text](/guides/)</code> or <code>[text](https://example.com)</code>
        </li>
        <li>
          <code>- item</code> for a list, <code>1. item</code> for a numbered list
        </li>
        <li>
          <code>| A | B |</code> then <code>| --- | --- |</code> for a table; <code>&gt; text</code>{' '}
          for a note
        </li>
        <li>
          Settings: <code>{'{{ownerName}}'}</code>, <code>{'{{contactEmail}}'}</code>,{' '}
          <code>{'{{lastReviewed}}'}</code>. <code>[Cookie settings](#cookie-settings)</code>{' '}
          reopens the cookie choice.
        </li>
        <li>HTML and scripts are not allowed; they are shown as plain text.</li>
      </ul>
    </details>
  );
}

/** An ordered list editor: hairline rows with move up, move down and remove, and an Add button. */
export function ListEditor<T>({
  label,
  items,
  onChange,
  make,
  max,
  render,
  path,
  errors,
  addLabel = 'Add',
  plain = false,
  grid = false,
}: {
  label: string;
  items: T[];
  onChange: (v: T[]) => void;
  make: () => T;
  max: number;
  render: (item: T, set: (v: T) => void, i: number) => ReactNode;
  path: string;
  errors: Errors;
  addLabel?: string;
  plain?: boolean;
  /** Footer groups: the items sit side by side as columns. */
  grid?: boolean;
}) {
  const move = (i: number, d: number) => {
    const n = [...items];
    const [x] = n.splice(i, 1);
    n.splice(i + d, 0, x);
    onChange(n);
  };
  return (
    <fieldset className={`cs-list${plain ? ' plain' : ''}${grid ? ' grid' : ''}`}>
      <legend className={plain ? 'cs-sr' : undefined}>{label}</legend>
      {errors[path] && (
        <p className="cn-err cs-err" role="alert">
          {errors[path]}
        </p>
      )}
      <ol>
        {items.map((it, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: rows are positions in an ordered list
          <li key={i}>
            <div className="cs-list-body">
              {render(it, (v) => onChange(items.map((x, j) => (j === i ? v : x))), i)}
            </div>
            <div className="cs-rowacts">
              <button
                type="button"
                className="cs-ib"
                aria-label={`Move ${label.toLowerCase()} item ${i + 1} up`}
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                <ArrowUp size={16} />
              </button>
              <button
                type="button"
                className="cs-ib"
                aria-label={`Move ${label.toLowerCase()} item ${i + 1} down`}
                disabled={i === items.length - 1}
                onClick={() => move(i, 1)}
              >
                <ArrowDown size={16} />
              </button>
              <button
                type="button"
                className="cs-ib"
                aria-label={`Remove ${label.toLowerCase()} item ${i + 1}`}
                onClick={() => onChange(items.filter((_, j) => j !== i))}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </li>
        ))}
      </ol>
      {items.length < max && (
        <button
          type="button"
          className="cs-btn ghost sm cs-add"
          onClick={() => onChange([...items, make()])}
        >
          <Plus size={16} aria-hidden="true" />
          {addLabel}
        </button>
      )}
    </fieldset>
  );
}

/** A list of one-line texts (key points, hero points, coverage items). */
export function LinesEditor({
  label,
  items,
  onChange,
  max,
  maxLen,
  path,
  errors,
}: {
  label: string;
  items: string[];
  onChange: (v: string[]) => void;
  max: number;
  maxLen: number;
  path: string;
  errors: Errors;
}) {
  return (
    <ListEditor
      label={label}
      items={items}
      onChange={onChange}
      make={() => ''}
      max={max}
      path={path}
      errors={errors}
      addLabel="Add a line"
      render={(v, set, i) => (
        <TextField
          label={`Item ${i + 1}`}
          path={`${path}.${i}`}
          errors={errors}
          value={v}
          onChange={set}
          max={maxLen}
        />
      )}
    />
  );
}

/** A header row inside the form panel (the prototype's ".ph" sections), then its fields. */
export function FormSection({
  title,
  sub,
  two = false,
  children,
}: {
  title: string;
  sub?: string;
  two?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="cs-fsec">
      <div className="cs-ph">
        <div>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
      </div>
      <div className={two ? 'cs-pb cs-setgrid two' : 'cs-pb cs-setgrid'}>{children}</div>
    </div>
  );
}
