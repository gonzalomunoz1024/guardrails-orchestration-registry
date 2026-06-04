import { useState } from 'react';
import { ChevronDown, ChevronRight, Lock, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/utils';
import { RESERVED_FIELDS } from '@/utils';

/**
 * Visual tree editor for the input contract's JSON Schema.
 *
 * Each row exposes the two knobs authors actually care about: the field's
 * declared type and whether the parent requires it. "Any" is offered as a
 * peer type for fields that should accept anything (e.g. metadata blobs
 * that vary between callers but still flow through the same guardrail) —
 * picking it strips all constraints on that node, leaving an open `{}`.
 *
 * Reserved fields rendered with a lock badge cannot be renamed or removed,
 * and their type is fixed (the orchestrator writes them at a known shape).
 * Their required toggle remains editable because customers can mandate
 * them for their own observability.
 */

type Kind = 'any' | 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null';

const KIND_OPTIONS: { value: Kind; label: string; description: string }[] = [
  { value: 'any', label: 'Any', description: 'Accepts any value (no constraint).' },
  { value: 'string', label: 'String', description: 'Text value.' },
  { value: 'number', label: 'Number', description: 'Decimal number.' },
  { value: 'integer', label: 'Integer', description: 'Whole number.' },
  { value: 'boolean', label: 'Boolean', description: 'true or false.' },
  { value: 'object', label: 'Object', description: 'Nested fields.' },
  { value: 'array', label: 'Array', description: 'List of items.' },
  { value: 'null', label: 'Null', description: 'Always null.' },
];

const KIND_TONE: Record<Kind, string> = {
  any: 'text-[var(--color-text-tertiary)] bg-[var(--color-surface-secondary)]',
  string: 'text-[var(--color-info)] bg-[var(--color-info-bg)]',
  number: 'text-[var(--color-info)] bg-[var(--color-info-bg)]',
  integer: 'text-[var(--color-info)] bg-[var(--color-info-bg)]',
  boolean: 'text-[var(--color-warning)] bg-[var(--color-warning-bg)]',
  object: 'text-[var(--color-success)] bg-[var(--color-success-bg)]',
  array: 'text-[var(--color-success)] bg-[var(--color-success-bg)]',
  null: 'text-[var(--color-text-tertiary)] bg-[var(--color-surface-secondary)]',
};

type SchemaNode = Record<string, unknown>;
type PathSegment = { kind: 'prop'; name: string } | { kind: 'item' };

function pathKey(path: PathSegment[]): string {
  return path.map((p) => (p.kind === 'item' ? '[item]' : p.name)).join('.');
}

function isPlainObject(v: unknown): v is SchemaNode {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function getKind(node: unknown): Kind {
  if (!isPlainObject(node)) return 'any';
  const keys = Object.keys(node);
  if (keys.length === 0) return 'any';
  const t = node.type;
  if (typeof t !== 'string') return 'any';
  if (
    t === 'string' ||
    t === 'number' ||
    t === 'integer' ||
    t === 'boolean' ||
    t === 'object' ||
    t === 'array' ||
    t === 'null'
  )
    return t;
  return 'any';
}

/**
 * Replace the schema fragment at one node with a new kind. Description and
 * (where it still makes sense) nested children are preserved so the user
 * doesn't lose their work when toggling between types.
 */
function setKind(node: SchemaNode, kind: Kind): SchemaNode {
  const carry: SchemaNode = {};
  if (typeof node.description === 'string') carry.description = node.description;
  if (kind === 'any') return carry;
  if (kind === 'object') {
    const props = isPlainObject(node.properties) ? node.properties : {};
    const out: SchemaNode = { ...carry, type: 'object', properties: props };
    if (Array.isArray(node.required) && node.required.length > 0) {
      out.required = node.required;
    }
    return out;
  }
  if (kind === 'array') {
    const items = isPlainObject(node.items) ? node.items : {};
    return { ...carry, type: 'array', items };
  }
  return { ...carry, type: kind };
}

function updateAtPath(
  schema: SchemaNode,
  path: PathSegment[],
  updater: (node: SchemaNode) => SchemaNode
): SchemaNode {
  if (path.length === 0) return updater(schema);
  const [head, ...rest] = path;
  if (head.kind === 'item') {
    const items = isPlainObject(schema.items) ? schema.items : {};
    return { ...schema, items: updateAtPath(items, rest, updater) };
  }
  const props = isPlainObject(schema.properties) ? schema.properties : {};
  const child = isPlainObject(props[head.name]) ? (props[head.name] as SchemaNode) : {};
  return {
    ...schema,
    properties: { ...props, [head.name]: updateAtPath(child, rest, updater) },
  };
}

function isChildRequired(parent: SchemaNode, childName: string): boolean {
  const r = parent.required;
  return Array.isArray(r) && r.includes(childName);
}

function setChildRequired(
  schema: SchemaNode,
  parentPath: PathSegment[],
  childName: string,
  required: boolean
): SchemaNode {
  return updateAtPath(schema, parentPath, (parent) => {
    const list = Array.isArray(parent.required) ? [...parent.required] : [];
    const idx = list.indexOf(childName);
    if (required && idx < 0) list.push(childName);
    if (!required && idx >= 0) list.splice(idx, 1);
    const next: SchemaNode = { ...parent };
    if (list.length === 0) delete next.required;
    else next.required = list;
    return next;
  });
}

function addChildField(schema: SchemaNode, parentPath: PathSegment[], name: string): SchemaNode {
  return updateAtPath(schema, parentPath, (parent) => {
    const props = isPlainObject(parent.properties) ? parent.properties : {};
    if (props[name] !== undefined) return parent;
    return {
      ...parent,
      type: 'object',
      properties: { ...props, [name]: {} },
    };
  });
}

function removeChildField(schema: SchemaNode, parentPath: PathSegment[], name: string): SchemaNode {
  return updateAtPath(schema, parentPath, (parent) => {
    const props = isPlainObject(parent.properties) ? { ...parent.properties } : {};
    delete props[name];
    const required = Array.isArray(parent.required)
      ? parent.required.filter((n) => n !== name)
      : undefined;
    const next: SchemaNode = { ...parent, properties: props };
    if (required && required.length > 0) next.required = required;
    else delete next.required;
    return next;
  });
}

// Reserved-field paths are kept locked because the orchestrator writes
// them at a fixed shape; renaming or retyping would cause runtime drift.
const RESERVED_PATHS = new Set(RESERVED_FIELDS.map((f) => f.path));
const RESERVED_BY_PATH = new Map(RESERVED_FIELDS.map((f) => [f.path, f]));

function isReservedDotPath(dotPath: string): boolean {
  return RESERVED_PATHS.has(dotPath);
}

interface SchemaFieldEditorProps {
  schema: SchemaNode;
  onChange: (next: SchemaNode) => void;
}

export function SchemaFieldEditor({ schema, onChange }: SchemaFieldEditorProps) {
  // Start with every node collapsed so the root row reads at a glance — the
  // author sees the top-level shape (metadata, spec, …) and opens what they
  // care about. Fully-expanded trees were overwhelming on rich documents.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [openTypeFor, setOpenTypeFor] = useState<string | null>(null);
  const [adderForParent, setAdderForParent] = useState<string | null>(null);

  const toggleExpand = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const rootKind = getKind(schema);

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border-light)] bg-[var(--color-surface)] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/60 flex items-center justify-between">
        <span className="text-[11px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
          Fields
        </span>
        <span className="text-[11px] text-[var(--color-text-tertiary)]">
          {rootKind === 'object' ? 'Click a row to refine its type or requirement.' : ''}
        </span>
      </div>

      {rootKind !== 'object' ? (
        <div className="px-4 py-6 text-sm text-[var(--color-text-tertiary)]">
          Schema root must be an object before fields can be edited here. Use the JSON view
          below to set the root.
        </div>
      ) : (
        <div className="py-1">
          <ChildRows
            schema={schema}
            parent={schema}
            parentPath={[]}
            parentDotPath=""
            depth={0}
            expanded={expanded}
            toggleExpand={toggleExpand}
            openTypeFor={openTypeFor}
            setOpenTypeFor={setOpenTypeFor}
            adderForParent={adderForParent}
            setAdderForParent={setAdderForParent}
            onChange={onChange}
          />
        </div>
      )}
    </div>
  );
}

