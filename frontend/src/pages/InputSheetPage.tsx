import { useEffect, useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { useListCosEotForProjectQuery } from '../app/api/cosEotApi';
import { useListGeoPhotosQuery } from '../app/api/geoPhotosApi';
import { useListMgmtActionsForProjectQuery } from '../app/api/mgmtActionsApi';
import {
  useCreateProjectMutation,
  useGetProjectQuery,
  useUpdateProjectMutation,
} from '../app/api/projectsApi';
import { RoleGate } from '../components/auth/RoleGate';
import { ActionRemarksSection } from '../components/input-sheet/ActionRemarksSection';
import { BasicInfoSection } from '../components/input-sheet/BasicInfoSection';
import { ContractSecuritySection } from '../components/input-sheet/ContractSecuritySection';
import { CosEotSection } from '../components/input-sheet/CosEotSection';
import { GeoTaggingSection } from '../components/input-sheet/GeoTaggingSection';
import { MilestonesSection } from '../components/input-sheet/MilestonesSection';
import { OmDetailsSection } from '../components/input-sheet/OmDetailsSection';
import { PhaseDatesSection } from '../components/input-sheet/PhaseDatesSection';
import { ProgressFinancialSection } from '../components/input-sheet/ProgressFinancialSection';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { cn } from '../lib/utils';
import { draftToPayload, useProjectDraft } from '../hooks/useProjectDraft';

type SectionId =
  | 'basic'
  | 'phase'
  | 'progress'
  | 'cos'
  | 'contract'
  | 'geo'
  | 'action'
  | 'om'
  | 'milestones';

const SECTIONS: Array<{ id: SectionId; label: string }> = [
  { id: 'basic', label: '01 Basic Info' },
  { id: 'phase', label: '02 Phase & Dates' },
  { id: 'progress', label: '03 Progress & Financial' },
  { id: 'cos', label: '04 CoS / EoT' },
  { id: 'contract', label: '05 Contract & Security' },
  { id: 'geo', label: '06 GeoTagging' },
  { id: 'action', label: '07 Action & Remarks' },
  { id: 'om', label: '08 O&M Details' },
  { id: 'milestones', label: '09 Milestones & Progress' },
];

export function InputSheetPage(): JSX.Element {
  const { projectId } = useParams<{ projectId: string }>();
  const isEdit = Boolean(projectId);
  const navigate = useNavigate();

  const detail = useGetProjectQuery(projectId ?? '', { skip: !isEdit });
  const cosEot = useListCosEotForProjectQuery(projectId ?? '', { skip: !isEdit });
  const mgmt = useListMgmtActionsForProjectQuery(projectId ?? '', { skip: !isEdit });
  const photos = useListGeoPhotosQuery(projectId ?? '', { skip: !isEdit });

  const { draft, setField, isDirty } = useProjectDraft(detail.data ?? null);
  const [createProject, createState] = useCreateProjectMutation();
  const [updateProject, updateState] = useUpdateProjectMutation();

  const [section, setSection] = useState<SectionId>('basic');
  const [flash, setFlash] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 3500);
    return () => clearTimeout(t);
  }, [flash]);

  const busy = createState.isLoading || updateState.isLoading;

  const handleSave = async (): Promise<void> => {
    if (!draft.projectName.trim()) {
      setFlash({ text: 'Project Name is required.', kind: 'err' });
      setSection('basic');
      return;
    }
    try {
      const payload = draftToPayload(draft);
      if (isEdit && projectId) {
        await updateProject({ projectId, body: payload }).unwrap();
        setFlash({ text: 'Project updated.', kind: 'ok' });
      } else {
        const created = await createProject(payload).unwrap();
        setFlash({ text: 'Project created — switching to edit mode.', kind: 'ok' });
        navigate(`/input-sheet/${created.projectId}`, { replace: true });
      }
    } catch (err) {
      setFlash({ text: readError(err), kind: 'err' });
    }
  };

  if (isEdit && detail.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isEdit && (detail.error || !detail.data)) {
    const status =
      typeof detail.error === 'object' && detail.error && 'status' in detail.error
        ? (detail.error as { status?: number }).status
        : undefined;
    return (
      <div className="rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] p-4 text-sm">
        <p className="font-semibold text-[#B91C1C]">
          {status === 404 ? 'This project does not exist.' : 'Could not load project.'}
        </p>
        <NavLink to="/projects" className="mt-2 inline-block text-[#1D4ED8] hover:underline">
          ← Back to all projects
        </NavLink>
      </div>
    );
  }

  return (
    <RoleGate
      allow={['Admin', 'MD']}
      fallback={
        <div className="rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] p-4 text-sm">
          <p className="font-semibold text-[#B91C1C]">
            You don't have permission to edit projects.
          </p>
          <p className="mt-1 text-[#6B7280]">Viewer role is read-only for the Input Sheet.</p>
          <NavLink to="/projects" className="mt-2 inline-block text-[#1D4ED8] hover:underline">
            ← Back to all projects
          </NavLink>
        </div>
      }
    >
      <article className="space-y-4">
        <header className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                <NavLink to="/projects" className="text-[#1D4ED8] hover:underline">
                  ← All projects
                </NavLink>
                {isEdit && projectId ? (
                  <NavLink
                    to={`/projects/${projectId}`}
                    className="ml-3 text-[#1D4ED8] hover:underline"
                  >
                    View detail →
                  </NavLink>
                ) : null}
              </p>
              <h1 className="text-xl font-bold tracking-tight text-[#111827]">
                {isEdit ? draft.projectName || '(Untitled)' : 'Add New Project'}
              </h1>
              <p className="text-[12px] text-[#6B7280]">
                Only Project Name is required.{' '}
                {isDirty ? (
                  <span className="ml-1 font-bold text-[#B45309]">Unsaved changes</span>
                ) : null}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleSave} disabled={busy}>
                {busy ? 'Saving…' : isEdit ? '✓ Save Changes' : '✓ Create Project'}
              </Button>
            </div>
          </div>
          {flash ? (
            <div
              className={cn(
                'mt-3 rounded border px-3 py-2 text-[12.5px]',
                flash.kind === 'ok'
                  ? 'border-[#86EFAC] bg-[#F0FDF4] text-[#15803D]'
                  : 'border-[#FCA5A5] bg-[#FEF2F2] text-[#B91C1C]',
              )}
            >
              {flash.text}
            </div>
          ) : null}
        </header>

        <nav
          role="tablist"
          aria-label="Input sheet sections"
          className="flex flex-wrap gap-0.5 border-b-2 border-[#E5E7EB]"
        >
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={section === s.id}
              onClick={() => setSection(s.id)}
              className={cn(
                '-mb-0.5 whitespace-nowrap border-b-2 px-3 py-2 text-[11.5px] font-semibold transition-colors',
                section === s.id
                  ? 'border-[#1E3A5F] text-[#1E3A5F]'
                  : 'border-transparent text-[#6B7280] hover:text-[#374151]',
              )}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <div>
          {section === 'basic' ? <BasicInfoSection draft={draft} setField={setField} /> : null}
          {section === 'phase' ? (
            <PhaseDatesSection
              draft={draft}
              setField={setField}
              cosItems={cosEot.data?.items ?? []}
            />
          ) : null}
          {section === 'progress' ? (
            <ProgressFinancialSection
              draft={draft}
              setField={setField}
              cosItems={cosEot.data?.items ?? []}
            />
          ) : null}
          {section === 'cos' ? (
            <CosEotSection projectId={projectId ?? null} items={cosEot.data?.items ?? []} />
          ) : null}
          {section === 'contract' ? (
            <ContractSecuritySection draft={draft} setField={setField} />
          ) : null}
          {section === 'geo' ? (
            <GeoTaggingSection
              projectId={projectId ?? null}
              draft={draft}
              setField={setField}
              photos={photos.data?.items ?? []}
            />
          ) : null}
          {section === 'action' ? (
            <ActionRemarksSection
              projectId={projectId ?? null}
              draft={draft}
              setField={setField}
              actions={mgmt.data?.items ?? []}
            />
          ) : null}
          {section === 'om' ? <OmDetailsSection draft={draft} setField={setField} /> : null}
          {section === 'milestones' ? <MilestonesSection projectId={projectId ?? null} /> : null}
        </div>

        <footer className="flex flex-wrap items-center gap-2 border-t border-[#E5E7EB] pt-3">
          <Button onClick={handleSave} disabled={busy}>
            {busy ? 'Saving…' : isEdit ? '✓ Save Changes' : '✓ Create Project'}
          </Button>
          {isEdit && projectId ? (
            <NavLink
              to={`/projects/${projectId}`}
              className="text-[13px] text-[#1D4ED8] hover:underline"
            >
              Cancel & return to detail
            </NavLink>
          ) : (
            <NavLink to="/projects" className="text-[13px] text-[#1D4ED8] hover:underline">
              Cancel
            </NavLink>
          )}
        </footer>
      </article>
    </RoleGate>
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
