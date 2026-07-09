import { useState } from 'react';
import { useGetLookupsQuery } from '../../app/api/lookupsApi';
import { useListProjectsQuery } from '../../app/api/projectsApi';
import { Button } from '../ui/button';
import { FormField } from '../input-sheet/FormField';
import type { MomStatus, MoM, MoMUpsertPayload } from '../../types/api';

interface Props {
  initial?: MoM | null;
  onCancel: () => void;
  onSubmit: (body: MoMUpsertPayload) => Promise<void>;
  busy: boolean;
}

const STATUSES: MomStatus[] = ['Action Pending', 'In Progress', 'Resolved', 'Deferred'];

export function MoMForm({ initial, onCancel, onSubmit, busy }: Props): JSX.Element {
  const [meetingTitle, setMeetingTitle] = useState(initial?.meetingTitle ?? '');
  const [meetingDate, setMeetingDate] = useState(initial?.meetingDate ?? '');
  const [venue, setVenue] = useState(initial?.venue ?? '');
  const [chairperson, setChairperson] = useState(initial?.chairperson ?? '');
  const [status, setStatus] = useState<MomStatus>(initial?.momStatus ?? 'Action Pending');
  const [projectId, setProjectId] = useState(initial?.projectId ?? '');
  const [attendees, setAttendees] = useState(initial?.attendees ?? '');
  const [agenda, setAgenda] = useState(initial?.agenda ?? '');
  const [decisions, setDecisions] = useState(initial?.decisions ?? '');
  const [remarks, setRemarks] = useState(initial?.remarks ?? '');
  const [error, setError] = useState<string | null>(null);

  const projectsQ = useListProjectsQuery({ limit: 100 });
  useGetLookupsQuery();

  const submit = async (): Promise<void> => {
    setError(null);
    if (!meetingTitle.trim()) {
      setError('Meeting Title is required.');
      return;
    }
    if (!meetingDate) {
      setError('Meeting Date is required.');
      return;
    }
    const body: MoMUpsertPayload = {
      meetingTitle: meetingTitle.trim(),
      meetingDate,
      venue: venue.trim() || null,
      chairperson: chairperson.trim() || null,
      attendees: attendees.trim() || null,
      projectId: projectId || null,
      agenda: agenda.trim() || null,
      decisions: decisions.trim() || null,
      momStatus: status,
      remarks: remarks.trim() || null,
    };
    try {
      await onSubmit(body);
    } catch (err) {
      setError(readError(err));
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <h2 className="text-sm font-bold text-[#111827]">
        {initial ? 'Edit MoM' : 'New Minutes of Meeting'}
      </h2>

      {error ? (
        <div className="rounded border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-[12.5px] text-[#B91C1C]">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <FormField
          label="Meeting Title"
          value={meetingTitle}
          onChange={setMeetingTitle}
          required
        />
        <FormField
          label="Meeting Date"
          type="date"
          value={meetingDate}
          onChange={setMeetingDate}
          required
        />
        <FormField label="Venue" value={venue} onChange={setVenue} />
        <FormField label="Chairperson" value={chairperson} onChange={setChairperson} />
        <FormField
          label="MoM Status"
          type="select"
          value={status}
          onChange={(v) => setStatus(v as MomStatus)}
          options={STATUSES as unknown as string[]}
        />
        <FormField
          label="Linked Project"
          type="select"
          value={projectId}
          onChange={setProjectId}
          options={
            projectsQ.data?.items.map((p) => ({ value: p.projectId, label: p.projectName })) ?? []
          }
        />
      </div>

      <FormField
        label="Attendees (names / designations)"
        type="textarea"
        rows={2}
        value={attendees}
        onChange={setAttendees}
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <FormField label="Agenda" type="textarea" rows={3} value={agenda} onChange={setAgenda} />
        <FormField
          label="Decisions"
          type="textarea"
          rows={3}
          value={decisions}
          onChange={setDecisions}
        />
      </div>

      <FormField
        label="Remarks / Notes"
        type="textarea"
        rows={2}
        value={remarks}
        onChange={setRemarks}
      />

      <div className="flex items-center gap-2 border-t border-[#F3F4F6] pt-3">
        <Button onClick={submit} disabled={busy}>
          {busy ? 'Saving…' : initial ? 'Update MoM' : 'Save MoM'}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
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
