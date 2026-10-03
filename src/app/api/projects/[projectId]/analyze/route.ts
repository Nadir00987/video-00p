import { analyzeVideo } from "@/ai-analysis/analyze";
import { getMainVideoAsset, getProjectFull, saveProjectAnalysis, updateProjectStage } from "@/backend/repo";

export const dynamic = "force-dynamic";

export async function POST(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProjectFull(projectId);

  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  const mainVideo = await getMainVideoAsset(projectId);
  if (!mainVideo) {
    return Response.json({ error: "Upload a video first" }, { status: 400 });
  }

  await updateProjectStage(projectId, "analyzing", "Analyzing video");

  const analysis = await analyzeVideo(mainVideo.filePath, async (step) => {
    await updateProjectStage(projectId, "analyzing", `✓ ${step}`);
  });

  await saveProjectAnalysis(projectId, analysis as unknown as Record<string, unknown>);
  await updateProjectStage(projectId, "analyzed", "Analysis complete");

  return Response.json({ ok: true, analysis });
}
