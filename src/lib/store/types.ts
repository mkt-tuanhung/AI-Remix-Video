// Interface store dùng chung cho cả filesystem lẫn Supabase.
// Mọi bản ghi đều có `id: string`.

export type Collection =
  | "projects"
  | "source_videos"
  | "source_analyses" // id = project_id
  | "jobs"
  | "content_strategies" // id = project_id (mảng nằm trong doc)
  | "hooks" // id = project_id
  | "variants"
  | "scenes"
  | "assets"
  | "audio_mixes" // id = variant_id
  | "quality_reports" // id = variant_id
  | "renders" // id = variant_id
  | "brand_presets"
  | "batches";

export interface Store {
  insert<T extends { id: string }>(c: Collection, record: T): Promise<T>;
  upsert<T extends { id: string }>(c: Collection, record: T): Promise<T>;
  get<T extends { id: string }>(c: Collection, id: string): Promise<T | null>;
  update<T extends { id: string }>(
    c: Collection,
    id: string,
    patch: Partial<T>
  ): Promise<T>;
  list<T extends { id: string }>(
    c: Collection,
    filter?: Partial<T>
  ): Promise<T[]>;
  remove(c: Collection, id: string): Promise<void>;
}
