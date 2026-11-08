import {
  AlertCircle,
  Check,
  ChevronDown,
  LoaderCircle,
  Search,
  type LucideIcon,
} from "lucide-react";
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { NODE_GROUP_LABEL, PRIORITY_LABEL, PRIORITY_SHORT, SEVERITY_LABEL, TASK_STATUS_LABEL } from "../../../shared/constants";
import type { NodeGroup, Priority, Severity, TaskStatus } from "../../../shared/types";
import { cn } from "../../lib/cn";
import { initials } from "../../lib/format";

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info" | "violet";

export function Badge({
  children,
  tone = "neutral",
  className,
  dot = false,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span className={cn("badge", `badge--${tone}`, className)}>
      {dot ? <span className="badge__dot" aria-hidden /> : null}
      {children}
    </span>
  );
}

export function PriorityBadge({ priority, compact = false }: { priority: Priority; compact?: boolean }) {
  return (
    <span className={cn("priority", `priority--${priority.toLowerCase()}`)} title={PRIORITY_LABEL[priority]}>
      <span className="priority__bar" aria-hidden />
      {compact ? PRIORITY_SHORT[priority] : PRIORITY_LABEL[priority]}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const tone: Tone =
    severity === "CRITICAL" ? "danger" : severity === "MAJOR" ? "warning" : severity === "MODERATE" ? "info" : "neutral";
  return (
    <Badge tone={tone} dot>
      {SEVERITY_LABEL[severity]}
    </Badge>
  );
}

export function NodeGroupBadge({ group }: { group: NodeGroup }) {
  const tone: Tone =
    group === "server" ? "info" : group === "network" ? "violet" : group === "virtualization" ? "accent" : "neutral";
  return <Badge tone={tone}>{NODE_GROUP_LABEL[group]}</Badge>;
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const tone: Tone =
    status === "done" ? "success" : status === "in_progress" ? "info" : status === "blocked" ? "danger" : "neutral";
  return (
    <Badge tone={tone} dot>
      {TASK_STATUS_LABEL[status]}
    </Badge>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "soft";
type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: LucideIcon;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, icon: Icon, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn("btn", `btn--${variant}`, `btn--${size}`, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <LoaderCircle className="spin" size={16} aria-hidden /> : Icon ? <Icon size={16} aria-hidden /> : null}
      {children}
    </button>
  );
});

export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string }
>(function IconButton({ icon: Icon, label, className, ...props }, ref) {
  return (
    <button ref={ref} type="button" className={cn("icon-btn", className)} aria-label={label} title={label} {...props}>
      <Icon size={17} aria-hidden />
    </button>
  );
});

export function Panel({
  children,
  className,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  return <Tag className={cn("panel", className)}>{children}</Tag>;
}

export function PanelHeader({
  title,
  subtitle,
  action,
  icon: Icon,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <header className="panel__header">
      <div className="panel__title-wrap">
        {Icon ? (
          <span className="panel__icon">
            <Icon size={17} aria-hidden />
          </span>
        ) : null}
        <div>
          <h2 className="panel__title">{title}</h2>
          {subtitle ? <p className="panel__subtitle">{subtitle}</p> : null}
        </div>
      </div>
      {action ? <div className="panel__action">{action}</div> : null}
    </header>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { icon?: LucideIcon }>(
  function Input({ icon: Icon, className, ...props }, ref) {
    return (
      <label className={cn("input", className)}>
        {Icon ? <Icon size={16} className="input__icon" aria-hidden /> : null}
        <input ref={ref} {...props} />
      </label>
    );
  },
);

export function SearchInput(props: InputHTMLAttributes<HTMLInputElement> & { className?: string }) {
  return <Input icon={Search} type="search" placeholder="Suchen …" {...props} />;
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <label className={cn("select", className)}>
      <select {...props}>{children}</select>
      <ChevronDown size={14} className="select__chevron" aria-hidden />
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("toggle-row", disabled && "is-disabled")}>
      <span>
        <span className="toggle-row__label">{label}</span>
        {description ? <span className="toggle-row__description">{description}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={cn("switch", checked && "is-on")}
        onClick={() => onChange(!checked)}
        disabled={disabled}
      >
        <span className="switch__thumb">{checked ? <Check size={11} /> : null}</span>
      </button>
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "md",
  ariaLabel,
}: {
  value: T;
  options: Array<{ value: T; label: string; icon?: LucideIcon }>;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  ariaLabel?: string;
}) {
  return (
    <div className={cn("segmented", `segmented--${size}`)} role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            className={cn("segmented__item", value === option.value && "is-active")}
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
          >
            {Icon ? <Icon size={14} aria-hidden /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Progress({
  value,
  tone = "accent",
  className,
  label,
}: {
  value: number;
  tone?: Tone;
  className?: string;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn("progress", `progress--${tone}`, className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <span className="progress__fill" style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function EmptyState({
  icon: Icon = AlertCircle,
  title,
  description,
  action,
  compact = false,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn("empty", compact && "empty--compact")}>
      <span className="empty__icon">
        <Icon size={22} aria-hidden />
      </span>
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action ? <div className="empty__action">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("skeleton", className)} aria-hidden>
      {Array.from({ length: lines }).map((_, index) => (
        <span key={index} style={{ width: `${90 - index * 12}%` }} />
      ))}
    </div>
  );
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.36 }} title={name}>
      {initials(name)}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

export function InlineError({ children }: { children: ReactNode }) {
  return (
    <div className="inline-error">
      <AlertCircle size={16} aria-hidden />
      <span>{children}</span>
    </div>
  );
}
