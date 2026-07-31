import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Collection, Store } from "./types";

// Store filesystem: mỗi collection là 1 file JSON (mảng bản ghi) dưới .data/.
// Ghi tuần tự qua hàng đợi promise để tránh race trong cùng process.

// Prod: STORAGE_DIR/data trên ổ đĩa bền. Dev: ./.data trong repo.
const DATA_DIR = process.env.STORAGE_DIR
  ? path.join(process.env.STORAGE_DIR, "data")
  : path.join(process.cwd(), ".data");

function fileFor(c: Collection): string {
  return path.join(DATA_DIR, `${c}.json`);
}

// Khoá ghi theo từng collection.
const locks = new Map<Collection, Promise<unknown>>();

async function withLock<T>(c: Collection, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(c) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((r) => (release = r));
  locks.set(c, prev.then(() => next));
  try {
    await prev;
    return await fn();
  } finally {
    release();
  }
}

async function readAll<T>(c: Collection): Promise<T[]> {
  try {
    const raw = await fs.readFile(fileFor(c), "utf8");
    return JSON.parse(raw) as T[];
  } catch (e: any) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
}

async function writeAll<T>(c: Collection, rows: T[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  // Tmp filename duy nhất mỗi lần ghi -> không đụng nhau nếu có ghi song song.
  const tmp = `${fileFor(c)}.${randomUUID().slice(0, 8)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(rows, null, 2), "utf8");
  await fs.rename(tmp, fileFor(c));
}

function matches<T extends object>(row: T, filter?: Partial<T>): boolean {
  if (!filter) return true;
  return Object.entries(filter).every(([k, v]) => (row as any)[k] === v);
}

export class FsStore implements Store {
  async insert<T extends { id: string }>(c: Collection, record: T): Promise<T> {
    return withLock(c, async () => {
      const rows = await readAll<T>(c);
      if (rows.some((r) => r.id === record.id)) {
        throw new Error(`Duplicate id ${record.id} in ${c}`);
      }
      rows.push(record);
      await writeAll(c, rows);
      return record;
    });
  }

  async upsert<T extends { id: string }>(c: Collection, record: T): Promise<T> {
    return withLock(c, async () => {
      const rows = await readAll<T>(c);
      const i = rows.findIndex((r) => r.id === record.id);
      if (i >= 0) rows[i] = record;
      else rows.push(record);
      await writeAll(c, rows);
      return record;
    });
  }

  async get<T extends { id: string }>(c: Collection, id: string): Promise<T | null> {
    const rows = await readAll<T>(c);
    return rows.find((r) => r.id === id) ?? null;
  }

  async update<T extends { id: string }>(
    c: Collection,
    id: string,
    patch: Partial<T>
  ): Promise<T> {
    return withLock(c, async () => {
      const rows = await readAll<T>(c);
      const i = rows.findIndex((r) => r.id === id);
      if (i < 0) throw new Error(`Not found ${id} in ${c}`);
      rows[i] = { ...rows[i], ...patch };
      await writeAll(c, rows);
      return rows[i];
    });
  }

  async list<T extends { id: string }>(c: Collection, filter?: Partial<T>): Promise<T[]> {
    const rows = await readAll<T>(c);
    return rows.filter((r) => matches(r as object, filter as any));
  }

  async remove(c: Collection, id: string): Promise<void> {
    return withLock(c, async () => {
      const rows = await readAll<{ id: string }>(c);
      await writeAll(
        c,
        rows.filter((r) => r.id !== id)
      );
    });
  }
}
