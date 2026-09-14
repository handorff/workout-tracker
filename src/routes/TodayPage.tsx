import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { formatLoad, formatRange } from "../lib/format";
import { supabase } from "../lib/supabase";
import { useAuth } from "../features/auth/auth-context";
import { useStartWorkout, useTodayData } from "../features/workouts/hooks";
import { sortTemplateExercises } from "../features/workouts/logic";
import { StatusView } from "../components/StatusView";

export function TodayPage() {
  const navigate = useNavigate();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
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

  const { inProgressSession, nextTemplate, templates, recommendationsByTemplate } = todayQuery.data;
  const selectedTemplate = inProgressSession?.template
    ?? templates.find((template) => template.id === selectedTemplateId)
    ?? nextTemplate;
  const exerciseRecommendations = recommendationsByTemplate[selectedTemplate.id] ?? {};
  const exercises = sortTemplateExercises(selectedTemplate);
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
    setStartError(null);
    if (inProgressSession) {
      navigate(`/workout/${inProgressSession.id}`);
      return;
    }
    try {
      const session = await startWorkout.mutateAsync(selectedTemplate.id);
      navigate(`/workout/${session.id}`);
    } catch {
      setStartError("This workout could not be started. Please try again.");
    }
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

      <fieldset className="space-y-3" disabled={Boolean(inProgressSession) || startWorkout.isPending}>
        <legend className="section-label mb-3">Choose workout</legend>
        <div className="flex flex-wrap gap-2">
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              aria-pressed={selectedTemplate.id === template.id}
              className={`secondary-button h-11 flex-1 px-4 text-sm disabled:cursor-not-allowed ${selectedTemplate.id === template.id ? "border-ink ring-1 ring-ink" : ""}`}
              onClick={() => { setSelectedTemplateId(template.id); setStartError(null); }}
            >
              {template.name}
            </button>
          ))}
        </div>
        {inProgressSession && <p className="text-sm leading-6">Finish your current workout before choosing another.</p>}
      </fieldset>

      <section className="card space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="section-label">
              {inProgressSession ? "Resume workout" : "Next workout"}
            </p>
            <h2 className="font-display text-3xl font-bold text-ink">
              {selectedTemplate.name}
            </h2>
          </div>
          <span className="shrink-0 rounded-md border border-line px-4 py-2 text-sm font-semibold text-ink">
            {exercises.length} exercises
          </span>
        </div>
        {(selectedTemplate.warmupNotes) && (
          <div>
            <p className="section-label">Warm-up</p>
            <p className="mt-2 text-sm leading-6 text-ink">
              {selectedTemplate.warmupNotes}
            </p>
          </div>
        )}
      </section>

      <section className="card space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold text-ink">Exercises</h2>
        </div>
        <div className="space-y-3">
          {exercises.map((item) => (
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
                  className="flex items-start justify-between gap-4 border-t border-line pt-3 first:border-0 first:pt-0 hover:underline underline-offset-4"
                  to={`/exercises/${item.exerciseId}?workout=${selectedTemplate.id}`}
                >
                  <div className="space-y-1">
                    <p className="text-lg font-semibold text-ink">{item.exercise.name}</p>
                    <p className="text-sm text-muted">
                      {item.exercise.unit === "minutes" ? "Optional · minutes" : <>{item.targetSets} x{" "}
                      {item.targetSecondsMin != null
                        ? formatRange(item.targetSecondsMin, item.targetSecondsMax, "s")
                        : formatRange(item.targetRepMin, item.targetRepMax)}
                      {item.exercise.loadMode === "bodyweight" &&
                      item.targetSecondsMin == null &&
                      item.targetRepMin != null
                        ? "/side"
                        : ""}</>}
                    </p>
                    {suggestedLoad && (
                      <p className="text-sm font-semibold text-ink">
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

      {startError && <p role="alert" className="text-sm font-semibold">{startError}</p>}

      <button
        className="primary-button fixed bottom-6 left-1/2 z-50 w-[calc(100%-2.5rem)] max-w-[390px] -translate-x-1/2"
        disabled={startWorkout.isPending}
        onClick={handleStart}
      >
        {startWorkout.isPending
          ? "Starting..."
          : inProgressSession
            ? `Resume ${inProgressSession.template.name}`
            : `Start ${selectedTemplate.name}`}
      </button>
    </main>
  );
}
