import { supabase } from "../../lib/supabase";

// Paginate independently of the workout history UI so no visits are lost to its limit.
export async function fetchVisitTimestamps(userId: string, startDay: string, endDay: string) {
  const timestamps: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from("workout_sessions")
      .select("id, completed_at").eq("user_id", userId).eq("status", "completed")
      .gte("completed_at", `${startDay}T00:00:00Z`).lt("completed_at", `${endDay}T00:00:00Z`)
      .order("completed_at").order("id").range(offset, offset + 999);
    if (error) throw error;
    for (const row of data ?? []) if (row.completed_at) timestamps.push(row.completed_at);
    if (!data || data.length < 1000) return timestamps;
  }
}
