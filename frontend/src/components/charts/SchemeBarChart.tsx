import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useNavigate } from 'react-router-dom';
import type { SchemeChartRow } from '../../types/api';

interface SchemeBarChartProps {
  data: SchemeChartRow[];
}

export function SchemeBarChart({ data }: SchemeBarChartProps): JSX.Element {
  const navigate = useNavigate();
  const withData = data.filter((d) => d.projectCount > 0);

  if (withData.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-[#6B7280]">
        No scheme data yet.
      </div>
    );
  }

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer>
        <BarChart
          data={withData}
          layout="vertical"
          margin={{ top: 8, right: 24, left: 12, bottom: 8 }}
          onClick={(e) => {
            const label = (e as { activeLabel?: string }).activeLabel;
            if (label) {
              const scheme = withData.find((d) => d.schemeName === label);
              if (scheme) navigate(`/projects?schemeId=${scheme.schemeId}`);
            }
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: '#6B7280' }}
            unit="%"
          />
          <YAxis
            type="category"
            dataKey="schemeName"
            tick={{ fontSize: 11, fill: '#374151' }}
            width={140}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 6,
              border: '1px solid #E5E7EB',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              fontSize: 12,
            }}
            formatter={(value: number) => `${value.toFixed(1)}%`}
            cursor={{ fill: 'rgba(30, 58, 95, 0.05)' }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar
            dataKey="avgPhysicalPct"
            name="Physical %"
            fill="#1E3A5F"
            radius={[0, 4, 4, 0]}
            cursor="pointer"
          />
          <Bar
            dataKey="avgFinancialPct"
            name="Financial %"
            fill="#1D4ED8"
            radius={[0, 4, 4, 0]}
            cursor="pointer"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
