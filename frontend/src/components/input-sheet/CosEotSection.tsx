import { useState } from 'react';
import {
  useCreateCosEotMutation,
  useDeleteCosEotMutation,
  useUpdateCosEotMutation,
} from '../../app/api/cosEotApi';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { FormSectionHeader } from './FormSectionHeader';
import { NumberField } from './NumberField';
import { FormField } from './FormField';
import type { CosCategory, CosEotItem, CosEotUpsertPayload } from '../../types/api';

interface Props {
  projectId: string | null;
  items: CosEotItem[];
}

const CATEGORIES: CosCategory[] = [
  'SCOPE ADDITION',
  'SCOPE DELETION',
  'DESIGN CHANGE',
  'QUANTITY VARIATION',
  'OTHERS',
];

interface DraftRow {
  cosNumber: string;
  cosDate: string;
  category: CosCategory;
  cosAmountCr: number | null;
  variationPct: number | null;
  eotNumber: string;
  eotDaysGranted: number | null;
  timeLinked: boolean;
  originalEndDate: string;
  newEndDate: string;
  revisedDate: string;
}

function emptyRow(): DraftRow {
  return {
    cosNumber: '',
    cosDate: '',
    category: 'SCOPE ADDITION',
    cosAmountCr: null,
    variationPct: null,
    eotNumber: '',
    eotDaysGranted: null,
    timeLinked: false,
    originalEndDate: '',
    newEndDate: '',
    revisedDate: '',
  };
}

function toPayload(row: DraftRow): CosEotUpsertPayload {
  return {
    cosNumber: row.cosNumber || null,
    cosDate: row.cosDate || null,
    category: row.category,
    cosAmountCr: row.cosAmountCr,
    variationPct: row.variationPct,
    eotNumber: row.eotNumber || null,
    eotDaysGranted: row.eotDaysGranted ?? 0,
    timeLinked: row.timeLinked,
    originalEndDate: row.originalEndDate || null,
    newEndDate: row.newEndDate || null,
    revisedDate: row.revisedDate || null,
  };
}

function fromItem(item: CosEotItem): DraftRow {
  return {
    cosNumber: item.cosNumber ?? '',
    cosDate: item.cosDate ?? '',
    category: item.category ?? 'SCOPE ADDITION',
    cosAmountCr: item.cosAmountCr,
    variationPct: item.variationPct,
    eotNumber: item.eotNumber ?? '',
    eotDaysGranted: item.eotDaysGranted,
    timeLinked: item.timeLinked ?? false,
    originalEndDate: item.originalEndDate ?? '',
    newEndDate: item.newEndDate ?? '',
    revisedDate: item.revisedDate ?? '',
  };
}

