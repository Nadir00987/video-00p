"use client";

import { useMemo, useState } from "react";

type Settings = {
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

type ProjectPayload = {
  project: {
    id: string;
    name: string;
    progressStage: string;
    progressLog: string[];
    analysis: Record<string, unknown> | null;
    editPlan: Record<string, unknown> | null;
    settings: Settings;
  };
  assets: Array<{
    id: string;
    role: string;
    originalName: string;
    mimeType: string;
    metadata: Record<string, unknown>;
  }>;
  renders: Array<{
    id: string;
    status: string;
    resolution: string;
    fileSizeMb: string | null;
    durationSec: string | null;
  }>;
};

const sidebarItems = ["Media", "AI Edit", "Captions", "Graphics", "Audio", "Effects"];

const defaultSettings: Settings = {
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

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data as T;
}

export default function AutoVideoEditor() {
  const [project, setProject] = useState<ProjectPayload | null>(null);
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [viewMode, setViewMode] = useState<"original" | "edited">("original");
  const [selectedDecision, setSelectedDecision] = useState<Record<string, unknown> | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  const mainVideo = useMemo(() => project?.assets.find((a) => a.role === "video") ?? null, [project]);
  const latestRender = useMemo(() => project?.renders[project.renders.length - 1] ?? null, [project]);

  const refreshProject = async (projectId: string) => {
    const full = await api<ProjectPayload>(`/api/projects/${projectId}`);
    setProject(full);
    setSettings(full.project.settings ?? defaultSettings);
  };

  const createProject = async () => {
    setBusy("Creating project...");
    setError("");
    try {
      const created = await api<ProjectPayload>("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `AI Auto Edit ${new Date().toLocaleString()}` }),
      });
      setProject(created);
      setSettings(created.project.settings ?? defaultSettings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create project");
    } finally {
      setBusy("");
    }
  };

  const uploadFiles = async (fileList: FileList | null) => {
    if (!project || !fileList?.length) return;
    setBusy("Uploading files...");
    setError("");

    try {
      const form = new FormData();
      Array.from(fileList).forEach((f) => form.append("files", f));

      await api(`/api/projects/${project.project.id}/upload`, {
        method: "POST",
        body: form,
      });

      await refreshProject(project.project.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy("");
    }
  };

  const runAnalyze = async () => {
    if (!project) return;
    setBusy("Analyzing video...");
    setError("");
    try {
      await api(`/api/projects/${project.project.id}/analyze`, { method: "POST" });
      await refreshProject(project.project.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setBusy("");
    }
  };

  const runAutoEdit = async () => {
    if (!project) return;
    setBusy("Generating AI edit...");
    setError("");
    try {
      await api(`/api/projects/${project.project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      await api(`/api/projects/${project.project.id}/auto-edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });

      await refreshProject(project.project.id);
      setViewMode("edited");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Auto edit failed");
    } finally {
      setBusy("");
    }
  };

  const runRender = async (resolution: "1080p" | "720p") => {
    if (!project) return;
    setBusy(`Rendering ${resolution.toUpperCase()}...`);
    setError("");
    try {
      await api(`/api/projects/${project.project.id}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution }),
      });
      await refreshProject(project.project.id);
      setViewMode("edited");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Render failed");
    } finally {
      setBusy("");
    }
  };

  const decisions = (project?.project.editPlan as { decisions?: Record<string, unknown> } | null)?.decisions ?? {};
  const captions = (decisions.captions as Array<Record<string, unknown>> | undefined) ?? [];
  const graphics = (decisions.graphics as Array<Record<string, unknown>> | undefined) ?? [];
  const cuts = (decisions.smartCuts as Array<Record<string, unknown>> | undefined) ?? [];

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold">AI Auto Video Editor</h1>
          <p className="text-xs text-slate-400">Upload → Analyze → ✨ Auto Edit → Render → Download</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950" onClick={createProject}>
            New Project
          </button>
          {project && <span className="text-xs text-slate-300">{project.project.name}</span>}
        </div>
      </header>

      <div className="grid grid-cols-[220px_1fr_300px] gap-0 border-b border-slate-800">
        <aside className="border-r border-slate-800 p-4">
          <div className="mb-3 text-xs uppercase text-slate-500">Tools</div>
          <div className="space-y-2">
            {sidebarItems.map((item) => (
              <div key={item} className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm">
                {item}
              </div>
            ))}
          </div>

          <div className="mt-5 space-y-2">
            <button
              disabled={!project || !mainVideo || !!busy}
              onClick={runAnalyze}
              className="w-full rounded-xl border border-slate-700 px-3 py-2 text-sm disabled:opacity-40"
            >
              Analyze Video
            </button>
            <button
              disabled={!project?.project.analysis || !!busy}
              onClick={runAutoEdit}
              className="w-full rounded-xl bg-violet-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              ✨ Auto Edit
            </button>
            <button
              disabled={!project?.project.editPlan || !!busy}
              onClick={runAutoEdit}
              className="w-full rounded-xl border border-violet-500 px-3 py-2 text-sm disabled:opacity-40"
            >
              Regenerate Edit
            </button>
          </div>
        </aside>

        <main className="p-5">
          {!project && (
            <div className="grid h-[520px] place-items-center rounded-2xl border border-dashed border-slate-700 bg-slate-900/30 text-center">
              <div>
                <p className="text-xl font-semibold">Create a new project</p>
                <p className="mt-2 text-sm text-slate-400">Then import raw footage, clips, audio, and images.</p>
              </div>
            </div>
          )}

          {project && (
            <>
              <label className="mb-4 grid h-28 cursor-pointer place-items-center rounded-2xl border border-dashed border-slate-600 bg-slate-900/30 text-center">
                <div>
                  <p className="text-sm font-semibold">DROP VIDEO HERE</p>
                  <p className="text-xs text-slate-400">or IMPORT MEDIA (MP4/MOV/WEBM/MP3/WAV/PNG/JPG)</p>
                </div>
                <input className="hidden" type="file" multiple onChange={(e) => uploadFiles(e.target.files)} />
              </label>

              <div className="mb-4 flex items-center gap-2">
                <button
                  className={`rounded-lg px-3 py-1 text-xs ${viewMode === "original" ? "bg-slate-700" : "bg-slate-900"}`}
                  onClick={() => setViewMode("original")}
                >
                  Original
                </button>
                <button
                  className={`rounded-lg px-3 py-1 text-xs ${viewMode === "edited" ? "bg-slate-700" : "bg-slate-900"}`}
                  onClick={() => setViewMode("edited")}
                >
                  AI Edited
                </button>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-black p-3">
                {viewMode === "original" && mainVideo && (
                  <video controls className="h-[360px] w-full rounded-xl" src={`/api/projects/${project.project.id}/assets/${mainVideo.id}`} />
                )}

                {viewMode === "edited" && latestRender?.status === "ready" && (
                  <video controls className="h-[360px] w-full rounded-xl" src={`/api/projects/${project.project.id}/download/${latestRender.id}`} />
                )}

                {viewMode === "edited" && latestRender?.status !== "ready" && (
                  <div className="grid h-[360px] place-items-center rounded-xl border border-slate-800 text-center text-slate-400">
                    <div>
                      <p>Render preview will appear here.</p>
                      <p className="text-xs">Run Render Video after Auto Edit.</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <button
                  disabled={!project.project.editPlan || !!busy}
                  onClick={() => runRender("1080p")}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"
                >
                  Render Video 1080P HD
                </button>
                <button
                  disabled={!project.project.editPlan || !!busy}
                  onClick={() => runRender("720p")}
                  className="rounded-xl border border-emerald-500 px-4 py-2 text-sm disabled:opacity-40"
                >
                  Render 720P
                </button>
              </div>

              {latestRender?.status === "ready" && (
                <div className="mt-3 rounded-xl border border-emerald-700 bg-emerald-950/30 p-3 text-sm">
                  <p className="font-semibold">Your video is ready</p>
                  <p className="text-xs text-emerald-200">
                    Resolution: {latestRender.resolution.toUpperCase()} • Duration: {latestRender.durationSec ?? "-"}s • File Size: {latestRender.fileSizeMb ?? "-"} MB
                  </p>
                  <a
                    className="mt-2 inline-block rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950"
                    href={`/api/projects/${project.project.id}/download/${latestRender.id}`}
                  >
                    Download {latestRender.resolution.toUpperCase()}
                  </a>
                </div>
              )}
            </>
          )}
        </main>

        <aside className="border-l border-slate-800 p-4">
          <div className="mb-3 text-xs uppercase text-slate-500">AI / Edit Properties</div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Editing Style</label>
              <select
                value={settings.style}
                onChange={(e) => setSettings({ ...settings, style: e.target.value as Settings["style"] })}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm"
              >
                {["Natural", "Clean", "Social Dynamic", "Figma Motion", "Educational", "High Energy"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Editing Intensity</label>
              <select
                value={settings.intensity}
                onChange={(e) => setSettings({ ...settings, intensity: e.target.value as Settings["intensity"] })}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm"
              >
                {["Low", "Medium", "High"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border border-slate-800 p-3">
              <p className="mb-2 text-xs text-slate-400">Auto Features</p>
              <div className="grid grid-cols-1 gap-1 text-xs">
                {Object.entries(settings.features).map(([key, value]) => (
                  <label key={key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          features: {
                            ...settings.features,
                            [key]: e.target.checked,
                          },
                        })
                      }
                    />
                    {key}
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 p-3 text-xs">
              <p className="font-semibold">AI Decision</p>
              {selectedDecision ? (
                <pre className="mt-2 overflow-auto text-[11px] text-slate-300">{JSON.stringify(selectedDecision, null, 2)}</pre>
              ) : (
                <p className="mt-2 text-slate-400">Select an item from the timeline to inspect AI reason.</p>
              )}
            </div>
          </div>
        </aside>
      </div>

      <section className="p-4">
        <p className="mb-2 text-xs uppercase text-slate-500">Timeline</p>
        <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
          <TimelineRow title="V1 Main Video" color="bg-cyan-500/60" items={cuts} onSelect={setSelectedDecision} />
          <TimelineRow title="V2 B-roll" color="bg-indigo-500/60" items={(decisions.brollSuggestions as Array<Record<string, unknown>>) ?? []} onSelect={setSelectedDecision} />
          <TimelineRow title="G1 Graphics" color="bg-violet-500/60" items={graphics} onSelect={setSelectedDecision} />
          <TimelineRow title="C1 Captions" color="bg-amber-500/60" items={captions} onSelect={setSelectedDecision} />
          <TimelineRow title="A1 Voice" color="bg-emerald-500/60" items={cuts} onSelect={setSelectedDecision} />
          <TimelineRow title="A2 SFX" color="bg-pink-500/60" items={(decisions.sfx as Array<Record<string, unknown>>) ?? []} onSelect={setSelectedDecision} />
          <TimelineRow title="A3 BGM" color="bg-blue-500/60" items={[(decisions.bgm as Record<string, unknown>) ?? {}]} onSelect={setSelectedDecision} />
        </div>

        <div className="mt-3 text-xs text-slate-400">
          Basic controls: Play/Pause in preview, regenerate edit, replace asset by re-uploading, remove items by skipping features + regenerate.
        </div>
      </section>

      <footer className="border-t border-slate-800 px-6 py-3 text-xs text-slate-400">
        {busy ? <span>{busy}</span> : <span>Ready</span>}
        {error && <span className="ml-3 text-rose-400">{error}</span>}
        {project && (
          <span className="ml-3 text-slate-500">
            Stage: {project.project.progressStage} • {project.project.progressLog?.slice(-1)[0] || "idle"}
          </span>
        )}
      </footer>
    </div>
  );
}

function TimelineRow({
  title,
  color,
  items,
  onSelect,
}: {
  title: string;
  color: string;
  items: Array<Record<string, unknown>>;
  onSelect: (item: Record<string, unknown>) => void;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-center gap-3">
      <div className="text-xs text-slate-300">{title}</div>
      <div className="flex min-h-8 flex-wrap gap-2 rounded-lg border border-slate-800 bg-slate-900/60 p-2">
        {items.length === 0 && <span className="text-[11px] text-slate-500">No items</span>}
        {items.map((item, i) => (
          <button
            key={`${title}_${i}`}
            className={`rounded px-2 py-1 text-[10px] text-white ${color}`}
            onClick={() => onSelect(item)}
            title={String(item.reason ?? "AI decision")}
          >
            {String(item.id ?? item.type ?? item.keyword ?? title)}
          </button>
        ))}
      </div>
    </div>
  );
}
