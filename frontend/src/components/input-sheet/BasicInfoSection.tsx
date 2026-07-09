import { useGetLookupsQuery } from '../../app/api/lookupsApi';
import { Card, CardContent } from '../ui/card';
import { FormField } from './FormField';
import { FormSectionHeader } from './FormSectionHeader';
import { MultiSelectField } from './MultiSelectField';
import type { ProjectDraft } from '../../hooks/useProjectDraft';
import type { ProjectStage, WorkType } from '../../types/api';

interface Props {
  draft: ProjectDraft;
  setField: <K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) => void;
}

const STAGES = ['Conceptualization', 'Pre-Tender', 'Tender', 'Construction', 'O&M'] as const;
const WORK_TYPES = ['Tender Work', 'Tender Service', 'Pre-Monsoon', 'Construction', 'Others'] as const;

export function BasicInfoSection({ draft, setField }: Props): JSX.Element {
  const { data: lookups } = useGetLookupsQuery();
  const sectors = lookups?.sectors ?? [];
  const districts = lookups?.districts ?? [];
  const schemes = lookups?.schemes ?? [];

  return (
    <Card>
      <CardContent className="pt-4">
        <FormSectionHeader num="01" title="Basic Info" sub="Core project identification details" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <FormField
            label="Project Name"
            value={draft.projectName}
            onChange={(v) => setField('projectName', v)}
            required
          />
          <FormField
            label="Sector"
            type="select"
            value={draft.sectorId === null ? '' : String(draft.sectorId)}
            onChange={(v) => setField('sectorId', v ? Number(v) : null)}
            options={sectors.map((s) => ({ value: String(s.sectorId), label: s.sectorName }))}
          />
          <FormField
            label="City"
            value={draft.city}
            onChange={(v) => setField('city', v || null)}
          />
          <FormField
            label="District"
            type="select"
            value={draft.districtId === null ? '' : String(draft.districtId)}
            onChange={(v) => setField('districtId', v ? Number(v) : null)}
            options={districts.map((d) => ({ value: String(d.districtId), label: d.districtName }))}
          />
          <FormField
            label="Contractor"
            value={draft.contractor}
            onChange={(v) => setField('contractor', v || null)}
          />
          <FormField
            label="PD"
            value={draft.pd}
            onChange={(v) => setField('pd', v || null)}
          />
          <MultiSelectField
            label="Scheme(s)"
            value={draft.schemes}
            onChange={(v) => setField('schemes', v)}
            options={schemes.map((s) => ({ value: s.schemeId, label: s.schemeName }))}
            placeholder="+ Add scheme"
            className="md:col-span-2"
          />
          <FormField
            label="Main Work"
            value={draft.mainWork}
            onChange={(v) => setField('mainWork', v || null)}
          />
          <FormField
            label="Physical Work Progress (free text)"
            value={draft.physicalWorkProgressNote}
            onChange={(v) => setField('physicalWorkProgressNote', v || null)}
            hint="Descriptive note. Use Section 03 for numeric %."
            className="md:col-span-2"
          />
          <FormField
            label="Project Stage"
            type="select"
            value={draft.projectStage ?? ''}
            onChange={(v) => setField('projectStage', (v as ProjectStage) || null)}
            options={STAGES as unknown as string[]}
          />
          <FormField
            label="Work Type"
            type="select"
            value={draft.workType ?? ''}
            onChange={(v) => setField('workType', (v as WorkType) || null)}
            options={WORK_TYPES as unknown as string[]}
          />
          <FormField
            label="Sponsoring Department"
            value={draft.sponsoringDept}
            onChange={(v) => setField('sponsoringDept', v || null)}
          />
          <FormField
            label="Implementing Agency"
            value={draft.implementingAgency}
            onChange={(v) => setField('implementingAgency', v || null)}
          />
          <FormField
            label="Project Sanction Date"
            type="date"
            value={draft.sanctionDate}
            onChange={(v) => setField('sanctionDate', v || null)}
          />
        </div>
        <div className="mt-3">
          <FormField
            label="Project Brief"
            type="textarea"
            rows={3}
            value={draft.projectBrief}
            onChange={(v) => setField('projectBrief', v || null)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
