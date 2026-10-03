import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const STORAGE_ROOT = path.join(process.cwd(), "storage");

function cleanName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function getProjectDir(projectId: string) {
  return path.join(STORAGE_ROOT, "projects", projectId);
}

export async function ensureProjectDirs(projectId: string) {
  const root = getProjectDir(projectId);
  const uploads = path.join(root, "uploads");
  const outputs = path.join(root, "outputs");
  const temp = path.join(root, "temp");

  await mkdir(uploads, { recursive: true });
  await mkdir(outputs, { recursive: true });
  await mkdir(temp, { recursive: true });

  return { root, uploads, outputs, temp };
}

export async function persistUploadFile(projectId: string, file: File, assetId: string) {
  const dirs = await ensureProjectDirs(projectId);
  const ext = path.extname(file.name) || "";
  const base = cleanName(path.basename(file.name, ext));
  const targetName = `${assetId}_${base}${ext}`;
  const targetPath = path.join(dirs.uploads, targetName);

  const bytes = await file.arrayBuffer();
  await writeFile(targetPath, Buffer.from(bytes));

  return {
    targetPath,
    targetName,
  };
}
