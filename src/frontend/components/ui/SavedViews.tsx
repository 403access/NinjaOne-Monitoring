import { Bookmark, Check, Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { SavedView } from "../../../shared/types";
import { cn } from "../../lib/cn";

export function SavedViews({
  views,
  onApply,
  onSave,
  onRemove,
  className,
}: {
  views: SavedView[];
  onApply: (view: SavedView) => void;
  onSave: (name: string) => void;
  onRemove: (id: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className={cn("saved-views", className)} ref={rootRef}>
      <button type="button" className={cn("btn btn--secondary btn--md", open && "is-open")} onClick={() => setOpen((value) => !value)}>
        <Bookmark size={15} aria-hidden />
        Ansichten
        {views.length > 0 ? <span className="saved-views__count">{views.length}</span> : null}
      </button>
      {open ? (
        <div className="saved-views__menu">
          {views.length === 0 ? (
            <div className="saved-views__empty">Noch keine gespeicherte Ansicht.</div>
          ) : (
            views.map((view) => (
              <div key={view.id} className="saved-views__row">
                <button
                  type="button"
                  className="saved-views__item"
                  onClick={() => {
                    onApply(view);
                    setOpen(false);
                  }}
                >
                  <Check size={13} aria-hidden />
                  <span>{view.name}</span>
                </button>
                <button
                  type="button"
                  className="saved-views__remove"
                  aria-label={`Ansicht ${view.name} löschen`}
                  onClick={() => onRemove(view.id)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
          <form
            className="saved-views__form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!name.trim()) return;
              onSave(name.trim());
              setName("");
              setOpen(false);
            }}
          >
            <input
              className="saved-views__input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Aktuelle Ansicht speichern …"
              aria-label="Name der Ansicht"
            />
            <button type="submit" className="icon-btn" aria-label="Ansicht speichern" disabled={!name.trim()}>
              {name.trim() ? <Plus size={14} /> : <X size={14} />}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
