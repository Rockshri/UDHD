import { useEffect, useState } from 'react';

export function NavClock(): JSX.Element {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const date = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div className="flex flex-col items-end px-2 text-[#374151]" aria-live="polite">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">{date}</span>
      <span className="text-[11px] font-semibold tabular-nums">{time}</span>
    </div>
  );
}
