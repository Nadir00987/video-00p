import { db } from "@/db";
import { mediaAssets, projects, renders } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";

export type ProjectSettings = {
  style: "Natural" | "Clean" | "Social Dynamic" | "Figma Motion" | "Educational" | "High Energy";
  intensity: "Low" | "Medium" | "High";
  features: {
    smartCuts: boolean;
    captions: boolean;
    zooms: boolean;
    broll: boolean;
    motionGraphics: boolean;
    sfx: boolean;
    bgm: boolean;
    audioEnhancement: boolean;
    transitions: boolean;
  };
};

export const defaultSettings: ProjectSettings = {
  style: "Natural",
  intensity: "Medium",
  features: {
    smartCuts: true,
    captions: true,
    zooms: true,
    broll: true,
    motionGraphics: true,
    sfx: true,
    bgm: true,
    audioEnhancement: true,
    transitions: true,
  },
};

export async function createProject(data: { id: string; name: string; settings?: Partial<ProjectSettings> }) {
  const merged = {
    ...defaultSettings,
    ...(data.settings ?? {}),
    features: {
      ...defaultSettings.features,
      ...(data.settings?.features ?? {}),
    },
  } satisfies ProjectSettings;

  await db.insert(projects).values({
    id: data.id,
    name: data.name,
    settings: merged,
    status: "draft",
    progressStage: "idle",
    progressLog: [],
  });

  return getProjectFull(data.id);
}

export async function getProjectFull(projectId: string) {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) return null;

  const assets = await db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.projectId, projectId))
    .orderBy(asc(mediaAssets.createdAt));

  const projectRenders = await db
    .select()
    .from(renders)
    .where(eq(renders.projectId, projectId))
    .orderBy(asc(renders.createdAt));

  return {
    project,
    assets,
    renders: projectRenders,
  };
}

export async function updateProjectStage(projectId: string, stage: string, message?: string) {
  const current = await getProjectFull(projectId);
  if (!current) return;

  const previousLog = (current.project.progressLog as string[]) ?? [];
  const nextLog = message ? [...previousLog, message] : previousLog;

  await db
    .update(projects)
    .set({
      progressStage: stage,
      progressLog: nextLog,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId));
}

export async function saveProjectAnalysis(projectId: string, analysis: Record<string, unknown>) {
  await db
    .update(projects)
    .set({ analysis, status: "analyzed", updatedAt: new Date() })
    .where(eq(projects.id, projectId));
}

export async function saveEditPlan(projectId: string, editPlan: Record<string, unknown>) {
  await db
    .update(projects)
    .set({ editPlan, status: "edited", updatedAt: new Date() })
    .where(eq(projects.id, projectId));
}

export async function updateProjectSettings(projectId: string, settings: ProjectSettings) {
  await db
    .update(projects)
    .set({ settings, updatedAt: new Date() })
    .where(eq(projects.id, projectId));
}

export async function addAsset(data: {
  id: string;
  projectId: string;
  role: string;
  originalName: string;
  mimeType: string;
  filePath: string;
  metadata: Record<string, unknown>;
}) {
  await db.insert(mediaAssets).values(data);
}

export async function getMainVideoAsset(projectId: string) {
  const [asset] = await db
    .select()
    .from(mediaAssets)
    .where(and(eq(mediaAssets.projectId, projectId), eq(mediaAssets.role, "video")))
    .orderBy(asc(mediaAssets.createdAt))
    .limit(1);

  return asset ?? null;
}

export async function getAssetById(projectId: string, assetId: string) {
  const [asset] = await db
    .select()
    .from(mediaAssets)
    .where(and(eq(mediaAssets.projectId, projectId), eq(mediaAssets.id, assetId)))
    .limit(1);

  return asset ?? null;
}

export async function createRenderRecord(data: {
  id: string;
  projectId: string;
  resolution: "1080p" | "720p";
}) {
  await db.insert(renders).values({
    id: data.id,
    projectId: data.projectId,
    resolution: data.resolution,
    status: "processing",
  });
}

export async function finalizeRenderRecord(data: {
  renderId: string;
  projectId: string;
  outputPath: string;
  fileSizeMb: number;
  durationSec: number;
}) {
  await db
    .update(renders)
    .set({
      status: "ready",
      outputPath: data.outputPath,
      fileSizeMb: data.fileSizeMb.toFixed(2),
      durationSec: data.durationSec.toFixed(2),
    })
    .where(and(eq(renders.id, data.renderId), eq(renders.projectId, data.projectId)));
}

export async function failRenderRecord(data: { renderId: string; projectId: string }) {
  await db
    .update(renders)
    .set({ status: "failed" })
    .where(and(eq(renders.id, data.renderId), eq(renders.projectId, data.projectId)));
}

export async function getRenderById(projectId: string, renderId: string) {
  const [render] = await db
    .select()
    .from(renders)
    .where(and(eq(renders.projectId, projectId), eq(renders.id, renderId)))
    .limit(1);

  return render ?? null;
}
