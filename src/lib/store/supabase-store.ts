import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config";
import type { Collection, Store } from "./types";

// Adapter Supabase: mỗi Collection = 1 bảng cùng tên (xem supabase/schema.sql).
// Dùng service role key ở server. Chỉ khởi tạo khi STORE_DRIVER=supabase.

export class SupabaseStore implements Store {
  private db: SupabaseClient;

  constructor() {
    if (!config.supabase.url || !config.supabase.serviceKey) {
      throw new Error(
        "STORE_DRIVER=supabase nhưng thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY"
      );
    }
    this.db = createClient(config.supabase.url, config.supabase.serviceKey, {
      auth: { persistSession: false },
    });
  }

  async insert<T extends { id: string }>(c: Collection, record: T): Promise<T> {
    const { data, error } = await this.db.from(c).insert(record).select().single();
    if (error) throw new Error(`[${c}.insert] ${error.message}`);
    return data as T;
  }

  async upsert<T extends { id: string }>(c: Collection, record: T): Promise<T> {
    const { data, error } = await this.db.from(c).upsert(record).select().single();
    if (error) throw new Error(`[${c}.upsert] ${error.message}`);
    return data as T;
  }

  async get<T extends { id: string }>(c: Collection, id: string): Promise<T | null> {
    const { data, error } = await this.db.from(c).select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`[${c}.get] ${error.message}`);
    return (data as T) ?? null;
  }

  async update<T extends { id: string }>(
    c: Collection,
    id: string,
    patch: Partial<T>
  ): Promise<T> {
    const { data, error } = await this.db
      .from(c)
      .update(patch as Record<string, unknown>)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(`[${c}.update] ${error.message}`);
    return data as T;
  }

  async list<T extends { id: string }>(c: Collection, filter?: Partial<T>): Promise<T[]> {
    let q = this.db.from(c).select("*");
    if (filter) {
      for (const [k, v] of Object.entries(filter)) q = q.eq(k, v as any);
    }
    const { data, error } = await q;
    if (error) throw new Error(`[${c}.list] ${error.message}`);
    return (data as T[]) ?? [];
  }

  async remove(c: Collection, id: string): Promise<void> {
    const { error } = await this.db.from(c).delete().eq("id", id);
    if (error) throw new Error(`[${c}.remove] ${error.message}`);
  }
}
