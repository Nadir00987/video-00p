import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { getAssetById } from "@/backend/repo";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string; assetId: string }> }) {
  const { projectId, assetId } = await params;
  const asset = await getAssetById(projectId, assetId);

  if (!asset) {
    return Response.json({ error: "Asset not found" }, { status: 404 });
  }

  const stats = await stat(asset.filePath);
  const stream = createReadStream(asset.filePath);

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(stats.size),
      "Cache-Control": "no-store",
    },
  });
}
