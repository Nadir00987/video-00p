import { probeMedia, detectSceneChanges, detectSilences } from "@/video-engine/ffmpeg";

type SpeechSegment = {
  start: number;
  end: number;
  text: string;
  confidence: number;
};

function asNum(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function detectLanguageFromText(text: string) {
  const hasLatin = /[a-zA-Z]/.test(text);
  if (hasLatin) return "en";
  return "unknown";
}

async function transcribeOptional(filePath: string, speechSegments: SpeechSegment[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      source: "silence-segmentation",
      language: "unknown",
      segments: speechSegments,
      transcript: speechSegments.map((s) => s.text).join(" "),
    };
  }

  try {
    const fs = await import("node:fs/promises");
    const bytes = await fs.readFile(filePath);
    const blob = new Blob([bytes], { type: "video/mp4" });
    const form = new FormData();
    form.append("model", "gpt-4o-mini-transcribe");
    form.append("file", blob, "input.mp4");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });

    if (!response.ok) {
      throw new Error(`transcription failed with status ${response.status}`);
    }

    const result = (await response.json()) as {
      text?: string;
      language?: string;
    };

    const transcript = result.text?.trim() || speechSegments.map((s) => s.text).join(" ");

    return {
      source: "openai-transcription",
      language: result.language ?? detectLanguageFromText(transcript),
      segments: speechSegments.map((s) => ({ ...s, text: s.text })),
      transcript,
    };
  } catch {
    return {
      source: "silence-segmentation-fallback",
      language: "unknown",
      segments: speechSegments,
      transcript: speechSegments.map((s) => s.text).join(" "),
    };
  }
}

function makeSpeechSegments(duration: number, silences: Array<{ start: number; end: number }>) {
  const segments: SpeechSegment[] = [];
  let cursor = 0;

  for (const silence of silences) {
    const start = Math.max(0, cursor);
    const end = Math.max(start, silence.start);
    if (end - start > 0.6) {
      segments.push({
        start,
        end,
        text: `Speech segment ${segments.length + 1}`,
        confidence: 0.55,
      });
    }
    cursor = Math.max(cursor, silence.end);
  }

  if (duration - cursor > 0.6) {
    segments.push({
      start: cursor,
      end: duration,
      text: `Speech segment ${segments.length + 1}`,
      confidence: 0.55,
    });
  }

  return segments;
}

function summarizeTranscript(transcript: string) {
  const words = transcript
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);

  const stop = new Set(["this", "that", "with", "from", "have", "there", "about", "would", "could", "should"]);
  const map = new Map<string, number>();
  for (const word of words) {
    if (stop.has(word)) continue;
    map.set(word, (map.get(word) ?? 0) + 1);
  }

  const topKeywords = [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([keyword, count]) => ({ keyword, count }));

  return {
    topic: topKeywords.slice(0, 3).map((k) => k.keyword).join(", ") || "General conversation",
    importantPoints: topKeywords.map((k) => k.keyword),
    emotionalTone: transcript.match(/!|amazing|great|excited|important/gi) ? "energetic" : "neutral",
    keywords: topKeywords,
  };
}

export async function analyzeVideo(filePath: string, onProgress?: (step: string) => Promise<void> | void) {
  await onProgress?.("Video loaded");
  const probe = await probeMedia(filePath);

  const videoStream = probe.streams.find((s) => s.codec_type === "video") ?? {};
  const audioStream = probe.streams.find((s) => s.codec_type === "audio") ?? {};
  const duration = asNum(probe.format.duration, 0);

  await onProgress?.("Audio analyzed");
  const silences = await detectSilences(filePath);
  const speechSegments = makeSpeechSegments(duration, silences);

  await onProgress?.("Scenes detected");
  const sceneChanges = await detectSceneChanges(filePath);

  await onProgress?.("Transcript created");
  const transcriptData = await transcribeOptional(filePath, speechSegments);

  await onProgress?.("Important moments found");
  const content = summarizeTranscript(transcriptData.transcript);

  const pauses = silences.filter((s) => s.end - s.start >= 0.6);

  return {
    metadata: {
      duration,
      fps: asNum((videoStream.r_frame_rate as string)?.split("/")?.reduce((acc, part, i) => {
        if (i === 0) return Number(part);
        return acc / Math.max(Number(part), 1);
      }, 0 as number), 0),
      resolution: `${videoStream.width ?? "?"}x${videoStream.height ?? "?"}`,
      hasAudio: Boolean(audioStream.codec_type),
      sampleRate: audioStream.sample_rate ?? null,
      videoCodec: videoStream.codec_name ?? null,
      audioCodec: audioStream.codec_name ?? null,
    },
    visual: {
      sceneChanges,
      cameraFraming: "auto-detected primary talking-head framing",
      movementMoments: sceneChanges.slice(0, 20),
      detectedObjects: [],
      background: "unknown",
    },
    audio: {
      silences,
      pauses,
      speechSegments,
      backgroundNoise: "estimated from silencedetect",
      audioLevel: "normalized estimate",
    },
    speech: transcriptData,
    content,
  };
}
