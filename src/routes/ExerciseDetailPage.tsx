import { Link, useParams } from "react-router-dom";

import { formatLoad, formatWorkoutDate } from "../lib/format";
import { useAuth } from "../features/auth/auth-context";
import { useExerciseDetail } from "../features/workouts/hooks";
import { StatusView } from "../components/StatusView";

export function ExerciseDetailPage() {
  const { exerciseId = "" } = useParams();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const detailQuery = useExerciseDetail(userId, exerciseId);

  if (!user) {
    return null;
  }

  if (detailQuery.isLoading) {
    return <StatusView title="Exercise Detail" message="Loading exercise detail..." />;
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <StatusView
        title="Exercise Detail"
        message="Exercise detail could not be loaded from the seeded routine."
      />
    );
  }

  const {
    exercise,
    recentPerformances,
    currentRecommendationLoad,
    currentRecommendationSeconds,
    currentRecommendationText,
  } = detailQuery.data;
  const recommendationValue =
    currentRecommendationLoad != null
      ? formatLoad(
          currentRecommendationLoad,
          exercise.unit,
          exercise.loadMode === "assistance",
        )
      : currentRecommendationSeconds != null
        ? `${currentRecommendationSeconds}s`
        : "Bodyweight";

  return (
    <main className="page-shell gap-4">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="section-label">Exercise Detail</p>
            <h1 className="page-title">{exercise.name}</h1>
          </div>
          <Link className="secondary-button h-11 px-4 text-sm" to="/history">
            History
          </Link>
        </div>
      </header>

      <section className="card space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="section-label">Current recommendation</p>
            <p className="text-4xl font-bold text-ink">{recommendationValue}</p>
          </div>
          <span className="rounded-full bg-black/[0.03] px-3 py-2 text-sm font-semibold text-ink">
            {exercise.loadMode}
          </span>
        </div>
        <p className="text-sm leading-6 text-muted">{currentRecommendationText}</p>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-display text-2xl font-bold text-ink">Recent performances</h2>
        <div className="space-y-3">
          {recentPerformances.map(({ session, performance }) => (
            <div
              key={`${session.id}-${performance.id}`}
              className="flex items-center justify-between gap-4 border-t border-line pt-3 first:border-0 first:pt-0"
            >
              <div>
                <p className="text-sm font-medium text-ink">{formatWorkoutDate(session.completedAt)}</p>
                <p className="text-xs text-muted">{session.template.name}</p>
              </div>
              <p className="text-sm font-semibold text-ink">
                {performance.loggedSets
                  .map((set) => set.reps ?? set.seconds ?? "—")
                  .join(" / ")}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
