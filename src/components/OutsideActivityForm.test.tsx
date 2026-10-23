import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { OutsideActivityForm } from "./OutsideActivityForm";
const mocks = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("../features/activities/hooks", () => ({
  useDeleteOutsideActivity: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSaveOutsideActivity: () => ({ mutateAsync: mocks.save, isPending: false }),
}));
beforeEach(() => { mocks.save.mockReset().mockResolvedValue(undefined); });

it("logs a dated bike ride in fractional miles, then reports success", async () => {
  const done = vi.fn();
  render(<OutsideActivityForm userId="u1" onDone={done} onCancel={vi.fn()} />);
  const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText("Activity"), "Biking");
  await user.type(screen.getByLabelText("Distance (miles)"), "4.25");
  expect(screen.queryByLabelText(/Notes/)).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Save activity" }));
  expect(mocks.save).toHaveBeenCalledWith({ id: undefined, values: { activity: "Biking", activity_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), distance_miles: 4.25 } });
  expect(done).toHaveBeenCalledOnce();
});

it("keeps edits available after a failed save", async () => {
  mocks.save.mockRejectedValue(new Error("offline"));
  const done = vi.fn();
  render(<OutsideActivityForm userId="u1" initial={{ id: "a1", activity: "Hiking", activity_date: "2026-04-05", distance_miles: 3.5 }} onDone={done} onCancel={vi.fn()} />);
  const user = userEvent.setup();
  expect(screen.getByLabelText("Activity name")).toHaveValue("Hiking");
  await user.click(screen.getByRole("button", { name: "Save activity" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("could not be saved");
  expect(screen.getByLabelText("Distance (miles)")).toHaveValue(3.5);
  expect(done).not.toHaveBeenCalled();
  expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ id: "a1" }));
});

it("requires a positive distance before saving", async () => {
  render(<OutsideActivityForm userId="u1" onDone={vi.fn()} onCancel={vi.fn()} />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Distance (miles)"), "0");
  await user.click(screen.getByRole("button", { name: "Save activity" }));
  expect(screen.getByLabelText("Distance (miles)")).toBeInvalid();
  expect(mocks.save).not.toHaveBeenCalled();
});