interface ChildRowsProps {
  schema: SchemaNode;
  parent: SchemaNode;
  parentPath: PathSegment[];
  parentDotPath: string;
  depth: number;
  expanded: Set<string>;
  toggleExpand: (key: string) => void;
  openTypeFor: string | null;
  setOpenTypeFor: (k: string | null) => void;
  adderForParent: string | null;
  setAdderForParent: (k: string | null) => void;
  onChange: (next: SchemaNode) => void;
}

function ChildRows({
  schema,
  parent,
  parentPath,
  parentDotPath,
  depth,
  expanded,
  toggleExpand,
  openTypeFor,
  setOpenTypeFor,
  adderForParent,
  setAdderForParent,
  onChange,
}: ChildRowsProps) {
  const props = isPlainObject(parent.properties) ? parent.properties : {};
  const names = Object.keys(props);
  const parentKey = pathKey(parentPath) || '__root__';
  const showAdder = adderForParent === parentKey;

  return (
    <>
      {names.length === 0 && !showAdder && (
        <div
          className="px-4 py-3 text-xs text-[var(--color-text-tertiary)]"
          style={{ paddingLeft: 16 + depth * 24 }}
        >
          No fields yet.
        </div>
      )}
      {names.map((name) => {
        const childPath: PathSegment[] = [...parentPath, { kind: 'prop', name }];
        const childDotPath = parentDotPath ? `${parentDotPath}.${name}` : name;
        return (
          <FieldRow
            key={name}
            name={name}
            schema={schema}
            node={isPlainObject(props[name]) ? (props[name] as SchemaNode) : {}}
            parent={parent}
            parentPath={parentPath}
            childPath={childPath}
            dotPath={childDotPath}
            depth={depth}
            expanded={expanded}
            toggleExpand={toggleExpand}
            openTypeFor={openTypeFor}
            setOpenTypeFor={setOpenTypeFor}
            adderForParent={adderForParent}
            setAdderForParent={setAdderForParent}
            onChange={onChange}
          />
        );
      })}
      {/* Inline "+ Add field" row */}
      {showAdder ? (
        <FieldAdder
          depth={depth}
          existingNames={new Set(names)}
          onCancel={() => setAdderForParent(null)}
          onAdd={(name) => {
            onChange(addChildField(schema, parentPath, name));
            setAdderForParent(null);
          }}
        />
      ) : (
        <button
          onClick={() => setAdderForParent(parentKey)}
          className={cn(
            'group w-full flex items-center gap-2 px-3 py-1.5 text-xs',
            'text-[var(--color-text-tertiary)] hover:text-[var(--color-info)] transition-colors'
          )}
          style={{ paddingLeft: 16 + depth * 24 }}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add field</span>
        </button>
      )}
    </>
  );
}

