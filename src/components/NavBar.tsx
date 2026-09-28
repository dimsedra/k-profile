import { cn } from "../utils/cn";
import type { Route } from "../router";
import { useStore } from "../store";

const LINKS: { label: string; href: string; match: string[] }[] = [
  { label: "Home", href: "#/", match: ["home"] },
  { label: "Scouting Table", href: "#/table", match: ["table"] },
  { label: "Photocards", href: "#/binder", match: ["binder", "idol", "group"] },
];

export function NavBar({ route }: { route: Route }) {
  const { userEmail, isAdmin } = useStore();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <a href="#/" className="flex items-baseline gap-2 shrink-0">
          <span className="font-display font-extrabold tracking-tight text-[17px]">
            K-PROFILE
          </span>
          <span className="hidden text-[12px] text-mist md:inline">
            Scouting & Idol Database
          </span>
        </a>
        <nav className="ml-auto flex items-center gap-1 overflow-x-auto">
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
          <a
            href="#/add"
            className={cn(
              "whitespace-nowrap rounded-lg px-3 py-1.5 text-[14px] font-semibold transition-colors",
              route.name === "add" || route.name === "edit"
                ? "bg-punch text-white"
                : "bg-punch/10 text-punch hover:bg-punch hover:text-white"
            )}
          >
            + Add Idol
          </a>
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
        </nav>
      </div>
    </header>
  );
}
