import { config } from "../config";
import { FsStore } from "./fs-store";
import { SupabaseStore } from "./supabase-store";
import type { Store } from "./types";

export type { Store, Collection } from "./types";

let _store: Store | null = null;

/** Singleton store — chọn driver theo STORE_DRIVER. */
export function store(): Store {
  if (_store) return _store;
  _store = config.store === "supabase" ? new SupabaseStore() : new FsStore();
  return _store;
}
