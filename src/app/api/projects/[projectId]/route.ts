import { defaultSettings, getProjectFull, updateProjectSettings, type ProjectSettings } from "@/backend/repo";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const full = await getProjectFull(projectId);
  if (!full) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }
  return Response.json(full);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const full = await getProjectFull(projectId);
  if (!full) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as Partial<ProjectSettings>;

  const merged: ProjectSettings = {
    ...defaultSettings,
    ...full.project.settings,
    ...body,
    features: {
      ...defaultSettings.features,
      ...((full.project.settings as ProjectSettings).features ?? {}),
      ...(body.features ?? {}),
    },
  };

  await updateProjectSettings(projectId, merged);

  return Response.json({ ok: true, settings: merged });
}
