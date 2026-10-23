import { useId, useState, type FormEvent } from "react";
import { todayDate, validateActivity, type OutsideActivity } from "../features/activities/api";
import { useDeleteOutsideActivity, useSaveOutsideActivity } from "../features/activities/hooks";

export function OutsideActivityForm({ userId, initial, onDone, onCancel }: {
  userId: string; initial?: OutsideActivity; onDone: () => void; onCancel: () => void;
}) {
  const prefix = useId();
  const presets = ["Walking", "Biking"];
  const [kind, setKind] = useState(initial && !presets.includes(initial.activity) ? "Other" : initial?.activity ?? "Walking");
  const [custom, setCustom] = useState(initial?.activity ?? "");
  const [date, setDate] = useState(initial?.activity_date ?? todayDate());
  const [miles, setMiles] = useState(initial?.distance_miles.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const save = useSaveOutsideActivity(userId);
  const remove = useDeleteOutsideActivity(userId);
  async function handleRemove() {
    if (!initial || save.isPending || remove.isPending) return;
    if (!window.confirm("Remove this outside activity permanently? This cannot be undone.")) return;
    setError(null);
    try {
      await remove.mutateAsync(initial.id);
      onCancel();
    } catch {
      setError("That activity could not be removed. Try again.");
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const values = { activity: kind === "Other" ? custom : kind, activity_date: date,
      distance_miles: Number(miles) };
    try { validateActivity(values); }
    catch (validationError) { setError((validationError as Error).message); return; }
    try {
      await save.mutateAsync({ id: initial?.id, values });
      onDone();
    } catch {
      setError("Activity could not be saved. Check your connection and try again.");
    }
  }
  return <form className="space-y-4" onSubmit={submit}>
    <fieldset className="space-y-4" disabled={save.isPending || remove.isPending}>
      <div className="space-y-2"><label htmlFor={`${prefix}-kind`} className="block text-sm font-semibold">Activity</label>
        <select id={`${prefix}-kind`} className="input" value={kind} onChange={event => setKind(event.target.value)}>
          {[...presets, "Other"].map(value => <option key={value}>{value}</option>)}
        </select></div>
      {kind === "Other" && <div className="space-y-2"><label htmlFor={`${prefix}-name`} className="block text-sm font-semibold">Activity name</label>
        <input id={`${prefix}-name`} className="input" required maxLength={100} pattern=".*\S.*" value={custom} onChange={event => setCustom(event.target.value)} /></div>}
      <div className="space-y-2"><label htmlFor={`${prefix}-date`} className="block text-sm font-semibold">Date</label>
        <input id={`${prefix}-date`} className="input" type="date" required max={todayDate()} value={date} onChange={event => setDate(event.target.value)} /></div>
      <div className="space-y-2"><label htmlFor={`${prefix}-miles`} className="block text-sm font-semibold">Distance (miles)</label>
        <input id={`${prefix}-miles`} className="input" type="number" inputMode="decimal" min="0.01" max="9999.99" step="0.01" required value={miles} onChange={event => setMiles(event.target.value)} /></div>
      <div className="flex gap-3"><button className="primary-button flex-1" type="submit">{save.isPending ? "Saving..." : "Save activity"}</button>
        <button className="secondary-button" type="button" onClick={onCancel}>Cancel</button></div>
      {initial && <div className="border-t border-line pt-4">
        <button type="button" className="min-h-11 text-sm font-semibold underline disabled:opacity-50" onClick={handleRemove}>
          {remove.isPending ? "Removing..." : "Remove activity"}
        </button>
      </div>}
    </fieldset>
    {error && <p role="alert" className="text-sm">{error}</p>}
  </form>;
}
