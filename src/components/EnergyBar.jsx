import React from 'react';
import { Zap, AlertTriangle } from 'lucide-react';

export default function EnergyBar({ points, maxPoints = 20 }) {
  const pct = Math.round((points / maxPoints) * 100);
  const low = points <= 5;
  const crit = points <= 2;

  return (
    <div className="flex items-center gap-2">
      <Zap className={`w-4 h-4 ${crit ? 'text-red-400' : low ? 'text-amber-400' : 'text-amber-500'}`} />
      <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${crit ? 'bg-red-400' : low ? 'bg-amber-400' : 'bg-emerald-400'}`}
          style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-sm font-mono font-bold tabular-nums ${crit ? 'text-red-500' : low ? 'text-amber-600' : 'text-slate-700'}`}>
        {points}
      </span>
      {low && <AlertTriangle className={`w-4 h-4 ${crit ? 'text-red-400' : 'text-amber-400'}`} />}
    </div>
  );
}
