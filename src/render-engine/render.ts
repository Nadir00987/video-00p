import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { FFMPEG_BIN, probeMedia, runCommand } from "@/video-engine/ffmpeg";

type EditPlanShape = {
  decisions?: {
    smartCuts?: Array<{ start: number; end: number }>;
  };
};

function buildCutFilter(segments: Array<{ start: number; end: number }>) {
  const chains: string[] = [];
  const concatInputs: string[] = [];

  segments.forEach((segment, i) => {
    chains.push(
      `[0:v]trim=start=${segment.start}:end=${segment.end},setpts=PTS-STARTPTS[v${i}]`,
      `[0:a]atrim=start=${segment.start}:end=${segment.end},asetpts=PTS-STARTPTS[a${i}]`,
    );
    concatInputs.push(`[v${i}][a${i}]`);
  });

  chains.push(`${concatInputs.join("")}concat=n=${segments.length}:v=1:a=1[vcat][acat]`);
  return chains.join(";");
}

export async function renderProjectVideo(params: {
  inputPath: string;
  outputPath: string;
  resolution: "1080p" | "720p";
  editPlan: EditPlanShape;
}) {
  await mkdir(path.dirname(params.outputPath), { recursive: true });

  const segments = params.editPlan.decisions?.smartCuts;
  const targetScale = params.resolution === "1080p" ? "1920:1080" : "1280:720";

  if (!segments || segments.length === 0) {
    await runCommand(FFMPEG_BIN, [
      "-y",
      "-i",
      params.inputPath,
      "-vf",
      `scale=${targetScale}:force_original_aspect_ratio=decrease,pad=${targetScale}:(ow-iw)/2:(oh-ih)/2`,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "21",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-movflags",
      "+faststart",
      params.outputPath,
    ]);
  } else {
    const filter = buildCutFilter(segments);

    await runCommand(FFMPEG_BIN, [
      "-y",
      "-i",
      params.inputPath,
      "-filter_complex",
      filter,
      "-map",
      "[vcat]",
      "-map",
      "[acat]",
      "-vf",
      `scale=${targetScale}:force_original_aspect_ratio=decrease,pad=${targetScale}:(ow-iw)/2:(oh-ih)/2`,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "21",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-movflags",
      "+faststart",
      params.outputPath,
    ]);
  }

  const meta = await probeMedia(params.outputPath);
  const file = await stat(params.outputPath);

  return {
    durationSec: Number(meta.format.duration ?? 0),
    fileSizeMb: file.size / (1024 * 1024),
  };
}
