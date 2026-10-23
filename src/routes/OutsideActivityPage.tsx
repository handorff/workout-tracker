import { Link, useNavigate, useParams } from "react-router-dom";
import { OutsideActivityForm } from "../components/OutsideActivityForm";
import { useAuth } from "../features/auth/auth-context";
import { useOutsideActivity } from "../features/activities/hooks";

export function OutsideActivityPage() {
  const { user } = useAuth();
  const { activityId } = useParams();
  const navigate = useNavigate();
  const activityQuery = useOutsideActivity(user?.id ?? "", activityId);
  const returnTo = activityId ? "/history" : "/today";
  if (!user) return null;
  return <main className="page-shell gap-4">
    <header className="flex items-start justify-between gap-3">
      <h1 className="page-title">Outside activity</h1>
      <Link className="secondary-button h-11 px-4 text-sm" to={returnTo}>{activityId ? "History" : "Today"}</Link>
    </header>
    {activityId && activityQuery.isPending ? <p role="status">Loading activity...</p>
      : activityId && (activityQuery.isError || !activityQuery.data) ? <section className="card space-y-3 p-5">
        <p role="alert">This activity could not be loaded.</p>
        <button className="secondary-button" onClick={() => activityQuery.refetch()}>Try again</button>
      </section> : <OutsideActivityForm key={activityId ?? "new"} userId={user.id} initial={activityId ? activityQuery.data : undefined}
        onDone={() => navigate("/history", { state: { activitySaved: true } })}
        onCancel={() => navigate(returnTo)} />}
  </main>;
}
