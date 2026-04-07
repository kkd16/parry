import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";

export interface Bookmark {
  id: string;
  name: string;
  qs: string;
}

export interface BookmarksApi {
  bookmarks: Bookmark[];
  add: (qs: string, name?: string) => Bookmark;
  remove: (id: string) => void;
  rename: (id: string, name: string) => void;
}

const STORAGE_KEY = "parry-bookmarks";

function autoName(qs: string): string {
  if (!qs) return "all events";
  const params = new URLSearchParams(qs);
  const parts: string[] = [];
  const action = params.get("action");
  const tool = params.get("tool");
  const binary = params.get("binary");
  const workdir = params.get("workdir");
  const time = params.get("time");
  const q = params.get("q");
  if (action) parts.push(action);
  if (tool) parts.push(tool);
  if (binary) parts.push(`bin:${binary}`);
  if (workdir) {
    const tail = workdir.split("/").filter(Boolean).pop() ?? workdir;
    parts.push(`dir:${tail}`);
  }
  if (time) parts.push(time);
  if (q) parts.push(`"${q}"`);
  if (parts.length === 0) return "filtered";
  return parts.join(" · ");
}

export function useBookmarks(): BookmarksApi {
  const [bookmarks, setBookmarks] = useLocalStorage<Bookmark[]>(STORAGE_KEY, []);

  const add = useCallback(
    (qs: string, name?: string) => {
      const bm: Bookmark = {
        id: Math.random().toString(36).slice(2, 10),
        name: name ?? autoName(qs),
        qs,
      };
      setBookmarks((prev) => [bm, ...prev]);
      return bm;
    },
    [setBookmarks],
  );

  const remove = useCallback(
    (id: string) => setBookmarks((prev) => prev.filter((b) => b.id !== id)),
    [setBookmarks],
  );

  const rename = useCallback(
    (id: string, name: string) =>
      setBookmarks((prev) => prev.map((b) => (b.id === id ? { ...b, name } : b))),
    [setBookmarks],
  );

  return { bookmarks, add, remove, rename };
}
