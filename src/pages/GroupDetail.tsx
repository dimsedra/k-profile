import { useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import { OvrBadge, Panel, PhotoCard, Portrait, StatBar, statTone } from "../components/ui";
import { CATEGORIES, computeOvr, ovrOf, roleLabel, type CategoryKey, type EngineConfig, type Idol } from "../engine/ovr";
import { navigate } from "../router";
import { cn } from "../utils/cn";

const inputCls =
  "w-full rounded-lg border border-line bg-paper px-3 py-2 text-[14px] placeholder:text-mist/60 focus:border-ink/40";
const labelCls = "mb-1.5 block text-[13px] font-semibold";

export function GroupDetail({ id }: { id: number }) {
  const {
    groups, groupStats, groupMemberIds, idols, config,
    ready, isAdmin, updateGroup, deleteGroup,
  } = useStore();
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [debutYear, setDebutYear] = useState("");
  const [agency, setAgency] = useState("");
  const [fandomName, setFandomName] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [error, setError] = useState("");
  const [removeError, setRemoveError] = useState("");
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [focus, setFocus] = useState({ x: 50, y: 50 });
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  const group = groups.find((g) => g.id === id);
  const memberIds = useMemo(() => new Set(groupMemberIds(id)), [groupMemberIds, id]);
  const members = useMemo(
    () => idols.filter((i) => memberIds.has(i.id)),
    [idols, memberIds]
  );
  const stats = group ? groupStats(id) : null;

  if (!ready) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="py-20 text-center font-display font-semibold">Loading group…</p>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
        <p className="font-display font-semibold">This group doesn't exist</p>
        <p className="mt-2 text-[14px] text-mist">
          The group may have been removed from the database.
        </p>
        <a href="#/binder" className="mt-4 inline-block font-semibold text-punch">
          Back to the binder
        </a>
      </div>
    );
  }

  const startEdit = () => {
    setBio(group.bio);
    setDebutYear(group.debutYear ? String(group.debutYear) : "");
    setAgency(group.agency);
    setFandomName(group.fandomName);
    setPhotoFile(null);
    setRemovePhoto(false);
    setError("");
    setEditing(true);
  };

  const pickFile = (file: File) => {
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setError("That file isn't a photo or video.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError("That file is over the 15 MB bucket cap. Compress it first.");
      return;
    }
    setPhotoFile(file);
    setRemovePhoto(false);
    setError("");
  };

  const moveFocus = (clientX: number, clientY: number) => {
    const rect = bannerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    setFocus({
      x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)),
    });
  };

  const saveFocus = async () => {
    setError("");
    setBusy(true);
    const msg = await updateGroup(
      group.id,
      {
        bio: group.bio,
        debutYear: group.debutYear,
        agency: group.agency,
        fandomName: group.fandomName,
        photoFocus: focus,
      }
    );
    setBusy(false);
    if (msg) return setError(msg);
    setAdjusting(false);
  };

  const save = async () => {
    setError("");
    setBusy(true);
    const msg = await updateGroup(
      group.id,
      {
        bio,
        debutYear: debutYear ? Number(debutYear) : undefined,
        agency,
        fandomName,
      },
      { photoFile, removePhoto }
    );
    setBusy(false);
    if (msg) return setError(msg);
    setEditing(false);
  };

  const facts: [string, string][] = [
    ["Debut year", group.debutYear ? String(group.debutYear) : ""],
    ["Agency", group.agency],
    ["Fandom", group.fandomName],
    ["Members", String(members.length)],
  ].filter(([, v]) => v !== "") as [string, string][];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Spotify-like artist header: wide banner, gradient, big name */}
      <div
        ref={bannerRef}
        onPointerDown={(e) => {
          if (!adjusting || !group.photo) return;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          setDragging(true);
          moveFocus(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (adjusting && dragging) moveFocus(e.clientX, e.clientY);
        }}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        className={
          adjusting && group.photo
            ? "relative cursor-move touch-none select-none overflow-hidden rounded-2xl border border-line"
            : "relative overflow-hidden rounded-2xl border border-line"
        }
      >
        {group.photo ? (
          <img
            src={group.photo}
            alt={`${group.name} banner`}
            draggable={false}
            className="h-56 w-full object-cover sm:h-72"
            style={{
              objectPosition: `${adjusting ? focus.x : group.photoFocus.x}% ${adjusting ? focus.y : group.photoFocus.y}%`,
            }}
          />
        ) : (
          <div className="flex h-56 w-full items-center justify-center bg-gradient-to-br from-holo-soft via-sleeve to-punch-soft sm:h-72">
            <span className="font-display text-6xl font-bold text-mist">
              {group.name.slice(0, 2)}
            </span>
          </div>
        )}
        <div
          className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/35 to-transparent"
          aria-hidden
        />
        {adjusting && (
          <p className="absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink/70 px-3 py-1 text-[12px] font-semibold text-white">
            Drag the photo to reposition
          </p>
        )}
        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end gap-4 p-5 sm:p-6">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold uppercase tracking-widest text-white/70">
              Group
            </p>
            <h1 className="font-display text-3xl font-extrabold text-white sm:text-4xl">
              {group.name}
            </h1>
          </div>
          <div className="ml-auto">
            {stats ? (
              <OvrBadge ovr={stats.ovr} size="lg" />
            ) : (
              <span className="text-white/70">—</span>
            )}
          </div>
        </div>
      </div>

      {isAdmin && !editing && !adjusting && (
        <>
          <div className="mt-4 flex gap-2">
            <button
              onClick={startEdit}
              className="rounded-lg bg-ink px-3 py-2 text-[14px] font-semibold text-white hover:bg-ink/90"
            >
              Edit group
            </button>
            {group.photo && (
              <button
                onClick={() => {
                  setFocus({ ...group.photoFocus });
                  setError("");
                  setAdjusting(true);
                }}
                className="rounded-lg border border-line bg-paper px-3 py-2 text-[14px] font-medium text-mist hover:text-ink"
              >
                Reposition cover
              </button>
            )}
            {confirmingRemove ? (
              <button
                onClick={() =>
                  void deleteGroup(group.id).then((msg) => {
                    if (msg) {
                      setRemoveError(msg);
                      setConfirmingRemove(false);
                    } else navigate("/binder");
                  })
                }
                disabled={members.length > 0}
                title={members.length > 0 ? "Remove or move all members first" : undefined}
                className="rounded-lg bg-punch px-3 py-2 text-[14px] font-semibold text-white disabled:opacity-40"
              >
                Confirm removal
              </button>
            ) : (
              <button
                onClick={() => setConfirmingRemove(true)}
                className="rounded-lg border border-line bg-paper px-3 py-2 text-[14px] font-medium text-mist hover:text-punch"
              >
                Remove
              </button>
            )}
          </div>
          {members.length > 0 && (
            <p className="mt-1.5 text-[12px] text-mist">
              Groups with members cannot be removed — move or remove the members first.
            </p>
          )}
          {removeError && (
            <p role="alert" className="mt-2 rounded-lg bg-punch-soft px-3 py-2 text-[13px] font-medium text-punch">
              {removeError}
            </p>
          )}
        </>
      )}

      {adjusting && (
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => void saveFocus()}
            disabled={busy}
            className="rounded-lg bg-punch px-4 py-2 text-[14px] font-semibold text-white hover:bg-punch/90 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save position"}
          </button>
          <button
            onClick={() => setAdjusting(false)}
            className="rounded-lg border border-line bg-paper px-4 py-2 text-[14px] font-medium text-mist hover:text-ink"
          >
            Cancel
          </button>
          {error && (
            <p role="alert" className="text-[13px] font-medium text-punch">{error}</p>
          )}
        </div>
      )}

      {editing && (
        <Panel className="mt-4" title="Edit group profile">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="g-debut">Debut year</label>
              <input
                id="g-debut" className={inputCls} type="number" value={debutYear}
                onChange={(e) => setDebutYear(e.target.value)} placeholder="2018"
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="g-agency">Agency</label>
              <input
                id="g-agency" className={inputCls} value={agency}
                onChange={(e) => setAgency(e.target.value)} placeholder="Starship"
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="g-fandom">Fandom name</label>
              <input
                id="g-fandom" className={inputCls} value={fandomName}
                onChange={(e) => setFandomName(e.target.value)} placeholder="DIVE"
              />
            </div>
            <div>
              <span className={labelCls}>Photo</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="rounded-lg border border-line bg-paper px-3 py-1.5 text-[13px] font-medium text-mist hover:text-ink"
                >
                  {photoFile ? photoFile.name : group.photo || group.photoPath ? "Replace photo" : "Upload photo"}
                </button>
                {(group.photo || photoFile) && (
                  <button
                    onClick={() => {
                      setPhotoFile(null);
                      setRemovePhoto(true);
                    }}
                    className="text-[12px] font-medium text-mist hover:text-punch"
                  >
                    Remove photo
                  </button>
                )}
              </div>
              <input
                ref={fileRef} type="file" accept="image/*,video/*" className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) pickFile(f);
                }}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="g-bio">Bio</label>
              <textarea
                id="g-bio" rows={3} className={inputCls} value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="What defines this group?"
              />
            </div>
          </div>
          {error && (
            <p role="alert" className="mt-3 rounded-lg bg-punch-soft px-3 py-2 text-[13px] font-medium text-punch">
              {error}
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => void save()}
              disabled={busy}
              className="rounded-lg bg-punch px-4 py-2 text-[14px] font-semibold text-white hover:bg-punch/90 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save group"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-lg border border-line bg-paper px-4 py-2 text-[14px] font-medium text-mist hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </Panel>
      )}

      {group.bio && (
        <Panel className="mt-4" title="Biography">
          <p className="text-[14px] leading-relaxed text-mist">{group.bio}</p>
        </Panel>
      )}

      <Panel className="mt-4" title="Profile">
        <dl className="space-y-2.5">
          {facts.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 text-[14px]">
              <dt className="text-mist">{k}</dt>
              <dd className="text-right font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      {stats ? (
        <Panel className="mt-4" title="Combined stats (popularity-weighted)">
          <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {CATEGORIES.map((c) => (
              <StatBar key={c.key} label={c.label} value={stats.cats[c.key]} strong />
            ))}
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-mist">
            Each member pulls the group average with {""}
            {stats.contributions
              .map((ct) => {
                const m = members.find((x) => x.id === ct.memberId);
                return `${m?.stageName ?? "?"} ${ct.weightPct}%`;
              })
              .join(" · ")}
            .
          </p>
        </Panel>
      ) : (
        <Panel className="mt-4" title="No members yet">
          <p className="text-[14px] text-mist">
            Add the first member to compute combined stats.
          </p>
          <a
            href="#/add"
            className="mt-3 inline-block rounded-lg bg-punch px-4 py-2 text-[14px] font-semibold text-white"
          >
            + Add Idol
          </a>
        </Panel>
      )}

      {members.length > 0 && (
        <>
          <h2 className="mt-10 font-display text-[16px] font-semibold">Members</h2>
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
            {members.map((m) => (
              <PhotoCard key={m.id} idol={m} ovr={ovrOf(m, config)} href={`#/idol/${m.id}`} />
            ))}
          </div>
          <MemberTable members={members} config={config} />
        </>
      )}
    </div>
  );
}

