import { useState } from 'react';
import {
  useCreateMgmtActionMutation,
  useDeleteMgmtActionMutation,
  useUpdateMgmtActionMutation,
} from '../../app/api/mgmtActionsApi';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { FormField } from './FormField';
import { FormSectionHeader } from './FormSectionHeader';
import { cn } from '../../lib/utils';
import type { ProjectDraft } from '../../hooks/useProjectDraft';
import type { MgmtActionItem, OpenClosedStatus, Priority } from '../../types/api';

interface Props {
  projectId: string | null;
  draft: ProjectDraft;
  setField: <K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) => void;
  actions: MgmtActionItem[];
}

const PRIORITIES: Priority[] = ['High', 'Medium', 'Low', 'N/A'];

export function ActionRemarksSection({
  projectId,
  draft,
  setField,
  actions,
}: Props): JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [newTopic, setNewTopic] = useState('');
  const [newDeadline, setNewDeadline] = useState('');

  const [createAction, createState] = useCreateMgmtActionMutation();
  const [updateAction, updateState] = useUpdateMgmtActionMutation();
  const [deleteAction, deleteState] = useDeleteMgmtActionMutation();
  const busy = createState.isLoading || updateState.isLoading || deleteState.isLoading;

  const hasGap = Boolean(draft.remark?.trim());

  const handleAdd = async (): Promise<void> => {
    if (!projectId || !newTopic.trim()) return;
    try {
      setError(null);
      await createAction({
        projectId,
        body: {
          topic: newTopic.trim(),
          status: 'Open',
          deadlineDate: newDeadline || null,
        },
      }).unwrap();
      setNewTopic('');
      setNewDeadline('');
    } catch (err) {
      setError(readError(err));
    }
  };
  const handleToggle = async (item: MgmtActionItem): Promise<void> => {
    if (!projectId) return;
    try {
      setError(null);
      const next: OpenClosedStatus = item.status === 'Open' ? 'Closed' : 'Open';
      await updateAction({ projectId, itemId: item.itemId, body: { status: next } }).unwrap();
    } catch (err) {
      setError(readError(err));
    }
  };
  const handleDelete = async (itemId: number): Promise<void> => {
    if (!projectId) return;
    if (!window.confirm('Delete this action item?')) return;
    try {
      setError(null);
      await deleteAction({ projectId, itemId }).unwrap();
    } catch (err) {
      setError(readError(err));
    }
  };

  return (
    <Card>
      <CardContent className="pt-4">
        <FormSectionHeader
          num="07"
          title="Action & Remarks"
          sub="Outstanding gaps, priority, and management action items"
        />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <FormField
            label="Priority"
            type="select"
            value={draft.priority ?? ''}
            onChange={(v) => setField('priority', (v as Priority) || null)}
            options={PRIORITIES as unknown as string[]}
          />
          <div>
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-[#374151]">
              Outstanding Gap
            </div>
            <div className="flex overflow-hidden rounded border border-[#D1D5DB]">
              <button
                type="button"
                onClick={() => {
                  if (!hasGap) setField('remark', '');
                }}
                className={cn(
                  'flex-1 px-4 py-2 text-[12px] font-bold',
                  hasGap ? 'bg-[#DC2626] text-white' : 'bg-white text-[#6B7280]',
                )}
              >
                ⚠ Yes — Gap Exists
              </button>
              <button
                type="button"
                onClick={() => setField('remark', null)}
                className={cn(
                  'flex-1 border-l border-[#D1D5DB] px-4 py-2 text-[12px] font-bold',
                  !hasGap ? 'bg-[#1E3A5F] text-white' : 'bg-white text-[#6B7280]',
                )}
              >
                ✓ No — No Gap
              </button>
            </div>
          </div>
        </div>

        {draft.remark !== null ? (
          <div className="mt-3">
            <FormField
              label="Gap / Remark (visible in Outstanding Gaps tab)"
              type="textarea"
              rows={3}
              value={draft.remark ?? ''}
              onChange={(v) => setField('remark', v)}
              placeholder="Describe the outstanding gap or issue…"
              hint="⚠ This project will appear in the Outstanding Gaps tab once saved."
            />
          </div>
        ) : (
          <p className="mt-2 text-[11px] italic text-[#6B7280]">
            No gap flagged — project will not appear in the Outstanding Gaps tab.
          </p>
        )}

        <div className="mt-5 border-t border-[#F3F4F6] pt-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#374151]">
              Management Actions
            </div>
            {projectId ? (
              <span className="text-[11px] text-[#6B7280]">{actions.length} recorded</span>
            ) : (
              <span className="text-[11px] text-[#B45309]">
                Save project first to add actions
              </span>
            )}
          </div>

          {projectId ? (
            <>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-[2fr_1fr_auto]">
                <input
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  placeholder="Describe the action or decision required…"
                  className="h-9 rounded border border-[#D1D5DB] px-3 text-[13px]"
                />
                <input
                  type="date"
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  className="h-9 rounded border border-[#D1D5DB] px-3 text-[13px]"
                />
                <Button size="sm" onClick={handleAdd} disabled={busy || !newTopic.trim()}>
                  + Add Action
                </Button>
              </div>

              {error ? (
                <div className="mt-3 rounded border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-[12.5px] text-[#B91C1C]">
                  {error}
                </div>
              ) : null}

              {actions.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {actions.map((item) => (
                    <li
                      key={item.itemId}
                      className={cn(
                        'grid grid-cols-1 gap-2 rounded border p-3 text-[12.5px] md:grid-cols-[1fr_auto_auto_auto]',
                        item.status === 'Closed'
                          ? 'border-[#86EFAC] bg-[#F0FDF4]'
                          : 'border-[#FCA5A5] bg-[#FEF2F2]',
                      )}
                    >
                      <span className="text-[#111827]">{item.topic}</span>
                      <span className="text-[#6B7280]">
                        {item.deadlineDate ? `due ${item.deadlineDate}` : '—'}
                      </span>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => handleToggle(item)}
                        disabled={busy}
                      >
                        {item.status === 'Open' ? 'Close' : 'Reopen'}
                      </Button>
                      <Button
                        size="xs"
                        variant="destructive"
                        onClick={() => handleDelete(item.itemId)}
                        disabled={busy}
                      >
                        ×
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
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
