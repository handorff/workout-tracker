import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../features/auth/auth-context";
import { supabase } from "../lib/supabase";
import { fetchVisitTimestamps } from "../features/goals/api";
import { addDays, changeGoal, countVisits, dateLabel, localDay, periodFor, periodLabel, readGoal, validWeekly, visitDays, type GymGoal } from "../features/goals/logic";

type Mode = "today" | "history" | "complete";

export function GymGoalCard({ mode = "today", completedAt }: { mode?: Mode; completedAt?: string | null }) {
  const { user } = useAuth();
  const goal = readGoal(user?.user_metadata?.gym_goal);
  if (!user) return null;
  if (!goal) return mode === "today" ? <GoalEditor goal={null} /> : null;
  return <GoalProgress userId={user.id} goal={goal} mode={mode} completedAt={completedAt} />;
}

function GoalEditor({ goal, onClose }: { goal: GymGoal | null; onClose?: () => void }) {
  const [weekly, setWeekly] = useState(String(goal?.changes[goal.changes.length - 1]?.weekly ?? 2.5));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeZone = goal?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = localDay(new Date(), timeZone);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    const value = Number(weekly);
    if (!validWeekly(value)) { setError("Choose 0.5 to 7 visits per week, in steps of 0.5."); return; }
    setSaving(true); setError(null);
    try {
      const next = goal ? changeGoal(goal, today, value) : { startDay: today, timeZone, changes: [{ startDay: today, weekly: value }] };
      const { error: saveError } = await supabase.auth.updateUser({ data: { gym_goal: next } });
      if (saveError) throw saveError;
      onClose?.();
    } catch { setError("Your goal could not be saved. Please try again."); }
    finally { setSaving(false); }
  }
  return <form onSubmit={save} className="card space-y-3 p-5" aria-label="Gym goal settings">
    <h2 className="text-lg font-bold">{goal ? "Edit gym goal" : "Set your gym goal"}</h2>
    <label className="block space-y-2"><span className="text-sm font-semibold">Gym visits per week</span>
      <input className="input" type="number" min="0.5" max="7" step="0.5" required value={weekly} disabled={saving} onChange={(event) => setWeekly(event.target.value)} />
    </label>
    <p className="text-sm text-muted">{goal ? `Changes start ${dateLabel(periodFor(goal, today).end)}.` : "Tracking starts today when you save your goal."}</p>
    {error && <p role="alert" className="text-sm">{error}</p>}
    <div className="flex gap-2"><button className="primary-button h-11" disabled={saving}>{saving ? "Saving…" : "Save goal"}</button>
      {onClose && <button type="button" className="secondary-button h-11" disabled={saving} onClick={onClose}>Cancel</button>}</div>
  </form>;
}

function GoalProgress({ userId, goal, mode, completedAt }: { userId: string; goal: GymGoal; mode: Mode; completedAt?: string | null }) {
  const [editing, setEditing] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(timer); }, []);
  const today = localDay(now, goal.timeZone);
  const day = mode === "complete" && completedAt ? localDay(new Date(completedAt), goal.timeZone) : today;
  const period = periodFor(goal, day);
  const averageStart = addDays(today, -55);
  const oldestPeriod = addDays(period.start, -56);
  const from = [averageStart, oldestPeriod, period.start].sort()[0];
  const query = useQuery({
    queryKey: ["history", userId, "gym-goal", from, today],
    queryFn: () => fetchVisitTimestamps(userId, addDays(from, -1), addDays(today, 2)),
    refetchOnWindowFocus: true,
  });
  if (mode === "complete" && day < goal.startDay) return null;
  if (editing) return <GoalEditor goal={goal} onClose={() => setEditing(false)} />;
  const days = visitDays(query.data ?? [], goal.timeZone);
  const count = countVisits(days, period.start, period.end);
  const remaining = Math.max(0, period.target - count);
  const previous = Array.from({ length: 4 }, (_, index) => periodFor(goal, addDays(period.start, -14 * (index + 1)))).filter((item) => item.start >= goal.startDay);
  return <section className="card space-y-3 p-5" aria-label={mode === "history" ? "Gym consistency" : "Gym goal progress"}>
    <div className="flex items-center justify-between gap-2"><h2 className="text-lg font-bold">{mode === "history" ? "Gym consistency" : "Gym goal"}</h2>
      {mode === "today" && <button className="text-sm underline" onClick={() => setEditing(true)}>Edit goal</button>}</div>
    <p className="text-sm text-muted">{periodLabel(period.start, period.end)}</p>
    {query.isPending ? <p role="status" className="text-sm">Loading goal progress…</p> : query.isError ? <p role="alert" className="text-sm">Goal progress could not be loaded. <button className="underline" onClick={() => query.refetch()}>Try again</button></p> : <>
      <p className="text-2xl font-bold">{count} of {period.target} visits</p>
      <div className="flex gap-1.5" role="progressbar" aria-label="Two-week gym visits" aria-valuemin={0} aria-valuemax={period.target} aria-valuenow={Math.min(count, period.target)} aria-valuetext={`${count} of ${period.target} visits`}>
        {Array.from({ length: period.target }, (_, index) => <span key={index} className={`h-3 min-w-0 flex-1 rounded-xs border border-line ${index < count ? "bg-accent" : "bg-transparent"}`} />)}
      </div>
      {mode === "complete" && <p className="text-sm font-semibold">{remaining === 0 ? "Nice job! You’ve completed your goal!" : `Nice job! Visit ${remaining} more ${remaining === 1 ? "time" : "times"} by ${new Date(`${addDays(period.end, -1)}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" })} to complete your goal.`}</p>}
      {mode === "history" && <div className="space-y-3 border-t border-line pt-3">
        <div><p className="font-semibold">{(countVisits(days, averageStart, addDays(today, 1)) / 8).toFixed(1)} visits/week over the last 56 days</p>
          <p className="text-sm text-muted">{periodLabel(averageStart, addDays(today, 1))}. Includes visits before goal tracking began.</p></div>
        <h3 className="section-label">Previous two-week periods</h3>
        {previous.length ? previous.map((item) => { const visits = countVisits(days, item.start, item.end); return <div key={item.start} className="text-sm"><p>{periodLabel(item.start, item.end)}</p><p className="font-semibold">{visits} of {item.target} visits · {visits >= item.target ? "Goal met" : "Below goal"}</p></div>; }) : <p className="text-sm text-muted">Your first period is underway. Completed periods will appear here.</p>}
      </div>}
    </>}
  </section>;
}
