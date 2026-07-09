import { useState } from 'react';
import { useListProjectsQuery } from '../../app/api/projectsApi';
import { PriorityBadge } from '../projects/PriorityBadge';
import { ProgressBar } from '../projects/ProgressBar';
import { ProjectProfileModal } from '../projects/ProjectProfileModal';
import { StatusBadge } from '../projects/StatusBadge';
import { Skeleton } from '../ui/skeleton';
import { cn } from '../../lib/utils';

interface Props {
  /** Only one of these should be set at a time. */
  schemeId?: number;
  sectorId?: number;
  districtId?: number;
  labelOfContext: string;
  onClose: () => void;
}

export function DrillTable({
  schemeId,
  sectorId,
  districtId,
  labelOfContext,
  onClose,
}: Props): JSX.Element {
  const args = {
    limit: 100,
    ...(schemeId ? { schemeId } : {}),
    ...(sectorId ? { sectorId } : {}),
    ...(districtId ? { districtId } : {}),
  };
  const { data, isLoading } = useListProjectsQuery(args);
  const items = data?.items ?? [];
  const [modalProjectId, setModalProjectId] = useState<string | null>(null);

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2">
          <div className="text-[13px] font-bold text-[#111827]">
            {labelOfContext}
            <span className="ml-2 text-[12px] font-normal text-[#6B7280]">
              — {items.length} project{items.length !== 1 ? 's' : ''}
              {data?.nextCursor ? ' (showing first page)' : ''} · click any row to open profile
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[18px] leading-none text-[#9CA3AF] hover:text-[#B91C1C]"
            aria-label="Close drill-in"
          >
            ×
          </button>
        </div>
        {isLoading ? (
          <div className="p-4">
            <Skeleton className="h-40 w-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center text-[12.5px] text-[#6B7280]">
            No projects in this bucket yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] border-collapse text-[12.5px]">
              <thead>
                <tr className="bg-[#F9FAFB] text-[10.5px] font-bold uppercase tracking-wider text-[#6B7280]">
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Project</th>
                  <th className="px-3 py-2 text-left">City</th>
                  <th className="px-3 py-2 text-left">Contractor</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Priority</th>
                  <th className="px-3 py-2 text-left">Physical %</th>
                  <th className="px-3 py-2 text-left">Financial %</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p, idx) => (
                  <tr
                    key={p.projectId}
                    role="button"
                    tabIndex={0}
                    onClick={() => setModalProjectId(p.projectId)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setModalProjectId(p.projectId);
                      }
                    }}
                    className={cn(
                      'cursor-pointer border-b border-[#F3F4F6] hover:bg-[#F0F7FF] focus:bg-[#EFF6FF] focus:outline-none',
                      idx % 2 === 1 && 'bg-[#FAFAFA]',
                    )}
                  >
                    <td className="px-3 py-2 text-[#9CA3AF]">{idx + 1}</td>
                    <td className="px-3 py-2 font-semibold text-[#1D4ED8]">{p.projectName}</td>
                    <td className="px-3 py-2 text-[#374151]">{p.city ?? '—'}</td>
                    <td className="px-3 py-2 text-[#374151]">{p.contractor ?? '—'}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-3 py-2">
                      <PriorityBadge priority={p.priority} />
                    </td>
                    <td className="px-3 py-2">
                      <ProgressBar value={p.effectivePhysicalPct} color="#3B82F6" />
                    </td>
                    <td className="px-3 py-2">
                      <ProgressBar value={p.financialProgressPct} color="#22C55E" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ProjectProfileModal
        projectId={modalProjectId}
        onClose={() => setModalProjectId(null)}
      />
    </>
  );
}