interface FieldRowProps {
  name: string;
  schema: SchemaNode;
  node: SchemaNode;
  parent: SchemaNode;
  parentPath: PathSegment[];
  childPath: PathSegment[];
  dotPath: string;
  depth: number;
  expanded: Set<string>;
  toggleExpand: (key: string) => void;
  openTypeFor: string | null;
  setOpenTypeFor: (k: string | null) => void;
  adderForParent: string | null;
  setAdderForParent: (k: string | null) => void;
  onChange: (next: SchemaNode) => void;
}

function FieldRow({
  name,
  schema,
  node,
  parent,
  parentPath,
  childPath,
  dotPath,
  depth,
  expanded,
  toggleExpand,
  openTypeFor,
  setOpenTypeFor,
  adderForParent,
  setAdderForParent,
  onChange,
}: FieldRowProps) {
  const kind = getKind(node);
  const childKey = pathKey(childPath);
  const isOpen = expanded.has(childKey);
  const isContainer = kind === 'object' || kind === 'array';
  const required = isChildRequired(parent, name);
  const reserved = isReservedDotPath(dotPath);
  const reservedNote = reserved ? RESERVED_BY_PATH.get(dotPath) : undefined;
  const reservedTypeLocked = reserved && reservedNote;

  return (
    <>
      <div
        className={cn(
          'group flex items-center gap-3 px-3 py-2 transition-colors',
          'hover:bg-[var(--color-surface-secondary)]/60'
        )}
        style={{ paddingLeft: 12 + depth * 24 }}
      >
        {/* Chevron or spacer */}
        {isContainer ? (
          <button
            onClick={() => toggleExpand(childKey)}
            className="shrink-0 w-5 h-5 grid place-items-center rounded-[var(--radius-sm)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)] transition-colors"
            title={isOpen ? 'Collapse' : 'Expand'}
          >
            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <span className="shrink-0 w-5 h-5 inline-flex items-center justify-center">
            <span className="w-1 h-1 rounded-full bg-[var(--color-border)]" />
          </span>
        )}

        {/* Name */}
        <span className="font-mono text-[13px] text-[var(--color-text-primary)] truncate min-w-0">
          {name}
        </span>
        {reserved && (
          <span
            title={reservedNote?.note}
            className="shrink-0 inline-flex items-center gap-1 text-[10px] text-[var(--color-text-tertiary)]"
          >
            <Lock className="w-3 h-3" />
            reserved
          </span>
        )}

        {/* Type pill (right-aligned) */}
        <div className="ml-auto flex items-center gap-3">
          <TypePill
            kind={kind}
            disabled={!!reservedTypeLocked}
            isOpen={openTypeFor === childKey}
            onOpen={(open) => setOpenTypeFor(open ? childKey : null)}
            onPick={(newKind) => {
              setOpenTypeFor(null);
              onChange(updateAtPath(schema, childPath, (n) => setKind(n, newKind)));
            }}
          />

          {/* Required switch */}
          <RequiredSwitch
            checked={required}
            onChange={(req) =>
              onChange(setChildRequired(schema, parentPath, name, req))
            }
          />

          {/* Remove (hidden when reserved). Sits on hover so the row stays
              calm at rest. */}
          {!reserved ? (
            <button
              onClick={() =>
                onChange(removeChildField(schema, parentPath, name))
              }
              className="shrink-0 opacity-0 group-hover:opacity-100 text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] transition-opacity"
              title="Remove field"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          ) : (
            <span className="shrink-0 w-3.5 h-3.5" />
          )}
        </div>
      </div>

      {/* Nested children for object / array containers */}
      {kind === 'object' && isOpen && (
        <ChildRows
          schema={schema}
          parent={node}
          parentPath={childPath}
          parentDotPath={dotPath}
          depth={depth + 1}
          expanded={expanded}
          toggleExpand={toggleExpand}
          openTypeFor={openTypeFor}
          setOpenTypeFor={setOpenTypeFor}
          adderForParent={adderForParent}
          setAdderForParent={setAdderForParent}
          onChange={onChange}
        />
      )}
      {kind === 'array' && isOpen && (
        <ArrayItemRow
          schema={schema}
          parentNode={node}
          parentPath={childPath}
          dotPath={dotPath}
          depth={depth + 1}
          expanded={expanded}
          toggleExpand={toggleExpand}
          openTypeFor={openTypeFor}
          setOpenTypeFor={setOpenTypeFor}
          adderForParent={adderForParent}
          setAdderForParent={setAdderForParent}
          onChange={onChange}
        />
      )}
    </>
  );
}

