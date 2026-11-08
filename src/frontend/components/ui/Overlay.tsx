import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn";
import { IconButton } from "./Primitives";

function useOverlayBehavior(open: boolean, onClose: () => void) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => closeRef.current?.focus(), 30);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus?.();
    };
  }, [open, onClose]);
  return closeRef;
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = "default",
  headerExtra,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: "default" | "wide";
  headerExtra?: ReactNode;
}) {
  const closeRef = useOverlayBehavior(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside
        className={cn("drawer", width === "wide" && "drawer--wide")}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : "Details"}
      >
        <header className="drawer__header">
          <div className="drawer__heading">
            <div>
              <h2>{title}</h2>
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
            {headerExtra}
          </div>
          <IconButton ref={closeRef} icon={X} label="Schließen" onClick={onClose} />
        </header>
        <div className="drawer__body">{children}</div>
        {footer ? <footer className="drawer__footer">{footer}</footer> : null}
      </aside>
    </div>,
    document.body,
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const closeRef = useOverlayBehavior(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="overlay overlay--center" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={cn("modal", `modal--${size}`)} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : "Dialog"}>
        <header className="modal__header">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <IconButton ref={closeRef} icon={X} label="Schließen" onClick={onClose} />
        </header>
        <div className="modal__body">{children}</div>
        {footer ? <footer className="modal__footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Bestätigen",
  tone = "danger",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  tone?: "danger" | "primary";
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn--ghost btn--md" onClick={onClose}>
            Abbrechen
          </button>
          <button
            type="button"
            className={cn("btn", tone === "danger" ? "btn--danger" : "btn--primary", "btn--md")}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="modal__text">{description}</p>
    </Modal>
  );
}
