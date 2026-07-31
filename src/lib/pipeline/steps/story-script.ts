import type { StepContext } from "../context";
import { store } from "../../store";
import type { ContentVariant, Project } from "../../types";
import { writeStoryScript } from "../../providers/story";
import { nowISO, uid } from "../../util";

// STORY_SCRIPT — viết kịch bản narration từ nội dung/truyện đầu vào.
export async function storyScript(ctx: StepContext): Promise<void> {
  const { project } = ctx;
  const lang = project.output_language ?? "en";
  const genre = project.genre ?? "2d";

  await ctx.setProgress(0.3, "Viết kịch bản từ nội dung");
  const res = await writeStoryScript(project.story_text ?? "", genre, lang, project.target_duration_seconds);

  const existing = await store().list<ContentVariant>("variants", { project_id: project.id } as Partial<ContentVariant>);
  const variant: ContentVariant = {
    id: existing[0]?.id ?? uid("var"),
    project_id: project.id,
    platform: project.target_platforms[0] ?? "youtube_shorts",
    target_duration_seconds: project.target_duration_seconds,
    content_angle: genre,
    hook: "",
    script: res.script,
    cta: "",
    voice_style: "story",
    is_master: true,
    label: "Bản gốc",
    status: "DRAFT",
    created_at: existing[0]?.created_at ?? nowISO(),
  };
  await store().upsert<ContentVariant>("variants", variant);

  // Cập nhật tiêu đề dự án nếu đang trống/placeholder.
  if (!project.title || project.title === "Phim từ truyện") {
    await store().update<Project>("projects", project.id, { title: res.title });
  }
  await store().update<Project>("projects", project.id, { status: "BUILDING_STORYBOARD", updated_at: nowISO() });
  await ctx.setProgress(1, `Đã viết kịch bản (${res.provider})`);
}
