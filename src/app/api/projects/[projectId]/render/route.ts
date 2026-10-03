import path from "node:path";
import { createRenderRecord, failRenderRecord, finalizeRenderRecord, getMainVideoAsset, getProjectFull, updateProjectStage } from "@/backend/repo";
import { makeId } from "@/backend/ids";
import { ensureProjectDirs } from "@/backend/storage";
import { renderProjectVideo } from "@/render-engine/render";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const full = await getProjectFull(projectId);
  if (!full) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  const mainVideo = await getMainVideoAsset(projectId);
  if (!mainVideo) {
    return Response.json({ error: "No primary video found" }, { status: 400 });
  }

  if (!full.project.editPlan) {
    return Response.json({ error: "Run auto edit first" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as { resolution?: "1080p" | "720p" };
  const resolution = body.resolution === "720p" ? "720p" : "1080p";

  const renderId = makeId("render");
  await createRenderRecord({ id: renderId, projectId, resolution });

  try {
    await updateProjectStage(projectId, "rendering", `Rendering ${resolution.toUpperCase()}`);
    const dirs = await ensureProjectDirs(projectId);
    const outputPath = path.join(dirs.outputs, `${renderId}_${resolution}.mp4`);

    const result = await renderProjectVideo({
      inputPath: mainVideo.filePath,
      outputPath,
      resolution,
      editPlan: full.project.editPlan as Record<string, unknown>,
    });

    await finalizeRenderRecord({
      renderId,
      projectId,
      outputPath,
      durationSec: result.durationSec,
      fileSizeMb: result.fileSizeMb,
    });

    await updateProjectStage(projectId, "rendered", "Render complete");

    return Response.json({
      ok: true,
      renderId,
      durationSec: result.durationSec,
      fileSizeMb: result.fileSizeMb,
    });
  } catch (error) {
    await failRenderRecord({ renderId, projectId });
    await updateProjectStage(projectId, "error", "Render failed");

    return Response.json(
      {
        error: "Render failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
