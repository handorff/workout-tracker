import { Link, useNavigate } from "react-router-dom";

import { formatLoad, formatRange } from "../lib/format";
import { supabase } from "../lib/supabase";
import { useAuth } from "../features/auth/auth-context";
import { useStartWorkout, useTodayData } from "../features/workouts/hooks";
import { sortTemplateExercises } from "../features/workouts/logic";
import { StatusView } from "../components/StatusView";

export function TodayPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const todayQuery = useTodayData(userId);
  const startWorkout = useStartWorkout(userId);

  if (!user) {
    return null;
  }

  if (todayQuery.isLoading) {
    return <StatusView title="Today" message="Loading your next workout..." />;
  }

  if (todayQuery.isError || !todayQuery.data) {
    return (
      <StatusView
        title="Today"
        message="Workout data could not be loaded. Check your Supabase connection and seed data."
      />
    );
  }

  const { inProgressSession, nextTemplate, exerciseRecommendations } = todayQuery.data;
  const exercises = sortTemplateExercises(nextTemplate);
  const activeRecommendations = new Map(
    inProgressSession?.performances.map((performance) => [
      performance.exerciseId,
      {
        recommendedLoadValue: performance.recommendedLoadValue,
        recommendedSecondsValue: performance.recommendedSecondsValue,
        recommendationText: performance.recommendationText,
      },
    ]),
  );

  async function handleStart() {
    const session = await startWorkout.mutateAsync();
    navigate(`/workout/${session.id}`);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (
    <main className="page-shell gap-4 pb-28">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="page-title">Today</h1>
        </div>
        <div className="flex gap-2">
          <Link className="secondary-button h-11 px-4 text-sm" to="/history">
            History
          </Link>
          <button className="secondary-button h-11 px-4 text-sm" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <section className="card space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="section-label">
              {inProgressSession ? "Resume workout" : "Next workout"}
            </p>
            <h2 className="font-display text-3xl font-bold text-ink">
              {inProgressSession?.template.name ?? nextTemplate.name}
            </h2>
          </div>
          <span className="rounded-full bg-black/5 px-4 py-2 text-sm font-semibold text-success">
            {inProgressSession?.template.exercises.length ?? exercises.length} exercises
          </span>
        </div>
        {(inProgressSession?.template.warmupNotes ?? nextTemplate.warmupNotes) && (
          <div>
            <p className="section-label">Warm-up</p>
            <p className="mt-2 text-sm leading-6 text-ink">
              {inProgressSession?.template.warmupNotes ?? nextTemplate.warmupNotes}
            </p>
          </div>
        )}
      </section>

      <section className="card space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold text-ink">Exercises</h2>
        </div>
        <div className="space-y-3">
          {(inProgressSession?.template.exercises ?? exercises).map((item) => (
            (() => {
              const recommendation =
                activeRecommendations.get(item.exerciseId) ??
                exerciseRecommendations[item.exerciseId];
              const suggestedLoad =
                item.exercise.loadMode !== "bodyweight" &&
                recommendation?.recommendedLoadValue != null
                  ? formatLoad(
                      recommendation.recommendedLoadValue,
                      item.exercise.unit,
                      item.exercise.loadMode === "assistance",
                    )
                  : null;

              return (
                <Link
                  key={item.id}
                  className="flex items-start justify-between gap-4 transition hover:text-success"
                  to={`/exercises/${item.exerciseId}`}
                >
                  <div className="space-y-1">
                    <p className="text-lg font-semibold text-ink">{item.exercise.name}</p>
                    <p className="text-sm text-muted">
                      {item.targetSets} x{" "}
                      {item.targetSecondsMin != null
                        ? formatRange(item.targetSecondsMin, item.targetSecondsMax, "s")
                        : formatRange(item.targetRepMin, item.targetRepMax)}
                      {item.exercise.loadMode === "bodyweight" &&
                      item.targetSecondsMin == null &&
                      item.targetRepMin != null
                        ? "/side"
                        : ""}
                    </p>
                    {suggestedLoad && (
                      <p className="text-sm font-semibold text-success">
                        Suggested: {suggestedLoad}
                      </p>
                    )}
                  </div>
                  <span className="pt-1 text-right text-sm text-muted">
                    {item.exercise.loadMode === "assistance"
                      ? "assisted"
                      : item.exercise.equipment}
                  </span>
                </Link>
              );
            })()
          ))}
        </div>
      </section>

      <button
        className="primary-button fixed bottom-6 left-1/2 z-50 w-[calc(100%-2.5rem)] max-w-[390px] -translate-x-1/2 shadow-card"
        disabled={startWorkout.isPending}
        onClick={handleStart}
      >
        {startWorkout.isPending
          ? "Starting..."
          : inProgressSession
            ? `Resume ${inProgressSession.template.name}`
            : `Start ${nextTemplate.name}`}
      </button>
    </main>
  );
}
