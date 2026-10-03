import { addAsset, getProjectFull } from "@/backend/repo";
import { makeId } from "@/backend/ids";
import { persistUploadFile } from "@/backend/storage";
import { probeMedia } from "@/video-engine/ffmpeg";

export const dynamic = "force-dynamic";

function detectRole(file: File) {
  const type = file.type;
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  if (type.startsWith("image/")) return "image";
  return "asset";
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const full = await getProjectFull(projectId);
  if (!full) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  const form = await request.formData();
  const files = form
    .getAll("files")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (!files.length) {
    return Response.json({ error: "No files uploaded" }, { status: 400 });
  }

  const uploaded = [];

  for (const file of files) {
    const assetId = makeId("asset");
    const role = detectRole(file);
    const saved = await persistUploadFile(projectId, file, assetId);

    let metadata: Record<string, unknown> = {
      sizeBytes: file.size,
    };

    if (role === "video" || role === "audio") {
      try {
        const probe = await probeMedia(saved.targetPath);
        const video = probe.streams.find((s) => s.codec_type === "video") ?? {};
        const audio = probe.streams.find((s) => s.codec_type === "audio") ?? {};
        metadata = {
          ...metadata,
          duration: Number(probe.format.duration ?? 0),
          resolution: video.width && video.height ? `${video.width}x${video.height}` : null,
          fps: video.r_frame_rate ?? null,
          hasAudio: Boolean(audio.codec_type),
        };
      } catch {
        metadata = {
          ...metadata,
          probeError: true,
        };
      }
    }

    await addAsset({
      id: assetId,
      projectId,
      role,
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
      filePath: saved.targetPath,
      metadata,
    });

    uploaded.push({
      id: assetId,
      name: file.name,
      role,
      metadata,
    });
  }

  return Response.json({ ok: true, uploaded });
}
