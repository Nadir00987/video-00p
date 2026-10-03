import { createProject, getProjectFull } from "@/backend/repo";
import { makeId } from "@/backend/ids";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const id = makeId("proj");
  const created = await createProject({
    id,
    name: body.name?.trim() || `New Project ${new Date().toLocaleTimeString()}`,
  });

  return Response.json(created, { status: 201 });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) {
    return Response.json({ error: "projectId is required" }, { status: 400 });
  }

  const full = await getProjectFull(projectId);
  if (!full) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  return Response.json(full);
}
