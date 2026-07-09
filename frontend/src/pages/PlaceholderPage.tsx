import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

interface PlaceholderPageProps {
  title: string;
  subBatch: string;
}

/**
 * Shared placeholder for pages arriving in later Phase-6 sub-batches.
 * Kept intentionally spare — the goal is to prove routing + nav works.
 */
export function PlaceholderPage({ title, subBatch }: PlaceholderPageProps): JSX.Element {
  return (
    <div className="mx-auto max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[#6B7280]">
            This view arrives in Phase 6 · sub-batch {subBatch}. Routing + auth gating are already
            wired; content lands in that sub-batch.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
