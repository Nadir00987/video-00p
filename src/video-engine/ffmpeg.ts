import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";

function assertBinary(pathValue: string | null | undefined, name: string) {
  if (!pathValue) {
    throw new Error(`${name} binary is not available`);
  }
  return pathValue;
}

export const FFMPEG_BIN = assertBinary(ffmpegPath, "ffmpeg");
export const FFPROBE_BIN = assertBinary(ffprobeStatic.path, "ffprobe");

export async function runCommand(bin: string, args: string[]) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => reject(err));

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed (${code}): ${bin} ${args.join(" ")}\n${stderr}`));
      }
    });
  });
}

export async function probeMedia(filePath: string) {
  const { stdout } = await runCommand(FFPROBE_BIN, [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_streams",
    "-show_format",
    filePath,
  ]);

  return JSON.parse(stdout) as {
    streams: Array<Record<string, unknown>>;
    format: Record<string, unknown>;
  };
}

export async function detectSilences(filePath: string) {
  const { stderr } = await runCommand(FFMPEG_BIN, [
    "-i",
    filePath,
    "-af",
    "silencedetect=noise=-35dB:d=0.8",
    "-f",
    "null",
    "-",
  ]);

  const silences: Array<{ start: number; end: number; duration: number }> = [];
  const starts = [...stderr.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  const ends = [...stderr.matchAll(/silence_end: ([\d.]+) \| silence_duration: ([\d.]+)/g)].map((m) => ({
    end: Number(m[1]),
    duration: Number(m[2]),
  }));

  for (let i = 0; i < Math.min(starts.length, ends.length); i += 1) {
    silences.push({
      start: starts[i],
      end: ends[i].end,
      duration: ends[i].duration,
    });
  }

  return silences;
}

export async function detectSceneChanges(filePath: string) {
  const { stderr } = await runCommand(FFMPEG_BIN, [
    "-i",
    filePath,
    "-filter_complex",
    "select='gt(scene,0.35)',metadata=print",
    "-an",
    "-f",
    "null",
    "-",
  ]);

  const scenePoints = [...stderr.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1]));
  return [...new Set(scenePoints)].slice(0, 300);
}
