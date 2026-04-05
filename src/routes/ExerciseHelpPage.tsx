import { Link, useParams } from "react-router-dom";

import { useExercise } from "../features/workouts/hooks";
import { StatusView } from "../components/StatusView";

export function ExerciseHelpPage() {
  const { exerciseId = "", sessionId = "" } = useParams();
  const exerciseQuery = useExercise(exerciseId);

  if (exerciseQuery.isLoading) {
    return <StatusView title="Exercise Help" message="Loading exercise guidance..." />;
  }

  if (exerciseQuery.isError || !exerciseQuery.data) {
    return (
      <StatusView
        title="Exercise Help"
        message="Exercise guidance could not be loaded for this movement."
      />
    );
  }

  const exercise = exerciseQuery.data;

  return (
    <main className="page-shell gap-4">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="section-label">Exercise Help</p>
          <h1 className="page-title">{exercise.name}</h1>
        </div>
        <Link className="secondary-button h-10 w-10 px-0 text-lg" to={`/workout/${sessionId}`}>
          ×
        </Link>
      </header>

      {[
        ["What it works", exercise.guidanceSummary],
        ["Setup cues", exercise.setupCues],
        ["Execution cues", exercise.executionCues],
        ["Common mistake", exercise.commonMistakes],
      ].map(([label, value]) => (
        <section key={label} className="card space-y-3 p-5">
          <p className="section-label">{label}</p>
          <p className="text-base leading-7 text-ink">{value}</p>
        </section>
      ))}

      <Link className="primary-button mt-auto w-full" to={`/workout/${sessionId}`}>
        Back to Workout
      </Link>
    </main>
  );
}
