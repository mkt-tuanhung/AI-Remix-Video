import { notFound } from "next/navigation";
import { getProject } from "@/lib/services";
import { ProjectView } from "@/components/ProjectView";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const project = await getProject(params.id);
  if (!project) notFound();
  return <ProjectView projectId={params.id} />;
}