interface ArrayItemRowProps {
  schema: SchemaNode;
  parentNode: SchemaNode;
  parentPath: PathSegment[];
  dotPath: string;
  depth: number;
  expanded: Set<string>;
  toggleExpand: (k: string) => void;
  openTypeFor: string | null;
  setOpenTypeFor: (k: string | null) => void;
  adderForParent: string | null;
  setAdderForParent: (k: string | null) => void;
  onChange: (next: SchemaNode) => void;
}

function ArrayItemRow({
  schema,
  parentNode,
  parentPath,
  dotPath,
  depth,
  expanded,
  toggleExpand,
  openTypeFor,
  setOpenTypeFor,
  adderForParent,
  setAdderForParent,
  onChange,
}: ArrayItemRowProps) {
  const itemNode = isPlainObject(parentNode.items) ? parentNode.items : {};
  const itemPath: PathSegment[] = [...parentPath, { kind: 'item' }];
  const itemKey = pathKey(itemPath);
  const itemKind = getKind(itemNode);
  const isItemContainer = itemKind === 'object' || itemKind === 'array';
  const isOpen = expanded.has(itemKey);

  return (
    <>
      <div
        className="flex items-center gap-3 px-3 py-2 hover:bg-[var(--color-surface-secondary)]/60 transition-colors"
        style={{ paddingLeft: 12 + depth * 24 }}
      >
        {isItemContainer ? (
          <button
            onClick={() => toggleExpand(itemKey)}
            className="shrink-0 w-5 h-5 grid place-items-center rounded-[var(--radius-sm)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)] transition-colors"
          >
            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <span className="shrink-0 w-5 h-5 inline-flex items-center justify-center">
            <span className="w-1 h-1 rounded-full bg-[var(--color-border)]" />
          </span>
        )}

        <span className="font-mono text-[12px] text-[var(--color-text-tertiary)] italic">
          [item]
        </span>

        <div className="ml-auto flex items-center gap-3">
          <TypePill
            kind={itemKind}
            isOpen={openTypeFor === itemKey}
            onOpen={(open) => setOpenTypeFor(open ? itemKey : null)}
            onPick={(newKind) => {
              setOpenTypeFor(null);
              onChange(updateAtPath(schema, itemPath, (n) => setKind(n, newKind)));
            }}
          />
        </div>
      </div>

      {itemKind === 'object' && isOpen && (
        <ChildRows
          schema={schema}
          parent={itemNode}
          parentPath={itemPath}
          parentDotPath={`${dotPath}.[item]`}
          depth={depth + 1}
          expanded={expanded}
          toggleExpand={toggleExpand}
          openTypeFor={openTypeFor}
          setOpenTypeFor={setOpenTypeFor}
          adderForParent={adderForParent}
          setAdderForParent={setAdderForParent}
          onChange={onChange}
        />
      )}
    </>
  );
}

