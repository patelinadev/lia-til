import Link from "next/link";
import { DAYS, PYTHON_ESSENTIALS, TALK_FLOW } from "./data";
import PlanCalendar from "./PlanCalendar";

export const metadata = {
  title: "Google Round 1 Plan · LeetCode · Lia's Learning Progress",
};

const CARD =
  "rounded-xl border border-neutral-200 dark:border-neutral-800";
const TAG = "inline-block rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap";
const MOCK_TAG = `${TAG} bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300`;
const BUFFER_TAG = `${TAG} bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300`;

export default function GooglePlanPage() {
  const problemCount = DAYS.reduce((n, d) => n + (d.problems?.length ?? 0), 0);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 sm:py-16">
      <Link
        href="/leetcode"
        className="text-sm text-neutral-500 transition-colors hover:text-neutral-800 dark:hover:text-neutral-300"
      >
        &larr; LeetCode
      </Link>

      <div className="mt-6 mb-2 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-3xl font-bold sm:text-4xl">Google Round 1 Plan</h1>
        <p className="text-sm text-neutral-500">14 days · {problemCount} core problems</p>
      </div>
      <p className="mb-6 text-sm text-neutral-500">
        Python · mentor mock every 3 days · Hack2Hire Google question bank
      </p>

      <p className="rounded-lg border-l-4 border-blue-500 bg-blue-50 px-4 py-3 text-sm dark:bg-blue-950/40">
        <b>Goal:</b> solve one Google medium problem in Python within 45 minutes while explaining
        your thinking out loud. For new-grad and junior roles (L3), Round 1 is usually coding only, so
        system design gets a small daily slot.
      </p>

      <h2 className="mt-10 mb-3 text-xl font-semibold">Schedule</h2>
      <p className="mb-4 flex flex-wrap gap-2 text-sm">
        <span className={MOCK_TAG}>Mentor mock</span>
        <span className={BUFFER_TAG}>Buffer / review</span>
        <span className="text-neutral-500">Pick a day to see its plan. Problem numbers link to LeetCode.</span>
      </p>
      <PlanCalendar />

      <h2 className="mt-10 mb-3 text-xl font-semibold">Day 1 Python list</h2>
      <ul className="flex flex-col gap-2 text-sm">
        {PYTHON_ESSENTIALS.map((p) => (
          <li key={p.code}>
            <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[13px] dark:bg-neutral-900">
              {p.code}
            </code>
            {p.note && <span className="text-neutral-500"> — {p.note}</span>}
          </li>
        ))}
      </ul>

      <h2 className="mt-10 mb-3 text-xl font-semibold">How to talk through every problem</h2>
      <ol className="flex flex-wrap items-center gap-1.5 text-sm">
        {TALK_FLOW.map((step, i) => (
          <li key={step} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-neutral-400">&rarr;</span>}
            <span className={`${CARD} px-2.5 py-1`}>{step}</span>
          </li>
        ))}
      </ol>

      <h2 className="mt-10 mb-3 text-xl font-semibold">Mentor mocks</h2>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>
          Ask for <b>a Hack2Hire Google question you haven&rsquo;t seen</b>, in a plain Google Doc,
          with no code running.
        </li>
        <li>Ask for one score per area: algorithm · code quality · communication · testing.</li>
        <li>Spend the next morning&rsquo;s first 2 hours on the lowest score.</li>
      </ul>

      <p className={`${CARD} mt-10 px-4 py-3 text-sm`}>
        <b>Target:</b> about 100–120 problems total. One problem you understand deeply beats three
        you looked up.
      </p>
    </main>
  );
}
