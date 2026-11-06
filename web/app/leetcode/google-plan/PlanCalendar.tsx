"use client";

import { useState } from "react";
import { DAYS, START_DATE, type PlanDay } from "./data";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const TAG = "inline-block rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap";
const MOCK_TAG = `${TAG} bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300`;
const BUFFER_TAG = `${TAG} bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300`;

/** Calendar date of plan day `n` (1-based). Built in UTC so the grid never
 *  shifts by a day with the viewer's time zone. */
function dateOf(n: number): Date {
  const [y, m, d] = START_DATE.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n - 1));
}

const fmt = (dt: Date) => `${MONTHS[dt.getUTCMonth()]} ${dt.getUTCDate()}`;
const weekdayName = (dt: Date) => WEEKDAYS[(dt.getUTCDay() + 6) % 7];

/** One timeline row: a dot on a vertical line, then the content. */
function Step({ dot, children }: { dot: string; children: React.ReactNode }) {
  return (
    <li className="relative pb-4 pl-6 last:pb-0">
      <span className={`absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white dark:ring-neutral-950 ${dot}`} />
      {children}
    </li>
  );
}

function DayDetail({ d }: { d: PlanDay }) {
  const dt = dateOf(d.day);
  return (
    <section
      className={`rounded-xl border p-5 ${
        d.mock
          ? "border-red-300 bg-red-50/40 dark:border-red-900 dark:bg-red-950/20"
          : "border-neutral-200 dark:border-neutral-800"
      }`}
    >
      <p className="font-mono text-sm text-neutral-500">
        Day {d.day} · {weekdayName(dt)}, {fmt(dt)}
      </p>
      <div className="mt-1 mb-5 flex flex-wrap items-baseline gap-2">
        <h3 className="text-lg font-semibold">{d.topic}</h3>
        {d.mock && <span className={MOCK_TAG}>Mock #{d.mock}</span>}
        {d.buffer && <span className={BUFFER_TAG}>Buffer</span>}
      </div>

      {/* the vertical line runs behind the dots */}
      <ol className="relative ml-1 before:absolute before:left-[4px] before:top-2 before:bottom-2 before:w-px before:bg-neutral-300 dark:before:bg-neutral-700">
        {d.problems?.map((p) => (
          <Step key={p.num} dot="bg-blue-500">
            <a
              href={`https://leetcode.com/problemset/?search=${p.num}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-baseline gap-2 text-sm"
            >
              <span className="w-12 font-mono text-xs text-neutral-500">#{p.num}</span>
              <span className="group-hover:underline">{p.title}</span>
            </a>
          </Step>
        ))}
        {d.note && (
          <Step dot="bg-emerald-500">
            <p className="text-sm text-neutral-700 dark:text-neutral-300">{d.note}</p>
          </Step>
        )}
        {d.problems && (
          <Step dot="bg-neutral-400">
            <p className="text-sm text-neutral-500">
              Then 3–4 Hack2Hire Google-tagged problems on this topic, 35 min each, out loud.
            </p>
          </Step>
        )}
        {d.mock && (
          <Step dot="bg-red-500">
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">
              Mentor mock #{d.mock}: a Hack2Hire Google question you haven&rsquo;t seen, 45 min,
              plain Google Doc
            </p>
          </Step>
        )}
      </ol>
    </section>
  );
}

export default function PlanCalendar() {
  const [selected, setSelected] = useState(1);

  // Leading blanks so Day 1 lands in its real weekday column (Mon-first).
  const lead = (dateOf(1).getUTCDay() + 6) % 7;
  const current = DAYS.find((d) => d.day === selected) ?? DAYS[0];

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
        <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-neutral-500">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-1">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: lead }, (_, i) => (
            <div key={`blank-${i}`} />
          ))}
          {DAYS.map((d) => {
            const dt = dateOf(d.day);
            const isSel = d.day === selected;
            const tone = d.mock
              ? "border-red-400 bg-red-50 dark:border-red-800 dark:bg-red-950/50"
              : d.buffer
                ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30"
                : "border-neutral-200 dark:border-neutral-800";
            return (
              <button
                key={d.day}
                type="button"
                onClick={() => setSelected(d.day)}
                aria-pressed={isSel}
                aria-label={`Day ${d.day}, ${fmt(dt)}: ${d.topic}${d.mock ? `, mock ${d.mock}` : ""}`}
                className={`flex min-h-16 flex-col items-start rounded-lg border p-1.5 text-left transition-colors hover:border-neutral-500 sm:min-h-20 sm:p-2 ${tone} ${
                  isSel ? "ring-2 ring-blue-500 ring-offset-1 ring-offset-white dark:ring-offset-neutral-950" : ""
                }`}
              >
                <span className="font-mono text-[11px] text-neutral-500">{fmt(dt)}</span>
                <span className="text-sm font-semibold">Day {d.day}</span>
                {d.mock ? (
                  <span className="mt-auto text-[10px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400">
                    Mock #{d.mock}
                  </span>
                ) : d.problems ? (
                  <span className="mt-auto text-[10px] text-neutral-500">{d.problems.length} problems</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <DayDetail d={current} />
    </div>
  );
}
