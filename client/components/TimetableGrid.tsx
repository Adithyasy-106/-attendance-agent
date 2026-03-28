"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, LayoutDashboard, Clock, CalendarDays, ArrowRight } from "lucide-react";

type GridData = {
  [day: string]: string[];
};

type Props = {
  initialData: GridData;
  onConfirm: (data: GridData) => void;
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIME_SLOTS = ["08-09", "09-10", "10:20-11:20", "11:20-12:20", "01-02", "02-03", "03-04"];

const SUBJECTS = [
  "Advanced Java",
  "Cloud Computing",
  "Cloud Lab",
  "Devops Lab",
  "Machine Learning",
  "ML",
  "ML Lab",
  "CC",
  "OE",
  "PE",
  "PTR",
  "Technical Training",
  "Placement Training",
  "Renewable Energy",
  "TYL-Aptitude",
  "TYL-Logical",
  "TYL-SoftSkill",
  "Yoga/Sports",
  "Club Activity",
  "Project Phase-1",
  "Mentoring",
  "Library",
  "Free / Break"
];

export default function TimetableGrid({ initialData, onConfirm }: Props) {
  const [data, setData] = useState<GridData>(initialData);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const updateCell = (day: string, index: number, value: string) => {
    const newData = { ...data };
    newData[day] = [...newData[day]];
    newData[day][index] = value;
    setData(newData);
  };

  return (
    <div className="space-y-6">
      {/* Grid Header */}
      <div className="flex flex-col gap-3 rounded-2xl border border-indigo-500/15 bg-indigo-500/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="h-5 w-5 shrink-0 text-indigo-400" />
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-white">Timetable review</h3>
            <p className="text-[11px] text-zinc-500">Edit cells to match your grid, then confirm.</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-[10px] font-bold uppercase tracking-tighter text-zinc-400">
          <div className="flex items-center gap-1.5"><CalendarDays className="w-3 h-3" /> Mon - Sat</div>
          <div className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> 08:00 - 16:00</div>
        </div>
      </div>

      {/* Scrollable Grid */}
      <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-zinc-950/40 p-3 sm:p-4">
        <table className="w-full border-collapse min-w-[750px]">
          <thead>
            <tr>
              <th className="text-left p-2 text-[10px] font-black text-zinc-600 uppercase tracking-widest w-[80px]">Day</th>
              {TIME_SLOTS.map(slot => (
                <th key={slot} className="p-2 text-center text-[9px] font-extrabold text-zinc-500 uppercase tracking-wider border-b border-white/10 pb-3">
                  {slot}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day) => (
              <tr key={day} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                <td className="p-2 text-[10px] font-black text-zinc-500 uppercase tracking-wider whitespace-nowrap">{day.slice(0, 3)}</td>
                {(data[day] || Array(7).fill("Free / Break")).slice(0, 7).map((subject, i) => (
                  <td key={`${day}-${i}`} className="p-1">
                    <select
                      value={subject}
                      onChange={(e) => updateCell(day, i, e.target.value)}
                      title={`${day} · slot ${i + 1}`}
                      className={`ui-input ui-input-sm w-full cursor-pointer text-center font-semibold shadow-none focus:shadow-none ${
                        subject === "Free / Break"
                          ? "border-zinc-700/40 bg-zinc-900/90 italic text-zinc-500"
                          : "border-indigo-500/30 bg-indigo-500/10 text-indigo-100"
                      }`}
                    >
                      {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                      {!SUBJECTS.includes(subject) && <option value={subject}>{subject}</option>}
                    </select>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Submit Button - Always Visible */}
      <div className="flex flex-row flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-[11px] text-zinc-500">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
          <span>When it matches your timetable, finish setup.</span>
        </div>
        <button
          type="button"
          onClick={() => onConfirm(data)}
          className="ui-btn-primary group !w-auto shrink-0 px-6 py-3 text-sm sm:px-8"
        >
          Finish & open chat <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}
