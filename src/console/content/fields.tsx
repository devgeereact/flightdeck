import { useId, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';

// Form fields for the content editors. Every field shows the server's error for its path (for example "hero.title").
export type Errors = Record<string, string>;
type Base = { label: string; path: string; errors: Errors; hint?: ReactNode };

function Wrap({
  label,
  path,
  errors,
  hint,
  id,
  count,
  max,
  children,
}: Base & { id: string; count?: number; max?: number; children: ReactNode }) {
  const err = errors[path];
  return (
    <div className={err ? 'cn-field invalid' : 'cn-field'}>
      <label htmlFor={id}>
        {label}
        {max !== undefined && count !== undefined && (
          <small className={count > max ? 'over' : ''}>
            {count}/{max}
          </small>
        )}
      </label>
      {children}
      {hint && (
        <p className="cn-hint" id={id + '-hint'}>
          {hint}
        </p>
      )}
      {err && (
        <p className="cn-err" id={id + '-err'} role="alert">
          {err}
        </p>
      )}
    </div>
  );
}
const described = (id: string, hint: unknown, err: unknown) =>
  [hint ? id + '-hint' : '', err ? id + '-err' : ''].filter(Boolean).join(' ') || undefined;

export function TextField({
  value,
  onChange,
  max,
  type = 'text',
  ...b
}: Base & { value: string; onChange: (v: string) => void; max?: number; type?: string }) {
  const id = useId();
  return (
    <Wrap {...b} id={id} count={value.length} max={max}>
      <input
        id={id}
        type={type}
        value={value}
        maxLength={max ? max + 50 : undefined}
        aria-invalid={!!b.errors[b.path]}
        aria-describedby={described(id, b.hint, b.errors[b.path])}
        onChange={(e) => onChange(e.target.value)}
      />
    </Wrap>
  );
}

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
  return (
    <Wrap
      {...b}
      id={id}
      count={value.length}
      max={max}
      hint={b.hint ?? (markdown ? <MarkdownHelp /> : undefined)}
    >
      <textarea
        id={id}
        rows={rows}
        value={value}
        className={markdown ? 'cn-md' : ''}
        spellCheck
        aria-invalid={!!b.errors[b.path]}
        aria-describedby={described(id, b.hint ?? markdown, b.errors[b.path])}
        onChange={(e) => onChange(e.target.value)}
      />
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
        value={value}
        aria-invalid={!!b.errors[b.path]}
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
    <fieldset className="cn-choice">
      <legend>{label}</legend>
      {options.map(([v, l]) => (
        <label key={v}>
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
    </fieldset>
  );
}

function MarkdownHelp() {
  return (
    <details className="cn-mdhelp">
      <summary>Formatting help</summary>
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

/** An ordered list editor: add, remove, move up/down. */
export function ListEditor<T>({
  label,
  items,
  onChange,
  make,
  max,
  render,
  path,
  errors,
}: {
  label: string;
  items: T[];
  onChange: (v: T[]) => void;
  make: () => T;
  max: number;
  render: (item: T, set: (v: T) => void, i: number) => ReactNode;
  path: string;
  errors: Errors;
}) {
  const move = (i: number, d: number) => {
    const n = [...items];
    const [x] = n.splice(i, 1);
    n.splice(i + d, 0, x);
    onChange(n);
  };
  return (
    <fieldset className="cn-list">
      <legend>{label}</legend>
      {errors[path] && (
        <p className="cn-err" role="alert">
          {errors[path]}
        </p>
      )}
      <ol>
        {items.map((it, i) => (
          <li key={i}>
            <div className="cn-list-body">
              {render(it, (v) => onChange(items.map((x, j) => (j === i ? v : x))), i)}
            </div>
            <div className="cn-list-tools">
              <button
                type="button"
                className="icon-button"
                aria-label={`Move item ${i + 1} up`}
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={`Move item ${i + 1} down`}
                disabled={i === items.length - 1}
                onClick={() => move(i, 1)}
              >
                <ArrowDown size={14} />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove item ${i + 1}`}
                onClick={() => onChange(items.filter((_, j) => j !== i))}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        ))}
      </ol>
      {items.length < max && (
        <button
          type="button"
          className="text-button primary"
          onClick={() => onChange([...items, make()])}
        >
          <Plus size={13} />
          Add
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
