import { useEffect, useRef, useState } from "react";
import { cn } from "../utils/cn";
import type { Route } from "../router";
import { useStore } from "../store";
import { SearchBox } from "./SearchBox";

const LINKS: { label: string; href: string; match: string[] }[] = [
  { label: "Home", href: "#/", match: ["home"] },
  { label: "Scouting Table", href: "#/table", match: ["table"] },
  { label: "Photocards", href: "#/binder", match: ["binder", "idol", "group"] },
  { label: "Compare", href: "#/compare", match: ["compare"] },
];

export function NavBar({ route }: { route: Route }) {
  const { userEmail, isAdmin } = useStore();
  const [addOpen, setAddOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const addActive = route.name === "add" || route.name === "edit" || route.name === "addGroup";

  useEffect(() => {
    if (!addOpen && !menuOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (addRef.current && !addRef.current.contains(e.target as Node)) setAddOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAddOpen(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [addOpen, menuOpen]);

  // Always land on the new page with the mobile menu closed.
  useEffect(() => {
    setMenuOpen(false);
  }, [route.name]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = Array.from(
      addRef.current?.querySelectorAll('[role="menuitem"]') ?? []
    ) as HTMLElement[];
    if (items.length === 0) return;
    const idx = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "ArrowDown" ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
    items[next].focus();
  };
  return (
    <header ref={menuRef} className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6 md:flex-nowrap">
        <a href="#/" className="order-1 flex items-baseline gap-2 shrink-0">
          <span className="font-display font-extrabold tracking-tight text-[17px]">
            K-PROFILE
          </span>
          <span className="hidden text-[12px] text-mist md:inline">
            Scouting & Idol Database
          </span>
        </a>
        <div
          className="order-3 min-w-0 basis-full md:order-2 md:basis-auto md:flex-1"
          onFocus={() => setMenuOpen(false)}
        >
          <SearchBox />
        </div>
        <div className="order-2 ml-auto md:hidden">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink hover:bg-sleeve"
          >
            <span aria-hidden className="relative block h-4 w-5">
              <span
                className={cn(
                  "absolute left-0 top-0 h-0.5 w-full rounded bg-current transition-transform",
                  menuOpen && "translate-y-[7px] rotate-45"
                )}
              />
              <span
                className={cn(
                  "absolute left-0 top-[7px] h-0.5 w-full rounded bg-current transition-opacity",
                  menuOpen && "opacity-0"
                )}
              />
              <span
                className={cn(
                  "absolute left-0 top-[14px] h-0.5 w-full rounded bg-current transition-transform",
                  menuOpen && "-translate-y-[7px] -rotate-45"
                )}
              />
            </span>
          </button>
        </div>
        <nav aria-label="Primary" className="order-4 ml-auto hidden items-center justify-end gap-1 md:flex">
          {LINKS.map((l) => {
            const active = l.match.includes(route.name);
            return (
              <a
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "whitespace-nowrap rounded-lg px-3 py-1.5 text-[14px] font-medium transition-colors",
                  active
                    ? "bg-ink text-white"
                    : "text-mist hover:bg-sleeve hover:text-ink"
                )}
              >
                {l.label}
              </a>
            );
          })}
          {isAdmin && (
          <div ref={addRef} className="relative shrink-0">
            <button
              onClick={() => setAddOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={addOpen}
              className={cn(
                "whitespace-nowrap rounded-lg px-3 py-1.5 text-[14px] font-semibold transition-colors",
                addActive
                  ? "bg-punch text-white"
                  : "bg-punch/10 text-punch hover:bg-punch hover:text-white"
              )}
            >
              + Add
            </button>
            {addOpen && (
              <div
                role="menu"
                aria-label="Add"
                onKeyDown={onMenuKey}
                className="absolute right-0 top-full z-50 mt-1.5 w-40 overflow-hidden rounded-xl border border-line bg-paper py-1 shadow-lg"
              >
                <a
                  role="menuitem"
                  href="#/add"
                  onClick={() => setAddOpen(false)}
                  className="block px-4 py-2 text-[14px] font-medium hover:bg-sleeve"
                >
                  Idol
                </a>
                <a
                  role="menuitem"
                  href="#/add-group"
                  onClick={() => setAddOpen(false)}
                  className="block px-4 py-2 text-[14px] font-medium hover:bg-sleeve"
                >
                  Group
                </a>
              </div>
            )}
          </div>
          )}
          <a
            href="#/login"
            aria-current={route.name === "login" ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-lg px-3 py-1.5 text-[14px] font-medium transition-colors",
              route.name === "login"
                ? "bg-ink text-white"
                : "text-mist hover:bg-sleeve hover:text-ink"
            )}
          >
            {userEmail ? (isAdmin ? "Admin" : "Account") : "Sign in"}
          </a>
          {isAdmin && (
          <a
            href="#/settings"
            aria-current={route.name === "settings" ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-lg px-3 py-1.5 text-[14px] font-medium transition-colors",
              route.name === "settings"
                ? "bg-ink text-white"
                : "text-mist hover:bg-sleeve hover:text-ink"
            )}
          >
            Settings
          </a>
          )}
        </nav>
      </div>
      {menuOpen && (
        <div id="mobile-menu" className="absolute inset-x-0 top-full z-50 max-h-[70dvh] overflow-y-auto border-t border-line bg-paper shadow-lg md:hidden">
          <nav aria-label="Mobile" className="mx-auto max-w-7xl space-y-1 px-4 py-3 sm:px-6">
            {LINKS.map((l) => {
              const active = l.match.includes(route.name);
              return (
                <a
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "block rounded-lg px-4 py-3 text-[15px] font-medium transition-colors",
                    active
                      ? "bg-ink text-white"
                      : "text-mist hover:bg-sleeve hover:text-ink"
                  )}
                >
                  {l.label}
                </a>
              );
            })}
            {isAdmin && (
              <>
                <p className="px-4 pb-1 pt-3 text-[12px] font-semibold uppercase tracking-widest text-mist">
                  Add
                </p>
                <a
                  href="#/add"
                  aria-current={addActive ? "page" : undefined}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "block rounded-lg px-4 py-3 text-[15px] font-medium transition-colors",
                    addActive
                      ? "bg-punch text-white"
                      : "text-mist hover:bg-sleeve hover:text-ink"
                  )}
                >
                  Idol
                </a>
                <a
                  href="#/add-group"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-4 py-3 text-[15px] font-medium text-mist transition-colors hover:bg-sleeve hover:text-ink"
                >
                  Group
                </a>
              </>
            )}
            <a
              href="#/login"
              aria-current={route.name === "login" ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
              className={cn(
                "block rounded-lg px-4 py-3 text-[15px] font-medium transition-colors",
                route.name === "login"
                  ? "bg-ink text-white"
                  : "text-mist hover:bg-sleeve hover:text-ink"
              )}
            >
              {userEmail ? (isAdmin ? "Admin" : "Account") : "Sign in"}
            </a>
            {isAdmin && (
              <a
                href="#/settings"
                aria-current={route.name === "settings" ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "block rounded-lg px-4 py-3 text-[15px] font-medium transition-colors",
                  route.name === "settings"
                    ? "bg-ink text-white"
                    : "text-mist hover:bg-sleeve hover:text-ink"
                )}
              >
                Settings
              </a>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
