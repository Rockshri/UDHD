import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useNavigate } from 'react-router-dom';
import type { StatusDonutRow } from '../../types/api';

const STATUS_COLORS: Record<string, string> = {
  Completed: '#15803D',
  'In Progress': '#1D4ED8',
  Delayed: '#B91C1C',
  'On Hold': '#B45309',
  'Not Started': '#6B7280',
};

interface StatusDonutProps {
  data: StatusDonutRow[];
}

export function StatusDonut({ data }: StatusDonutProps): JSX.Element {
  const navigate = useNavigate();
  const cleaned = data.filter((d) => d.projectCount > 0);
  const total = cleaned.reduce((acc, d) => acc + d.projectCount, 0);

  if (cleaned.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-[#6B7280]">
        No status data yet.
      </div>
    );
  }

  return (
    <div className="relative h-[280px] w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={cleaned}
            dataKey="projectCount"
            nameKey="status"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            onClick={(entry: unknown) => {
              const row = entry as { payload?: StatusDonutRow };
              if (row.payload?.status) {
                navigate(`/projects?status=${encodeURIComponent(row.payload.status)}`);
              }
            }}
            cursor="pointer"
          >
            {cleaned.map((row) => (
              <Cell
                key={row.status}
                fill={STATUS_COLORS[row.status] ?? '#94A3B8'}
                stroke="white"
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: 6,
              border: '1px solid #E5E7EB',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              fontSize: 12,
            }}
            formatter={(value: number, name: string) => [
              `${value} project${value === 1 ? '' : 's'} (${((value / total) * 100).toFixed(1)}%)`,
              name,
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            iconType="circle"
            layout="horizontal"
            verticalAlign="bottom"
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 top-[-20px] flex flex-col items-center justify-center">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">Total</span>
        <span className="text-2xl font-bold tabular-nums text-[#111827]">{total}</span>
      </div>
    </div>
  );
}
