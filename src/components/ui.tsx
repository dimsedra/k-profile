import type { ReactNode } from "react";
import { cn } from "../utils/cn";
import { tierOf, roleLabel, type Idol } from "../engine/ovr";

/* --------------------------- search input --------------------------- */

export function SearchInput({
  value,
  onChange,
  onKeyDown,
  onFocus,
  onBlur,
  placeholder,
  ariaLabel,
  inputId,
  role,
  ariaExpanded,
  ariaControls,
  className,
  dense = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  ariaLabel: string;
  inputId?: string;
  role?: string;
  ariaExpanded?: boolean;
  ariaControls?: string;
  className?: string;
  dense?: boolean;
}) {
  return (
    <div className={cn("relative", className)}>
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        fill="none"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist"
      >
        <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.8" />
        <path d="M13.5 13.5 17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <input
        id={inputId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        aria-label={ariaLabel}
        role={role}
        aria-expanded={ariaExpanded}
        aria-controls={ariaControls}
        autoComplete="off"
        className={cn(
          "w-full rounded-xl border border-line bg-paper placeholder:text-mist/60 focus:border-punch/50 focus:outline-none focus:ring-2 focus:ring-punch/15",
          dense ? "py-1.5 pl-9 pr-8 text-[14px] shadow-none" : "py-2.5 pl-9 pr-9 text-[15px] shadow-sm"
        )}
      />
      {value && (
        <button
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-sleeve text-[11px] text-mist hover:bg-line hover:text-ink"
        >
          ✕
        </button>
      )}
    </div>
  );
}

/* ---------------------------- OVR badge --------------------------- */

export function OvrBadge({
  ovr,
  size = "md",
  className,
}: {
  ovr: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const tier = tierOf(ovr);
  const palette =
    tier === "holo"
      ? "foil text-white"
      : tier === "prism"
        ? "bg-punch text-white"
        : tier === "core"
          ? "bg-holo text-white"
          : "bg-paper text-ink border border-line";
  const sizing =
    size === "sm"
      ? "min-w-9 px-1.5 py-0.5 text-[13px] rounded-md"
      : size === "md"
        ? "min-w-11 px-2 py-1 text-base rounded-lg"
        : "min-w-14 px-2.5 py-1.5 text-2xl rounded-xl";
  return (
    <span
      className={cn(
        "font-display font-bold inline-flex items-center justify-center tnum leading-none",
        palette,
        sizing,
        className
      )}
    >
      {ovr}
    </span>
  );
}

/* --------------------------- stat tone ---------------------------- */

/** Color tier for a rounded 40–99 stat value, shared by tables. */
export function statTone(v: number) {
  const r = Math.round(v);
  if (r >= 90) return "text-punch font-semibold";
  if (r >= 80) return "text-holo font-semibold";
  if (r < 65) return "text-mist";
  return "";
}

/* --------------------------- portraits ---------------------------- */

export function Portrait({
  idol,
  className,
}: {
  idol: Pick<Idol, "stageName" | "photo">;
  className?: string;
}) {
  if (idol.photo) {
    return (
      <img
        src={idol.photo}
        alt={`${idol.stageName} portrait`}
        className={cn("object-cover", className)}
      />
    );
  }
  return (
    <div
      className={cn(
        "bg-gradient-to-br from-holo-soft via-sleeve to-punch-soft flex items-center justify-center",
        className
      )}
    >
      <span className="font-display font-bold text-mist text-3xl">
        {idol.stageName.slice(0, 2)}
      </span>
    </div>
  );
}

/* --------------------------- photocard ---------------------------- */

export function PhotoCard({
  idol,
  ovr,
  href,
  className,
  settle = false,
}: {
  idol: Idol;
  ovr: number;
  href?: string;
  className?: string;
  settle?: boolean;
}) {
  const tier = tierOf(ovr);
  const holo = tier === "holo";

  const card = (
    <div
      className={cn(
        "relative aspect-[2/3] w-full overflow-hidden rounded-[14px] bg-paper",
        !holo && "ring-1 ring-line"
      )}
    >
      <Portrait idol={idol} className="absolute inset-0 h-full w-full" />
      {holo && (
        <div className="foil-sheen pointer-events-none absolute inset-0" aria-hidden />
      )}
      <div
        className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-ink/85 via-ink/35 to-transparent"
        aria-hidden
      />
      <OvrBadge ovr={ovr} size="md" className="absolute left-3 top-3 shadow-sm" />
      <div className="absolute inset-x-0 bottom-0 p-3.5">
        <p className="font-display font-bold text-white text-lg leading-tight">
          {idol.stageName}
        </p>
        <p className="text-white/75 text-[13px] mt-0.5">{idol.group}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {idol.roles.slice(0, 3).map((r, i) => (
            <span
              key={r}
              className="inline-flex items-center gap-1 rounded-md bg-white/15 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm"
            >
              <span className="text-white/60 tnum">{i + 1}</span>
              {roleLabel(r)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  const framed = holo ? (
    <div className={cn("foil rounded-[17px] p-[3px]", settle && "card-settle", className)}>
      {card}
    </div>
  ) : (
    <div className={cn(settle && "card-settle", className)}>{card}</div>
  );

  if (!href) return framed;
  return (
    <a href={href} className="block rounded-[17px] focus-visible:outline-punch">
      {framed}
    </a>
  );
}

/* ---------------------------- stat bar ---------------------------- */

export function StatBar({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  const rounded = Math.round(value);
  const fill =
    rounded >= 90 ? "bg-punch" : rounded >= 80 ? "bg-holo" : "bg-ink/45";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className={cn("text-[13px]", strong ? "font-semibold" : "text-mist")}>
          {label}
        </span>
        <span className={cn("tnum text-[13px]", strong ? "font-display font-semibold" : "font-semibold")}>
          {rounded}
        </span>
      </div>
      <div className={cn("mt-1 rounded-full bg-line", strong ? "h-2" : "h-1.5")}>
        <div
          className={cn("h-full rounded-full", fill)}
          style={{ width: `${Math.max(2, Math.min(100, ((rounded - 40) / 59) * 100))}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------ panel ------------------------------ */

export function Panel({
  title,
  children,
  className,
  aside,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  aside?: ReactNode;
}) {
  return (
    <section className={cn("rounded-2xl border border-line bg-paper p-5", className)}>
      {(title || aside) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="font-display font-semibold text-[15px]">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}
