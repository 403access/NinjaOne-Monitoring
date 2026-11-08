import { useCallback, useEffect, useState } from "react";
import type { SavedView } from "../../shared/types";

function storageKey(page: string): string {
  return `signal.savedViews.${page}`;
}

function load(page: string): SavedView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(page));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedView[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useSavedViews(page: string) {
  const [views, setViews] = useState<SavedView[]>(() => load(page));

  useEffect(() => {
    setViews(load(page));
  }, [page]);

  const persist = useCallback(
    (next: SavedView[]) => {
      setViews(next);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey(page), JSON.stringify(next));
      }
    },
    [page],
  );

  const save = useCallback(
    (input: Omit<SavedView, "id" | "createdAt" | "page">) => {
      const view: SavedView = {
        ...input,
        id: `view_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        page,
        createdAt: Date.now(),
      };
      persist([view, ...views].slice(0, 20));
      return view;
    },
    [page, persist, views],
  );

  const remove = useCallback(
    (id: string) => {
      persist(views.filter((view) => view.id !== id));
    },
    [persist, views],
  );

  return { views, save, remove };
}
