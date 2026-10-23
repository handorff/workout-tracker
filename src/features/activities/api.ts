import { supabase } from "../../lib/supabase";
import { localDay } from "../goals/logic";

export interface OutsideActivityValues {
  activity: string;
  activity_date: string;
  distance_miles: number;
}
export interface OutsideActivity extends OutsideActivityValues { id: string }

export function todayDate() {
  return localDay(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);
}

export function validateActivity(values: OutsideActivityValues) {
  const date = new Date(`${values.activity_date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.activity_date) || !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== values.activity_date || values.activity_date > todayDate()) {
    throw new Error("Choose today or an earlier date.");
  }
  if (!values.activity.trim() || values.activity.trim().length > 100) throw new Error("Enter an activity up to 100 characters.");
  if (!Number.isFinite(values.distance_miles) || values.distance_miles < 0.01 || values.distance_miles > 9999.99 ||
    Math.abs(values.distance_miles * 100 - Math.round(values.distance_miles * 100)) > 0.000001) {
    throw new Error("Enter a distance from 0.01 to 9,999.99 miles, with up to two decimal places.");
  }
}

export async function fetchOutsideActivities(userId: string, month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const start = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
  const end = `${monthIndex === 11 ? year + 1 : year}-${String(monthIndex === 11 ? 1 : monthIndex + 2).padStart(2, "0")}-01`;
  const activities: OutsideActivity[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.from("outside_activities")
      .select("id, activity, activity_date, distance_miles")
      .eq("user_id", userId).gte("activity_date", start).lt("activity_date", end)
      .order("activity_date", { ascending: false }).order("id").range(offset, offset + 99);
    if (error) throw error;
    activities.push(...(data as OutsideActivity[]));
    if (data.length < 100) return activities;
  }
}

export async function saveOutsideActivity(userId: string, values: OutsideActivityValues, id?: string) {
  validateActivity(values);
  const payload = { ...values, activity: values.activity.trim() };
  const query = id
    ? supabase.from("outside_activities").update(payload).eq("id", id).eq("user_id", userId)
    : supabase.from("outside_activities").insert({ ...payload, user_id: userId });
  const { error } = await query.select("id").single();
  if (error) throw error;
}

export async function fetchOutsideActivity(userId: string, id: string) {
  const { data, error } = await supabase.from("outside_activities")
    .select("id, activity, activity_date, distance_miles")
    .eq("user_id", userId).eq("id", id).single();
  if (error) throw error;
  return data as OutsideActivity;
}

export async function deleteOutsideActivity(userId: string, id: string) {
  const { error } = await supabase.from("outside_activities").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}