type MemberSortKey = "name" | "role" | CategoryKey | "pop" | "ovr";

const MEMBER_COLUMNS: { key: MemberSortKey; label: string; numeric?: boolean }[] = [
  { key: "name", label: "Stage Name" },
  { key: "role", label: "Primary Role" },
  { key: "vocal", label: "Vocal", numeric: true },
  { key: "rap", label: "Rap", numeric: true },
  { key: "dance", label: "Dance", numeric: true },
  { key: "stage", label: "Stage", numeric: true },
  { key: "visual", label: "Visual", numeric: true },
  { key: "pop", label: "Pop", numeric: true },
  { key: "ovr", label: "OVR", numeric: true },
];

function memberValue(
  row: { idol: Idol; cats: Record<CategoryKey, number>; ovr: number },
  key: MemberSortKey
): string | number {
  switch (key) {
    case "name":
      return row.idol.stageName.toLowerCase();
    case "role":
      return roleLabel(row.idol.roles[0] ?? "");
    case "pop":
      return row.idol.popularity;
    case "ovr":
      return row.ovr;
    default:
      return row.cats[key];
  }
}

function MemberTable({ members, config }: { members: Idol[]; config: EngineConfig }) {
  const [sort, setSort] = useState<{ key: MemberSortKey; dir: 1 | -1 }>({ key: "ovr", dir: -1 });

  const rows = useMemo(
    () =>
      members.map((idol) => {
        const b = computeOvr(idol, config);
        return { idol, cats: b.cats, ovr: b.ovr };
      }),
    [members, config]
  );

  const visible = useMemo(() => {
    const va = (r: (typeof rows)[number]) => memberValue(r, sort.key);
    return [...rows].sort((a, b) => {
      const x = va(a);
      const y = va(b);
      if (x < y) return -1 * sort.dir;
      if (x > y) return 1 * sort.dir;
      return 0;
    });
  }, [rows, sort]);

  const toggle = (key: MemberSortKey) => {
    setSort((prev) => {
      if (prev.key !== key) {
        const numeric = MEMBER_COLUMNS.find((c) => c.key === key)?.numeric;
        return { key, dir: numeric ? -1 : 1 };
      }
      return { key, dir: (prev.dir * -1) as 1 | -1 };
    });
  };

  return (
    <div className="mt-8 overflow-x-auto rounded-2xl border border-line bg-paper">
      <table className="w-full min-w-[760px] border-collapse text-[14px]">
        <thead>
          <tr className="border-b border-line">
            <th className="w-12 px-3 py-2.5" aria-label="Portrait" />
            {MEMBER_COLUMNS.map((col) => (
              <th
                key={col.key}
                className={cn("px-3 py-2.5", col.numeric ? "text-right" : "text-left")}
              >
                <button
                  onClick={() => toggle(col.key)}
                  className={cn(
                    "inline-flex items-center gap-1 text-[13px] font-semibold",
                    sort.key === col.key ? "text-punch" : "text-mist hover:text-ink"
                  )}
                >
                  {col.label}
                  {sort.key === col.key && (
                    <span className="tnum text-[11px]">{sort.dir === 1 ? "▲" : "▼"}</span>
                  )}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr
              key={row.idol.id}
              onClick={() => navigate(`/idol/${row.idol.id}`)}
              onKeyDown={(e) => e.key === "Enter" && navigate(`/idol/${row.idol.id}`)}
              tabIndex={0}
              className="cursor-pointer border-b border-line/70 last:border-0 hover:bg-sleeve/70"
            >
              <td className="px-3 py-2">
                <div className="h-9 w-9 overflow-hidden rounded-lg">
                  <Portrait idol={row.idol} className="h-full w-full" />
                </div>
              </td>
              <td className="px-3 py-2 font-semibold">{row.idol.stageName}</td>
              <td className="px-3 py-2">{roleLabel(row.idol.roles[0] ?? "")}</td>
              {(["vocal", "rap", "dance", "stage", "visual"] as const).map((k) => (
                <td key={k} className={cn("tnum px-3 py-2 text-right", statTone(row.cats[k]))}>
                  {Math.round(row.cats[k])}
                </td>
              ))}
              <td className="tnum px-3 py-2 text-right">{row.idol.popularity}</td>
              <td className="px-3 py-2 text-right">
                <OvrBadge ovr={row.ovr} size="sm" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
