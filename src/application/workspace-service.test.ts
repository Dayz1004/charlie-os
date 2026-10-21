import { expect, it, vi } from "vitest";
import type { Workspace } from "../domain/models";
import { WorkspaceService, type WorkspaceRepository } from "./workspace-service";

it("uses persisted planning preferences with the freshly loaded workspace revision", async () => {
  const workspace: Workspace = {
    preferences: { theme: "dark", horizonDays: 7 },
    projects: [],
    tasks: [],
    events: [],
    availability: [],
    planBlocks: [],
    timeEntries: [],
    dependencies: [],
    revision: 19,
    planningState: null,
  };
  const replaceSchedule = vi.fn().mockResolvedValue(workspace);
  const repository = {
    read: vi.fn().mockResolvedValue(workspace),
    replaceSchedule,
  } as unknown as WorkspaceRepository;
  await new WorkspaceService(repository).replan({ now: () => Date.parse("2026-10-13T15:00:00Z") });
  expect(replaceSchedule).toHaveBeenCalledWith(
    expect.objectContaining({ expectedRevision: 19, horizonEnd: "2026-10-20T03:00:00.000Z" }),
  );
});
