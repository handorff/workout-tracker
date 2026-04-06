import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  completeExercise,
  deleteWorkoutSession,
  fetchCompletedWorkouts,
  fetchExercise,
  fetchExerciseDetail,
  fetchInProgressWorkout,
  fetchTodayData,
  fetchWorkoutSession,
  startNextWorkout,
  updateLoggedSet,
} from "./api";

export function useTodayData(userId: string) {
  return useQuery({
    queryKey: ["today", userId],
    queryFn: () => fetchTodayData(userId),
  });
}

export function useStartWorkout(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => startNextWorkout(userId),
    onSuccess: (session) => {
      queryClient.setQueryData(["session", userId, session.id], session);
      queryClient.invalidateQueries({ queryKey: ["today", userId] });
      queryClient.invalidateQueries({ queryKey: ["history", userId] });
    },
  });
}

export function useWorkoutSession(userId: string, sessionId: string) {
  return useQuery({
    queryKey: ["session", userId, sessionId],
    queryFn: () => fetchWorkoutSession(sessionId, userId),
  });
}

export function useInProgressWorkout(userId: string) {
  return useQuery({
    queryKey: ["in-progress", userId],
    queryFn: () => fetchInProgressWorkout(userId),
  });
}

export function useCompletedWorkouts(userId: string) {
  return useQuery({
    queryKey: ["history", userId],
    queryFn: () => fetchCompletedWorkouts(userId),
  });
}

export function useDeleteWorkoutSession(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => deleteWorkoutSession(sessionId, userId),
    onSuccess: (_data, sessionId) => {
      queryClient.invalidateQueries({ queryKey: ["history", userId] });
      queryClient.invalidateQueries({ queryKey: ["today", userId] });
      queryClient.invalidateQueries({ queryKey: ["exercise-detail", userId] });
      queryClient.removeQueries({
        queryKey: ["session", userId, sessionId],
        exact: true,
      });
    },
  });
}

export function useExerciseDetail(userId: string, exerciseId: string) {
  return useQuery({
    queryKey: ["exercise-detail", userId, exerciseId],
    queryFn: () => fetchExerciseDetail(userId, exerciseId),
  });
}

export function useExercise(exerciseId: string) {
  return useQuery({
    queryKey: ["exercise", exerciseId],
    queryFn: () => fetchExercise(exerciseId),
  });
}

export function useUpdateLoggedSet(userId: string, sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      setId,
      values,
    }: {
      setId: string;
      values: Parameters<typeof updateLoggedSet>[1];
    }) => updateLoggedSet(setId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", userId, sessionId] });
      queryClient.invalidateQueries({ queryKey: ["today", userId] });
      queryClient.invalidateQueries({ queryKey: ["history", userId] });
    },
  });
}

export function useCompleteExercise(userId: string, sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (performanceId: string) => completeExercise(userId, sessionId, performanceId),
    onSuccess: (session) => {
      queryClient.setQueryData(["session", userId, sessionId], session);
      queryClient.invalidateQueries({ queryKey: ["today", userId] });
      queryClient.invalidateQueries({ queryKey: ["history", userId] });
    },
  });
}
