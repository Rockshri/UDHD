import { Card, CardContent } from '../ui/card';
import { FieldGroup, FormSectionHeader } from './FormSectionHeader';
import { FormField } from './FormField';
import { NumberField } from './NumberField';
import type { ProjectDraft } from '../../hooks/useProjectDraft';

interface Props {
  draft: ProjectDraft;
  setField: <K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) => void;
}

export function ContractSecuritySection({ draft, setField }: Props): JSX.Element {
  const contractValue = draft.contractValueCr ?? 0;
  const paidToDate = draft.totalPaymentsCr ?? 0;
  const balance = contractValue - paidToDate;

  return (
    <Card>
      <CardContent className="pt-4">
        <FormSectionHeader
          num="05"
          title="Contract & Financial Security"
          sub="Agreement, PBG, EMD, payments & retention (all in ₹ Cr)"
        />

        <FieldGroup label="Agreement Details">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <FormField
              label="Agreement Number"
              value={draft.agreementNumber}
              onChange={(v) => setField('agreementNumber', v || null)}
            />
            <FormField
              label="Agreement Date"
              type="date"
              value={draft.agreementDate}
              onChange={(v) => setField('agreementDate', v || null)}
            />
            <FormField
              label="Appointed Date"
              type="date"
              value={draft.appointedDate}
              onChange={(v) => setField('appointedDate', v || null)}
            />
            <NumberField
              label="Contract Value"
              suffix="₹ Cr"
              value={draft.contractValueCr}
              onChange={(v) => setField('contractValueCr', v)}
            />
            <NumberField
              label="Mobilization Advance Issued"
              suffix="₹ Cr"
              value={draft.mobAdvanceIssuedCr}
              onChange={(v) => setField('mobAdvanceIssuedCr', v)}
            />
            <NumberField
              label="Mob. Advance Recovered"
              suffix="₹ Cr"
              value={draft.mobAdvanceRecoveredCr}
              onChange={(v) => setField('mobAdvanceRecoveredCr', v)}
            />
            <NumberField
              label="Advance Outstanding"
              suffix="₹ Cr"
              value={draft.advanceOutstandingCr}
              onChange={(v) => setField('advanceOutstandingCr', v)}
            />
          </div>
        </FieldGroup>

        <FieldGroup label="Performance Bank Guarantee (PBG)">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <FormField
              label="PBG Number"
              value={draft.pbgNumber}
              onChange={(v) => setField('pbgNumber', v || null)}
            />
            <NumberField
              label="PBG Amount"
              suffix="₹ Cr"
              value={draft.pbgAmountCr}
              onChange={(v) => setField('pbgAmountCr', v)}
            />
            <FormField
              label="PBG Expiry Date"
              type="date"
              value={draft.pbgExpiryDate}
              onChange={(v) => setField('pbgExpiryDate', v || null)}
            />
            <FormField
              label="PBG Issuing Bank"
              value={draft.pbgIssuingBank}
              onChange={(v) => setField('pbgIssuingBank', v || null)}
              className="md:col-span-3"
            />
          </div>
        </FieldGroup>

        <FieldGroup label="Earnest Money Deposit (EMD)">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <NumberField
              label="EMD Amount"
              suffix="₹ Cr"
              value={draft.emdAmountCr}
              onChange={(v) => setField('emdAmountCr', v)}
            />
            <FormField
              label="EMD Reference Number"
              value={draft.emdRefNumber}
              onChange={(v) => setField('emdRefNumber', v || null)}
            />
            <FormField
              label="EMD Date"
              type="date"
              value={draft.emdDate}
              onChange={(v) => setField('emdDate', v || null)}
            />
          </div>
        </FieldGroup>

        <FieldGroup label="Payments to Contractor">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <NumberField
              label="Total Payments Made"
              suffix="₹ Cr"
              value={draft.totalPaymentsCr}
              onChange={(v) => setField('totalPaymentsCr', v)}
            />
            <FormField
              label="Last Payment Date"
              type="date"
              value={draft.lastPaymentDate}
              onChange={(v) => setField('lastPaymentDate', v || null)}
            />
            <FormField
              label="Last RA Bill No."
              value={draft.lastRaBillNo}
              onChange={(v) => setField('lastRaBillNo', v || null)}
            />
            <NumberField
              label="Retention Money Held"
              suffix="₹ Cr"
              value={draft.retentionMoneyHeldCr}
              onChange={(v) => setField('retentionMoneyHeldCr', v)}
            />
          </div>
        </FieldGroup>

        {contractValue > 0 ? (
          <div className="mt-1 flex flex-wrap items-center gap-4 rounded border border-[#86EFAC] bg-[#F0FDF4] px-3 py-2 text-[12px]">
            <span>
              📄 Contract Value: <strong>₹ {contractValue.toFixed(2)} Cr</strong>
            </span>
            <span>
              ✅ Paid to date: <strong className="text-[#15803D]">₹ {paidToDate.toFixed(2)} Cr</strong>
            </span>
            <span>
              ⏳ Balance: <strong className="text-[#B45309]">₹ {balance.toFixed(2)} Cr</strong>
            </span>
            <span>
              🔒 PBG: <strong>₹ {(draft.pbgAmountCr ?? 0).toFixed(2)} Cr</strong>
            </span>
            <span>
              🔑 EMD: <strong>₹ {(draft.emdAmountCr ?? 0).toFixed(2)} Cr</strong>
            </span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
