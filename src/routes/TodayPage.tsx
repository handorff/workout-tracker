import { GymGoalCard } from "../components/GymGoalCard";
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
  const [detailsTemplateId, setDetailsTemplateId] = useState<string | null>(null);
  const [startingTemplateId, setStartingTemplateId] = useState<string | null>(null);
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
  const selectedTemplate = templates.find((template) => template.id === detailsTemplateId) ?? nextTemplate;
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

  async function handleStart(templateId: string) {
    if (startWorkout.isPending) return;
    setStartError(null);
    if (inProgressSession) {
      navigate(`/workout/${inProgressSession.id}`);
      return;
    }
    setStartingTemplateId(templateId);
    try {
      const session = await startWorkout.mutateAsync(templateId);
      navigate(`/workout/${session.id}`);
    } catch {
      setStartError("This workout could not be started. Please try again.");
    } finally {
      setStartingTemplateId(null);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (
    <main className="page-shell gap-4">
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

      <GymGoalCard />

      <section className="space-y-3" aria-label="Workouts">
        {templates.map((template) => {
          const isActive = inProgressSession?.workoutTemplateId === template.id;
          const isNext = !inProgressSession && template.id === nextTemplate.id;
          const isStarting = startWorkout.isPending && startingTemplateId === template.id;
          return <div key={template.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <button type="button"
                className={`primary-button flex-1 justify-between gap-3 ${isNext || isActive ? "" : "border-line bg-white"}`}
                disabled={startWorkout.isPending || Boolean(inProgressSession && !isActive)}
                aria-label={`${isActive ? "Resume" : "Start"} ${template.name}`}
                aria-describedby={isNext ? `next-${template.id}` : undefined}
                onClick={() => handleStart(template.id)}>
                <span>{isStarting ? "Starting..." : `${isActive ? "Resume" : "Start"} ${template.name}`}</span>
                {isNext && <span id={`next-${template.id}`} className="inline-flex items-center">
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m9 5 7 7-7 7M4 12h12" /></svg>
                  <span className="sr-only">Next workout</span>
                </span>}
              </button>
              <button type="button" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-gray-100"
                aria-label={`${detailsTemplateId === template.id ? "Hide" : "View"} ${template.name} details`}
                aria-expanded={detailsTemplateId === template.id} aria-controls={`workout-details-${template.id}`}
                onClick={() => setDetailsTemplateId(detailsTemplateId === template.id ? null : template.id)}>
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v1" /></svg>
              </button>
            </div>
      {detailsTemplateId === template.id && <div id={`workout-details-${template.id}`} className="space-y-4 border-t border-line pt-4">
        {(selectedTemplate.warmupNotes) && (
          <div>
            <p className="section-label">Warm-up</p>
            <p className="mt-2 text-sm leading-6 text-ink">
              {selectedTemplate.warmupNotes}
            </p>
          </div>
        )}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-ink">Exercises</h3>
          <span className="text-sm">{exercises.length} exercises</span>
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
      </div>}
          </div>;
        })}
        {inProgressSession && <p className="text-sm leading-6">Finish your current workout before starting another.</p>}
        {startError && <p role="alert" className="text-sm font-semibold">{startError}</p>}
      <div className="border-t border-line pt-3">
        <Link className="secondary-button w-full" to="/outside-activity/new">Log outside activity</Link>
      </div>
      </section>
    </main>
  );
}
