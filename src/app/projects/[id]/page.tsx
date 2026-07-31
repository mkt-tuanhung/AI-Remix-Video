import { notFound } from "next/navigation";
import { getProject } from "@/lib/services";
import { ProjectView } from "@/components/ProjectView";
import { StoryView } from "@/components/StoryView";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const project = await getProject(params.id);
  if (!project) notFound();
  if (project.kind === "story") return <StoryView projectId={params.id} />;
  return <ProjectView projectId={params.id} />;
}
