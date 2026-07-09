import { useState } from 'react';
import {
  useCreateMomActionPointMutation,
  useDeleteMomActionPointMutation,
  useListMomActionPointsQuery,
  useUpdateMomActionPointMutation,
} from '../../app/api/momApi';
import { Button } from '../ui/button';
import { FormField } from '../input-sheet/FormField';
import { cn } from '../../lib/utils';
import type { MoMActionPoint } from '../../types/api';

interface Props {
  momId: number;
}

interface Draft {
  description: string;
  owner: string;
  dueDate: string;
}

const emptyDraft = (): Draft => ({ description: '', owner: '', dueDate: '' });

export function ActionPointList({ momId }: Props): JSX.Element {
  const { data, isLoading } = useListMomActionPointsQuery(momId);
  const [createPoint, createState] = useCreateMomActionPointMutation();
  const [updatePoint, updateState] = useUpdateMomActionPointMutation();
  const [deletePoint, deleteState] = useDeleteMomActionPointMutation();
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [error, setError] = useState<string | null>(null);
  const busy = createState.isLoading || updateState.isLoading || deleteState.isLoading;

  const items = data?.items ?? [];
  const openCount = items.filter((i) => i.status === 'Open').length;
  const closedCount = items.length - openCount;

  const handleAdd = async (): Promise<void> => {
    setError(null);
    if (!draft.description.trim()) {
      setError('Description is required.');
      return;
    }
    try {
      await createPoint({
        momId,
        body: {
          description: draft.description.trim(),
          owner: draft.owner.trim() || null,
          dueDate: draft.dueDate || null,
          status: 'Open',
        },
      }).unwrap();
      setDraft(emptyDraft());
    } catch (err) {
      setError(readError(err));
    }
  };

  const handleToggle = async (item: MoMActionPoint): Promise<void> => {
    try {
      setError(null);
      const nextStatus = item.status === 'Open' ? 'Closed' : 'Open';
      await updatePoint({
        momId,
        actionId: item.actionId,
        body: {
          status: nextStatus,
          resolutionDate: nextStatus === 'Closed' ? new Date().toISOString().slice(0, 10) : null,
        },
      }).unwrap();
    } catch (err) {
      setError(readError(err));
    }
  };

  const handleDelete = async (actionId: number): Promise<void> => {
    if (!window.confirm('Delete this action point?')) return;
    try {
      setError(null);
      await deletePoint({ momId, actionId }).unwrap();
    } catch (err) {
      setError(readError(err));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
          Action Points ({items.length}) ·{' '}
          <span className="text-[#B91C1C]">{openCount} open</span> ·{' '}
          <span className="text-[#15803D]">{closedCount} closed</span>
        </p>
      </div>

      {error ? (
        <div className="rounded border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-[12.5px] text-[#B91C1C]">
          {error}
        </div>
      ) : null}

      {isLoading ? <p className="text-[12.5px] text-[#6B7280]">Loading action points…</p> : null}

      {items.length > 0 ? (
        <ul className="space-y-1.5">
          {items.map((item, idx) => (
            <li
              key={item.actionId}
              className={cn(
                'grid grid-cols-1 gap-2 rounded border px-3 py-2 text-[12.5px] md:grid-cols-[24px_1fr_auto_auto_auto_auto]',
                item.status === 'Closed'
                  ? 'border-[#86EFAC] bg-[#F0FDF4]'
                  : 'border-[#FCA5A5] bg-[#FEF2F2]',
              )}
            >
              <span className="text-[10.5px] font-bold text-[#6B7280]">#{idx + 1}</span>
              <span className="text-[#111827]">{item.description}</span>
              <span className="text-[11px] text-[#6B7280]">
                {item.owner ? `👤 ${item.owner}` : '—'}
              </span>
              <span className="text-[11px] text-[#6B7280]">
                {item.dueDate ? `due ${item.dueDate}` : '—'}
              </span>
              <Button size="xs" variant="outline" onClick={() => handleToggle(item)} disabled={busy}>
                {item.status === 'Open' ? 'Close' : 'Reopen'}
              </Button>
              <Button
                size="xs"
                variant="destructive"
                onClick={() => handleDelete(item.actionId)}
                disabled={busy}
              >
                ×
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid grid-cols-1 gap-2 rounded border border-dashed border-[#93C5FD] bg-[#F0F7FF] p-3 md:grid-cols-[2fr_1fr_1fr_auto]">
        <FormField
          label="New action description"
          value={draft.description}
          onChange={(v) => setDraft((d) => ({ ...d, description: v }))}
          placeholder="Describe the action…"
        />
        <FormField
          label="Owner"
          value={draft.owner}
          onChange={(v) => setDraft((d) => ({ ...d, owner: v }))}
          placeholder="Responsible person"
        />
        <FormField
          label="Due date"
          type="date"
          value={draft.dueDate}
          onChange={(v) => setDraft((d) => ({ ...d, dueDate: v }))}
        />
        <div className="flex items-end">
          <Button size="sm" onClick={handleAdd} disabled={busy || !draft.description.trim()}>
            + Add
          </Button>
        </div>
      </div>
    </div>
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
