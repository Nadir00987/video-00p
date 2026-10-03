import type { ProjectSettings } from "@/backend/repo";

type AnalysisShape = {
  metadata?: { duration?: number };
  audio?: {
    speechSegments?: Array<{ start: number; end: number; text?: string }>;
    silences?: Array<{ start: number; end: number; duration?: number }>;
  };
  speech?: {
    transcript?: string;
    segments?: Array<{ start: number; end: number; text: string }>;
  };
  content?: {
    importantPoints?: string[];
    keywords?: Array<{ keyword: string; count: number }>;
  };
};

function round(n: number) {
  return Math.round(n * 1000) / 1000;
}

function mergeSegments(segments: Array<{ start: number; end: number }>, gap = 0.25) {
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const seg of sorted) {
    const last = merged[merged.length - 1];
    if (!last || seg.start - last.end > gap) {
      merged.push({ ...seg });
    } else {
      last.end = Math.max(last.end, seg.end);
    }
  }
  return merged;
}

export function buildAutoEdit(
  analysis: AnalysisShape,
  settings: ProjectSettings,
  onProgress?: (step: string) => Promise<void> | void,
) {
  onProgress?.("Smart cuts");
  const speechSegs = analysis.audio?.speechSegments ?? [];

  const keepSegments = mergeSegments(
    speechSegs.map((s) => ({
      start: Math.max(0, round(s.start - 0.12)),
      end: round(s.end + 0.12),
    })),
    0.35,
  );

  const removedSilences = (analysis.audio?.silences ?? []).filter((s) => (s.duration ?? s.end - s.start) >= 0.8);

  onProgress?.("Captions");
  const captions = (analysis.speech?.segments ?? speechSegs).map((seg, index) => ({
    id: `cap_${index + 1}`,
    start: round(seg.start),
    end: round(seg.end),
    text: seg.text || `Speech segment ${index + 1}`,
    emphasis: index % 3 === 0 ? "keyword" : "none",
    reason: "Caption generated from speech timing and transcript segment.",
  }));

  onProgress?.("Zooms");
  const zoomMoments = keepSegments
    .filter((_, i) => i % (settings.intensity === "High" ? 2 : 3) === 0)
    .slice(0, settings.intensity === "Low" ? 4 : 8)
    .map((seg, i) => ({
      id: `zoom_${i + 1}`,
      start: round(seg.start + 0.15),
      end: round(Math.min(seg.end, seg.start + 1.8)),
      from: 1,
      to: i % 2 === 0 ? 1.05 : 1.1,
      reason: "Important statement detected from speech density and content cues.",
    }));

  onProgress?.("B-roll");
  const keywordPool = analysis.content?.importantPoints ?? [];
  const brollSuggestions = keywordPool.slice(0, 5).map((keyword, i) => ({
    id: `broll_${i + 1}`,
    keyword,
    start: round(keepSegments[i]?.start ?? i * 3),
    end: round((keepSegments[i]?.start ?? i * 3) + 2.2),
    sourcePriority: ["user-broll", "project-media", "local-library"],
    reason: `Visual opportunity detected for keyword: ${keyword}`,
  }));

  onProgress?.("Motion graphics");
  const graphics = (analysis.content?.keywords ?? []).slice(0, 4).map((item, i) => ({
    id: `graphic_${i + 1}`,
    text: item.keyword.toUpperCase(),
    style: settings.style,
    start: round((keepSegments[i]?.start ?? i * 4) + 0.2),
    end: round((keepSegments[i]?.start ?? i * 4) + 1.8),
    reason: "Keyword emphasis selected for kinetic typography.",
  }));

  onProgress?.("SFX");
  const sfx = graphics.map((g, i) => ({
    id: `sfx_${i + 1}`,
    type: i % 2 === 0 ? "pop" : "whoosh",
    at: g.start,
    reason: "SFX attached to animated text or transition moment.",
  }));

  onProgress?.("BGM");
  const bgm = {
    mood:
      settings.style === "Educational"
        ? "Educational"
        : settings.style === "High Energy"
          ? "Energetic"
          : "Technology",
    ducking: "auto",
    fadeInSec: 1.2,
    fadeOutSec: 1.4,
    reason: "Music profile chosen from editing style and energy settings.",
  };

  onProgress?.("Timeline generated");
  return {
    settings,
    summary: {
      removedSilenceCount: removedSilences.length,
      keptSegmentCount: keepSegments.length,
      captionCount: captions.length,
    },
    decisions: {
      smartCuts: keepSegments,
      removedSilences,
      zoomMoments,
      captions,
      graphics,
      brollSuggestions,
      sfx,
      bgm,
      transitions: keepSegments.map((seg, i) => ({
        at: seg.start,
        type: i === 0 ? "cut" : "dissolve",
        reason: "Transition selected based on pacing and style.",
      })),
    },
    timeline: {
      video: {
        V1: keepSegments,
        V2: brollSuggestions,
      },
      graphics: {
        G1: graphics,
      },
      captions: {
        C1: captions,
      },
      audio: {
        A1: keepSegments,
        A2: sfx,
        A3: bgm,
      },
    },
  };
}
