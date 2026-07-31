import { NextResponse } from "next/server";
import { getAnalysis, getPlanning, getProject, getSourceVideo, listJobs } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const project = await getProject(params.id);
  if (!project) return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });
  const [video, analysis, jobs, planning] = await Promise.all([
    getSourceVideo(project),
    getAnalysis(project.id),
    listJobs(project.id),
    getPlanning(project.id),
  ]);
  return NextResponse.json({ project, video, analysis, jobs, planning });
}
