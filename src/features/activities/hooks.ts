import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteOutsideActivity, fetchOutsideActivities, fetchOutsideActivity, saveOutsideActivity, type OutsideActivityValues } from "./api";

export function useOutsideActivity(userId: string, id?: string) {
  return useQuery({
    queryKey: ["outside-activities", userId, "detail", id],
    queryFn: () => fetchOutsideActivity(userId, id!),
    enabled: Boolean(userId && id),
  });
}

export function useOutsideActivities(userId: string, month: Date) {
  return useQuery({
    queryKey: ["outside-activities", userId, month.getFullYear(), month.getMonth()],
    queryFn: () => fetchOutsideActivities(userId, month),
    enabled: Boolean(userId),
  });
}

export function useSaveOutsideActivity(userId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ values, id }: { values: OutsideActivityValues; id?: string }) => saveOutsideActivity(userId, values, id),
    onSuccess: () => client.invalidateQueries({ queryKey: ["outside-activities", userId] }),
  });
}

export function useDeleteOutsideActivity(userId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteOutsideActivity(userId, id),
    onSuccess: () => client.invalidateQueries({ queryKey: ["outside-activities", userId] }),
  });
}