export function CosEotSection({ projectId, items }: Props): JSX.Element {
  const [createCosEot, createState] = useCreateCosEotMutation();
  const [updateCosEot, updateState] = useUpdateCosEotMutation();
  const [deleteCosEot, deleteState] = useDeleteCosEotMutation();
  const [newRow, setNewRow] = useState<DraftRow | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<DraftRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = createState.isLoading || updateState.isLoading || deleteState.isLoading;

  const startEdit = (item: CosEotItem): void => {
    setEditingId(item.cosId);
    setEditRow(fromItem(item));
  };
  const cancelEdit = (): void => {
    setEditingId(null);
    setEditRow(null);
  };

  const totalAmount = items.reduce((s, c) => s + (c.cosAmountCr ?? 0), 0);
  const totalEotDays = items.reduce((s, c) => s + (c.eotDaysGranted ?? 0), 0);
  const latestRevised = [...items]
    .map((c) => c.revisedDate ?? c.newEndDate)
    .filter((d): d is string => !!d)
    .sort()
    .pop();

  if (!projectId) {
    return (
      <Card>
        <CardContent className="pt-4">
          <FormSectionHeader
            num="03"
            title="Change of Scope (CoS) & Extension of Time (EoT)"
            sub="Save the project first — CoS/EoT rows attach to an existing project."
          />
          <p className="rounded border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-[12.5px] text-[#92400E]">
            💡 CoS/EoT items become available after you save this project. Fill Section 01
            (Project Name) and click Save; then return to this tab.
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleCreate = async (): Promise<void> => {
    if (!newRow) return;
    try {
      setError(null);
      await createCosEot({ projectId, body: toPayload(newRow) }).unwrap();
      setNewRow(null);
    } catch (err) {
      setError(readError(err));
    }
  };
  const handleUpdate = async (cosId: number): Promise<void> => {
    if (!editRow) return;
    try {
      setError(null);
      await updateCosEot({ projectId, cosId, body: toPayload(editRow) }).unwrap();
      cancelEdit();
    } catch (err) {
      setError(readError(err));
    }
  };
  const handleDelete = async (cosId: number): Promise<void> => {
    if (!window.confirm('Delete this CoS/EoT entry?')) return;
    try {
      setError(null);
      await deleteCosEot({ projectId, cosId }).unwrap();
    } catch (err) {
      setError(readError(err));
    }
  };

  return (
    <Card>
      <CardContent className="pt-4">
        <FormSectionHeader
          num="03"
          title="Change of Scope (CoS) & Extension of Time (EoT)"
          sub="Each row is a separate CoS event. Revised End Date on the latest row feeds Section 02."
          right={
            <Button
              size="sm"
              onClick={() => setNewRow(emptyRow())}
              disabled={busy || newRow !== null}
            >
              + Add CoS
            </Button>
          }
        />

        {error ? (
          <div className="mb-3 rounded border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-[12.5px] text-[#B91C1C]">
            {error}
          </div>
        ) : null}

        {items.length === 0 && newRow === null ? (
          <p className="text-[12.5px] text-[#6B7280]">
            No CoS/EoT recorded. Click <strong>+ Add CoS</strong> to add one.
          </p>
        ) : null}

        <div className="space-y-3">
          {items.map((item, idx) => {
            const isEditing = editingId === item.cosId;
            return (
              <div
                key={item.cosId}
                className="overflow-hidden rounded-lg border border-[#E5E7EB]"
                style={{ borderLeft: '4px solid #7C3AED' }}
              >
                <div className="flex items-center justify-between bg-[#F9FAFB] px-3 py-2">
                  <div className="flex items-center gap-2 text-[12px]">
                    <span className="rounded-md bg-[#7C3AED] px-2 py-0.5 text-[11px] font-bold text-white">
                      CoS-{String(idx + 1).padStart(2, '0')}
                    </span>
                    <span className="text-[#6B7280]">
                      {item.cosNumber ?? '—'} · {item.category ?? '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isEditing ? (
                      <>
                        <Button size="xs" onClick={() => handleUpdate(item.cosId)} disabled={busy}>
                          Save
                        </Button>
                        <Button size="xs" variant="outline" onClick={cancelEdit} disabled={busy}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => startEdit(item)}
                          disabled={busy}
                        >
                          Edit
                        </Button>
                        <Button
                          size="xs"
                          variant="destructive"
                          onClick={() => handleDelete(item.cosId)}
                          disabled={busy}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <div className="p-3">
                  {isEditing && editRow ? (
                    <CosRowForm row={editRow} onChange={setEditRow} />
                  ) : (
                    <CosRowReadOnly item={item} />
                  )}
                </div>
              </div>
            );
          })}

          {newRow ? (
            <div
              className="overflow-hidden rounded-lg border border-[#93C5FD]"
              style={{ borderLeft: '4px solid #2563EB' }}
            >
              <div className="flex items-center justify-between bg-[#EFF6FF] px-3 py-2">
                <span className="text-[12px] font-bold text-[#1D4ED8]">New CoS</span>
                <div className="flex items-center gap-1.5">
                  <Button size="xs" onClick={handleCreate} disabled={busy}>
                    Save
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => setNewRow(null)}
                    disabled={busy}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
              <div className="p-3">
                <CosRowForm row={newRow} onChange={setNewRow} />
              </div>
            </div>
          ) : null}
        </div>

        {items.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-4 rounded border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-[12px]">
            <span>
              📋 Total CoS events: <strong>{items.length}</strong>
            </span>
            <span>
              🔥 Cumulative CoS value: <strong>₹ {totalAmount.toFixed(2)} Cr</strong>
            </span>
            <span>
              ⏱ Total EoT: <strong className="text-[#2563EB]">{totalEotDays} days</strong>
            </span>
            <span>
              📅 Latest revised end: <strong>{latestRevised ?? '—'}</strong>
            </span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * Phase A §5 — CoS and EoT fields are split into two independent visual
 * blocks. Same DB record backs both blocks (one `cos_eot_item` row is one
 * CoS event with its EoT extension), but the UI keeps them visually
 * separated for readability.
 */
function CosRowForm({
  row,
  onChange,
}: {
  row: DraftRow;
  onChange: (r: DraftRow) => void;
}): JSX.Element {
  const set = <K extends keyof DraftRow>(key: K, value: DraftRow[K]): void =>
    onChange({ ...row, [key]: value });

  return (
    <div className="space-y-3">
      <BlockPanel title="CoS Block" accent="#7C3AED" tint="#F5F3FF">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <FormField label="CoS Number" value={row.cosNumber} onChange={(v) => set('cosNumber', v)} />
          <FormField label="CoS Date" type="date" value={row.cosDate} onChange={(v) => set('cosDate', v)} />
          <FormField
            label="Category"
            type="select"
            value={row.category}
            onChange={(v) => set('category', v as CosCategory)}
            options={CATEGORIES as unknown as string[]}
          />
          <NumberField
            label="CoS Amount"
            suffix="₹ Cr"
            value={row.cosAmountCr}
            onChange={(v) => set('cosAmountCr', v)}
          />
          <NumberField
            label="Variation"
            suffix="%"
            value={row.variationPct}
            onChange={(v) => set('variationPct', v)}
          />
          <FormField
            label="Time Linked?"
            type="select"
            value={row.timeLinked ? 'Yes' : 'No'}
            onChange={(v) => set('timeLinked', v === 'Yes')}
            options={['No', 'Yes']}
            hint={
              row.timeLinked
                ? 'CoS ↔ EoT are linked — EoT dates on this row feed Section 01 Revised End Date.'
                : 'CoS independent of EoT — this row will not adjust the project Revised End Date.'
            }
          />
        </div>
      </BlockPanel>

      <BlockPanel title="EoT Block" accent="#2563EB" tint="#EFF6FF">
        {!row.timeLinked ? (
          <p className="mb-2 rounded border border-[#FDE68A] bg-[#FFFBEB] px-2 py-1 text-[11.5px] text-[#92400E]">
            ⚠ Time Linked is <strong>No</strong> — EoT dates on this row stay independent and do not
            affect the project schedule. Set Time Linked to <strong>Yes</strong> to link them.
          </p>
        ) : null}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <FormField label="EoT Number" value={row.eotNumber} onChange={(v) => set('eotNumber', v)} />
          <NumberField
            label="EoT Days Granted"
            value={row.eotDaysGranted}
            onChange={(v) => set('eotDaysGranted', v)}
          />
          <FormField
            label="Original End Date"
            type="date"
            value={row.originalEndDate}
            onChange={(v) => set('originalEndDate', v)}
          />
          <FormField
            label="New End Date (after EoT)"
            type="date"
            value={row.newEndDate}
            onChange={(v) => set('newEndDate', v)}
          />
          <FormField
            label="Revised Date (if different)"
            type="date"
            value={row.revisedDate}
            onChange={(v) => set('revisedDate', v)}
          />
        </div>
      </BlockPanel>
    </div>
  );
}

function CosRowReadOnly({ item }: { item: CosEotItem }): JSX.Element {
  const cosRows: Array<[string, string]> = [
    ['CoS Number', item.cosNumber ?? '—'],
    ['CoS Date', item.cosDate ?? '—'],
    ['Category', item.category ?? '—'],
    ['CoS Amount', item.cosAmountCr !== null ? `₹ ${item.cosAmountCr.toFixed(2)} Cr` : '—'],
    ['Variation', item.variationPct !== null ? `${item.variationPct.toFixed(2)}%` : '—'],
    ['Time Linked', item.timeLinked ? 'Yes' : 'No'],
  ];
  const eotRows: Array<[string, string]> = [
    ['EoT Number', item.eotNumber ?? '—'],
    ['EoT Days', String(item.eotDaysGranted ?? 0)],
    ['Original End', item.originalEndDate ?? '—'],
    ['New End', item.newEndDate ?? '—'],
    ['Revised', item.revisedDate ?? '—'],
  ];
  return (
    <div className="space-y-3">
      <BlockPanel title="CoS Block" accent="#7C3AED" tint="#F5F3FF">
        <ReadOnlyGrid rows={cosRows} />
      </BlockPanel>
      <BlockPanel title="EoT Block" accent="#2563EB" tint="#EFF6FF">
        <ReadOnlyGrid rows={eotRows} />
      </BlockPanel>
    </div>
  );
}

function BlockPanel({
  title, accent, tint, children,
}: {
  title: string;
  accent: string;
  tint: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div
      className="overflow-hidden rounded-lg border border-[#E5E7EB]"
      style={{ borderLeft: `4px solid ${accent}` }}
    >
      <div
        className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider"
        style={{ backgroundColor: tint, color: accent }}
      >
        {title}
      </div>
      <div className="px-3 py-3">{children}</div>
    </div>
  );
}

function ReadOnlyGrid({ rows }: { rows: Array<[string, string]> }): JSX.Element {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px] md:grid-cols-3">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">{k}</dt>
          <dd className="text-[#111827]">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function readError(err: unknown): string {
  if (err && typeof err === 'object' && 'data' in err) {
    const data = (err as { data?: unknown }).data;
    if (data && typeof data === 'object' && 'error' in data) {
      const e = (data as { error?: { message?: string } }).error;
      if (e?.message) return e.message;
    }
  }
  return 'Something went wrong. Please retry.';
}
