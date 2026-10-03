import { buildAutoEdit } from "@/ai-analysis/auto-edit";
import { getProjectFull, saveEditPlan, updateProjectSettings, updateProjectStage, type ProjectSettings } from "@/backend/repo";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const full = await getProjectFull(projectId);

  if (!full) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  if (!full.project.analysis) {
    return Response.json({ error: "Run analysis first" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as { settings?: ProjectSettings };
  const settings = body.settings ?? (full.project.settings as ProjectSettings);

  await updateProjectSettings(projectId, settings);

  await updateProjectStage(projectId, "editing", "Starting auto edit");
  const plan = buildAutoEdit(full.project.analysis as Record<string, unknown>, settings, async (step) => {
    await updateProjectStage(projectId, "editing", `✓ ${step}`);
  });

  await saveEditPlan(projectId, plan as unknown as Record<string, unknown>);
  await updateProjectStage(projectId, "ready", "Preview AI Edit");

  return Response.json({ ok: true, editPlan: plan });
}