interface TypePillProps {
  kind: Kind;
  disabled?: boolean;
  isOpen: boolean;
  onOpen: (open: boolean) => void;
  onPick: (kind: Kind) => void;
}

function TypePill({ kind, disabled, isOpen, onOpen, onPick }: TypePillProps) {
  return (
    <div className="relative shrink-0">
      <button
        onClick={() => !disabled && onOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium',
          'transition-colors',
          KIND_TONE[kind],
          !disabled && 'hover:opacity-90 cursor-pointer',
          disabled && 'opacity-70 cursor-not-allowed'
        )}
        title={disabled ? 'Type is fixed for this reserved field.' : 'Change type'}
      >
        <span>{KIND_OPTIONS.find((o) => o.value === kind)?.label.toLowerCase()}</span>
        {!disabled && <ChevronDown className="w-3 h-3 opacity-70" />}
      </button>
      {isOpen && (
        <>
          {/* Backdrop to dismiss on outside click. Sits over the rest of
              the surface but below the menu. */}
          <div className="fixed inset-0 z-40" onClick={() => onOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-52 rounded-[var(--radius-md)] border border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)] py-1 animate-fade-in">
            {KIND_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onPick(opt.value)}
                className={cn(
                  'w-full flex items-start gap-2 px-3 py-1.5 text-left transition-colors',
                  'hover:bg-[var(--color-surface-secondary)]',
                  opt.value === kind && 'bg-[var(--color-surface-secondary)]'
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium',
                    KIND_TONE[opt.value]
                  )}
                >
                  {opt.label.toLowerCase()}
                </span>
                <span className="text-[11px] text-[var(--color-text-secondary)] flex-1 leading-snug">
                  {opt.description}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface RequiredSwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
}

function RequiredSwitch({ checked, onChange }: RequiredSwitchProps) {
  return (
    <button
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      title={checked ? 'Required — uncheck to make optional' : 'Optional — check to require'}
      className={cn(
        'shrink-0 inline-flex items-center gap-2 text-[11px] font-medium transition-colors',
        checked ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-tertiary)]'
      )}
    >
      <span
        className={cn(
          'relative w-8 h-[18px] rounded-full transition-colors',
          checked ? 'bg-[var(--color-info)]' : 'bg-[var(--color-border)]'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 w-[14px] h-[14px] rounded-full bg-white transition-transform shadow-sm',
            checked && 'translate-x-[14px]'
          )}
        />
      </span>
      <span className="w-[52px] tabular-nums">
        {checked ? 'Required' : 'Optional'}
      </span>
    </button>
  );
}

interface FieldAdderProps {
  depth: number;
  existingNames: Set<string>;
  onCancel: () => void;
  onAdd: (name: string) => void;
}

function FieldAdder({ depth, existingNames, onCancel, onAdd }: FieldAdderProps) {
  const [name, setName] = useState('');
  const trimmed = name.trim();
  const valid = trimmed.length > 0 && /^[A-Za-z_][\w-]*$/.test(trimmed) && !existingNames.has(trimmed);

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 bg-[var(--color-surface-secondary)]/40"
      style={{ paddingLeft: 12 + depth * 24 }}
    >
      <span className="shrink-0 w-5 h-5 inline-flex items-center justify-center">
        <Plus className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
      </span>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && valid) onAdd(trimmed);
          if (e.key === 'Escape') onCancel();
        }}
        placeholder="field_name"
        spellCheck={false}
        className="flex-1 px-2 py-1 rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border-light)] text-[12px] font-mono text-[var(--color-text-primary)] outline-none focus:border-[var(--color-info)]"
      />
      <button
        onClick={() => valid && onAdd(trimmed)}
        disabled={!valid}
        className="px-2 py-1 rounded-[var(--radius-sm)] text-[11px] font-medium text-white bg-[var(--color-info)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
      >
        Add
      </button>
      <button
        onClick={onCancel}
        className="px-2 py-1 rounded-[var(--radius-sm)] text-[11px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}

