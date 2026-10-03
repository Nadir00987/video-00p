import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { getRenderById } from "@/backend/repo";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string; renderId: string }> }) {
  const { projectId, renderId } = await params;
  const render = await getRenderById(projectId, renderId);

  if (!render || !render.outputPath || render.status !== "ready") {
    return Response.json({ error: "Render not ready" }, { status: 404 });
  }

  const stats = await stat(render.outputPath);
  const stream = createReadStream(render.outputPath);
  const filename = path.basename(render.outputPath);

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(stats.size),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
