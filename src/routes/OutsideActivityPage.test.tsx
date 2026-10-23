import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { OutsideActivityPage } from "./OutsideActivityPage";

const mocks = vi.hoisted(() => ({ save: vi.fn(), detail: vi.fn(), remove: vi.fn() }));
vi.mock("../features/auth/auth-context", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("../features/activities/hooks", () => ({
  useOutsideActivity: (...args: unknown[]) => mocks.detail(...args),
  useSaveOutsideActivity: () => ({ mutateAsync: mocks.save, isPending: false }),
  useDeleteOutsideActivity: () => ({ mutateAsync: mocks.remove, isPending: false }),
}));
beforeEach(() => {
  mocks.save.mockReset().mockResolvedValue(undefined);
  mocks.remove.mockReset().mockResolvedValue(undefined);
  mocks.detail.mockReset().mockReturnValue({ data: undefined, isPending: false });
});
afterEach(() => vi.restoreAllMocks());
function renderPage(path = "/outside-activity/new") {
  render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/outside-activity/new" element={<OutsideActivityPage />} />
    <Route path="/outside-activity/:activityId/edit" element={<OutsideActivityPage />} />
    <Route path="/today" element={<h1>Today</h1>} />
    <Route path="/history" element={<h1>History</h1>} />
  </Routes></MemoryRouter>);
}
it("saves miles on its own page and returns to history", async () => {
  renderPage();
  const user = userEvent.setup();
  expect(screen.getByRole("heading", { name: "Outside activity" })).toBeVisible();
  expect(screen.queryByLabelText(/Notes/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Remove activity" })).not.toBeInTheDocument();
  await user.type(screen.getByLabelText("Distance (miles)"), "2.75");
  await user.click(screen.getByRole("button", { name: "Save activity" }));
  expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ values: expect.objectContaining({ distance_miles: 2.75 }) }));
  expect(await screen.findByRole("heading", { name: "History" })).toBeVisible();
});
it("cancels back to Today without saving", async () => {
  renderPage();
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getByRole("heading", { name: "Today" })).toBeVisible();
  expect(mocks.save).not.toHaveBeenCalled();
});
it("loads existing miles for the separate editing page", () => {
  mocks.detail.mockReturnValue({ data: { id: "a1", activity: "Biking", activity_date: "2026-04-05", distance_miles: 12.5 }, isPending: false });
  renderPage("/outside-activity/a1/edit");
  expect(mocks.detail).toHaveBeenCalledWith("u1", "a1");
  expect(screen.getByLabelText("Distance (miles)")).toHaveValue(12.5);
  expect(screen.getByRole("link", { name: "History" })).toHaveAttribute("href", "/history");
});
it("shows a loading state instead of an empty edit form", () => {
  mocks.detail.mockReturnValue({ isPending: true });
  renderPage("/outside-activity/a1/edit");
  expect(screen.getByRole("status")).toHaveTextContent("Loading activity");
  expect(screen.queryByLabelText("Distance (miles)")).not.toBeInTheDocument();
});
it("shows an error when an existing activity cannot be loaded", () => {
  mocks.detail.mockReturnValue({ isError: true, isPending: false });
  renderPage("/outside-activity/a1/edit");
  expect(screen.getByRole("alert")).toHaveTextContent("could not be loaded");
});

function renderEditPage() {
  mocks.detail.mockReturnValue({ data: { id: "a1", activity: "Biking", activity_date: "2026-04-05", distance_miles: 12.5 }, isPending: false });
  renderPage("/outside-activity/a1/edit");
}
it("removes an activity from editing after confirmation and returns to history", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  renderEditPage();
  await userEvent.click(screen.getByRole("button", { name: "Remove activity" }));
  expect(window.confirm).toHaveBeenCalledWith("Remove this outside activity permanently? This cannot be undone.");
  expect(mocks.remove).toHaveBeenCalledWith("a1");
  expect(await screen.findByRole("heading", { name: "History" })).toBeVisible();
  expect(mocks.save).not.toHaveBeenCalled();
});
it("keeps an activity when removal is cancelled", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(false);
  renderEditPage();
  await userEvent.click(screen.getByRole("button", { name: "Remove activity" }));
  expect(mocks.remove).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Distance (miles)")).toHaveValue(12.5);
});
it("keeps the edit view available when removal fails", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  mocks.remove.mockRejectedValue(new Error("offline"));
  renderEditPage();
  await userEvent.click(screen.getByRole("button", { name: "Remove activity" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("That activity could not be removed. Try again.");
  expect(screen.getByLabelText("Distance (miles)")).toHaveValue(12.5);
});
