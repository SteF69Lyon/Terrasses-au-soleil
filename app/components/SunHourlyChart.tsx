import React, { useEffect, useMemo, useState } from 'react';
import { computeSunPercent, fetchHourlyCloudCover } from '../lib/liveSun';

interface Props {
  lat: number;
  lng: number;
  facing?: number;
}

const START_HOUR = 9;
const END_HOUR = 21;

const SunHourlyChart: React.FC<Props> = ({ lat, lng, facing = 180 }) => {
  const [hourlyCloud, setHourlyCloud] = useState<number[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchHourlyCloudCover(lat, lng, new Date()).then((data) => {
      if (!cancelled) setHourlyCloud(data);
    });
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  const bars = useMemo(() => {
    if (!hourlyCloud) return null;
    const now = new Date();
    const nowHour = now.getHours();
    const result: { hour: number; sun: number; isNow: boolean }[] = [];
    for (let h = START_HOUR; h <= END_HOUR; h++) {
      const localDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, 0, 0);
      const utcHour = localDate.getUTCHours();
      const cloud = (hourlyCloud[utcHour] ?? 0) / 100;
      const { sunPercent } = computeSunPercent(lat, lng, localDate, facing, cloud);
      result.push({ hour: h, sun: sunPercent, isNow: h === nowHour });
    }
    return result;
  }, [hourlyCloud, lat, lng, facing]);

  if (!bars) return null;
  const maxSun = Math.max(1, ...bars.map((b) => b.sun));

  return (
    <div className="mt-3 bg-orange-50 border border-orange-100 rounded-xl p-2">
      <div className="text-[10px] text-slate-500 font-semibold mb-1 uppercase tracking-wider">
        Prévision soleil aujourd'hui
      </div>
      <div className="flex items-end gap-[2px] h-14">
        {bars.map((b) => {
          const heightPct = Math.round((b.sun / maxSun) * 100);
          const color =
            b.sun >= 65 ? 'bg-orange-500' : b.sun >= 25 ? 'bg-orange-300' : 'bg-slate-300';
          return (
            <div
              key={b.hour}
              className={`flex-1 flex flex-col items-center justify-end h-full ${b.isNow ? 'relative' : ''}`}
              title={`${b.hour}h : ${b.sun}% soleil`}
            >
              {b.isNow && (
                <div className="absolute inset-x-0 top-0 bottom-0 bg-orange-100/50 rounded-sm pointer-events-none" />
              )}
              <div
                className={`w-full ${color} rounded-sm transition-all`}
                style={{ height: `${Math.max(heightPct, 3)}%` }}
              />
              <div className={`text-[9px] mt-0.5 ${b.isNow ? 'font-bold text-orange-600' : 'text-slate-400'}`}>
                {b.hour}h
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SunHourlyChart;
