import { useState } from "react";

export function CardioEntry({ initialSeconds, onSave }: {
  initialSeconds: number | null;
  onSave: (seconds: number) => Promise<void>;
}) {
  const [minutes, setMinutes] = useState(initialSeconds ? String(initialSeconds / 60) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="card space-y-4 p-5" onSubmit={async (event) => {
      event.preventDefault();
      const value = Number(minutes);
      if (!Number.isFinite(value) || value <= 0 || !Number.isSafeInteger(Math.round(value * 60)) || value * 60 > 2147483647) {
        setError("Enter a valid duration greater than zero minutes.");
        return;
      }
      setSaving(true);
      setError(null);
      try { await onSave(Math.round(value * 60)); }
      catch { setError("Your activity could not be saved. Please try again."); }
      finally { setSaving(false); }
    }}>
      <label className="section-label block" htmlFor="cardio-minutes">Minutes</label>
      <input id="cardio-minutes" className="input" type="number" inputMode="decimal"
        min="0.1" step="0.1" required placeholder="Enter minutes" disabled={saving}
        value={minutes} onChange={(event) => setMinutes(event.target.value)} />
      {error && <p role="alert" className="text-sm font-semibold">{error}</p>}
      <button className="primary-button w-full" disabled={saving} type="submit">
        {saving ? "Saving..." : "Save activity"}
      </button>
    </form>
  );
}
