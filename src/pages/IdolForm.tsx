import { useEffect, useMemo, useRef, useState } from "react";
import { useStore, type GroupEntry } from "../store";
import {
  CATEGORIES,
  computeOvr,
  ROLES,
  roleLabel,
  type Gender,
  type Idol,
} from "../engine/ovr";
import { OvrBadge, Panel, PhotoCard } from "../components/ui";
import { navigate } from "../router";
import { cn } from "../utils/cn";

const inputCls =
  "w-full rounded-lg border border-line bg-paper px-3 py-2 text-[14px] placeholder:text-mist/60 focus:border-ink/40";
const labelCls = "mb-1.5 block text-[13px] font-semibold";

const blankAttrs = () =>
  Object.fromEntries(CATEGORIES.flatMap((c) => c.subs.map((s) => [s.key, 70])));

const blank = (): Idol => ({
  id: 0,
  stageName: "",
  realName: "",
  group: "",
  gender: "Female",
  generation: 5,
  debutYear: undefined,
  agency: "",
  bio: "",
  photo: undefined,
  roles: ["allRounder"],
  attrs: blankAttrs(),
  popularity: 50,
  customFields: [],
});

export function IdolForm({ editId }: { editId?: number }) {
  const { idols, config, fieldDefs, groups, isAdmin, ready, addIdol, updateIdol } = useStore();
  const editing = editId !== undefined ? idols.find((i) => i.id === editId) : undefined;

  const [draft, setDraft] = useState<Idol>(() =>
    editing ? structuredClone(editing) : blank()
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // The store loads async: if the sheet wasn't available on first render
  // (e.g. cold-opened #/edit URL), sync it in once — and only once, so
  // later keystrokes are never wiped by a background refresh.
  const syncedRef = useRef(false);
  useEffect(() => {
    if (ready && !syncedRef.current) {
      syncedRef.current = true;
      setDraft(editing ? structuredClone(editing) : blank());
    }
  }, [ready, editing]);

  const preview = useMemo(() => computeOvr(draft, config), [draft, config]);

  const set = (patch: Partial<Idol>) => setDraft((d) => ({ ...d, ...patch }));
  const setAttr = (key: string, v: number) =>
    setDraft((d) => ({
      ...d,
      attrs: { ...d.attrs, [key]: Math.max(50, Math.min(99, v)) },
    }));

  const readPhoto = (file: File) => {
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) {
      setError("That file isn't a photo or video. Drop an image or short clip.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError("That file is over the 15 MB bucket cap. Compress it first.");
      return;
    }
    // The file itself uploads to the idol-cards bucket on save;
    // the draft only holds a local preview URL until then.
    if (draft.photo && draft.photo.startsWith("blob:")) URL.revokeObjectURL(draft.photo);
    setPhotoFile(file);
    setRemovePhoto(false);
    set({ photo: URL.createObjectURL(file) });
  };

  const moveRole = (idx: number, dir: -1 | 1) => {
    setDraft((d) => {
      const roles = [...d.roles];
      const to = idx + dir;
      if (to < 0 || to >= roles.length) return d;
      [roles[idx], roles[to]] = [roles[to], roles[idx]];
      return { ...d, roles };
    });
  };

  const availableRoles = ROLES.filter((r) => !draft.roles.includes(r.id));

  const save = async () => {
    if (!draft.stageName.trim()) return setError("Stage name is required.");
    if (!draft.group.trim()) return setError("Group is required — use “Solo” for soloists.");
    if (draft.roles.length === 0) return setError("Assign at least one role.");
    setError("");
    setBusy(true);
    const idol = { ...draft, stageName: draft.stageName.trim(), group: draft.group.trim() };
    if (editing) {
      const msg = await updateIdol(idol, { photoFile, removePhoto });
      setBusy(false);
      if (msg) return setError(msg);
      navigate(`/idol/${idol.id}`);
    } else {
      const msg = await addIdol(idol, photoFile);
      setBusy(false);
      if (msg) return setError(msg);
      navigate("/binder");
    }
  };

  if (!ready) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6">
        <p className="font-display font-semibold">Loading…</p>
      </div>
    );
  }

  if (editId !== undefined && !editing) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6">
        <p className="font-display font-semibold">This scouting sheet doesn't exist</p>
        <p className="mt-2 text-[14px] text-mist">
          The idol may have been removed from the database.
        </p>
        <a href="#/binder" className="mt-4 inline-block font-semibold text-punch">
          Back to the binder
        </a>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center sm:px-6">
        <p className="font-display font-semibold">Admins only</p>
        <p className="mt-2 text-[14px] text-mist">
          The catalog is public, but adding and editing needs an admin account.
        </p>
        <a
          href="#/login"
          className="mt-5 inline-block rounded-lg bg-punch px-4 py-2 text-[14px] font-semibold text-white"
        >
          Sign in as admin
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-2xl font-bold">
        {editing ? `Edit ${editing.stageName}'s sheet` : "New scouting sheet"}
      </h1>
      <p className="mt-1 text-[13px] text-mist">
        The overall rating on the right recalculates as you type.
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_290px]">
        <div className="space-y-5">
          {/* Identity */}
          <Panel title="Identity">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls} htmlFor="f-stage">Stage name</label>
                <input id="f-stage" className={inputCls} value={draft.stageName}
                  onChange={(e) => set({ stageName: e.target.value })} placeholder="Sora" />
              </div>
              <div>
                <label className={labelCls} htmlFor="f-real">Real name</label>
                <input id="f-real" className={inputCls} value={draft.realName ?? ""}
                  onChange={(e) => set({ realName: e.target.value })} placeholder="Yoon Sora" />
              </div>
              <div>
                <GroupCombobox
                  value={draft.group}
                  groups={groups}
                  onChange={(v) => set({ group: v })}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="f-agency">Agency</label>
                <input id="f-agency" className={inputCls} value={draft.agency ?? ""}
                  onChange={(e) => set({ agency: e.target.value })} placeholder="Halla Entertainment" />
              </div>
              <div>
                <label className={labelCls} htmlFor="f-gender">Gender</label>
                <select id="f-gender" className={inputCls} value={draft.gender}
                  onChange={(e) => set({ gender: e.target.value as Gender })}>
                  <option>Female</option>
                  <option>Male</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls} htmlFor="f-gen">Generation</label>
                  <select id="f-gen" className={inputCls} value={draft.generation}
                    onChange={(e) => set({ generation: Number(e.target.value) as Idol["generation"] })}>
                    {[1, 2, 3, 4, 5].map((g) => <option key={g} value={g}>Gen {g}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls} htmlFor="f-debut">Debut year</label>
                  <input id="f-debut" className={inputCls} type="number" value={draft.debutYear ?? ""}
                    onChange={(e) => set({ debutYear: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="2023" />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor="f-bio">Scouting notes</label>
                <textarea id="f-bio" rows={3} className={inputCls} value={draft.bio}
                  onChange={(e) => set({ bio: e.target.value })}
                  placeholder="What makes this idol worth tracking?" />
              </div>
            </div>
          </Panel>

          {/* Photo */}
          <Panel title="Card portrait">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) readPhoto(f);
              }}
              className={cn(
                "flex items-center gap-5 rounded-xl border-2 border-dashed p-5 transition-colors",
                dragOver ? "border-punch bg-punch-soft" : "border-line"
              )}
            >
              {draft.photo ? (
                <img src={draft.photo} alt="Portrait preview"
                  className="h-28 w-[75px] rounded-lg object-cover" />
              ) : (
                <div className="flex h-28 w-[75px] items-center justify-center rounded-lg bg-sleeve text-[11px] text-mist">
                  2:3
                </div>
              )}
              <div>
                <p className="text-[14px] font-medium">
                  Drop a portrait here, or{" "}
                  <button onClick={() => fileRef.current?.click()} className="font-semibold text-punch">
                    browse files
                  </button>
                </p>
                <p className="mt-1 text-[12px] text-mist">
                  Uploads go to the idol-cards storage bucket (max 15 MB).
                  Images or short clips — portrait orientation works best.
                </p>
                {photoFile && (
                  <p className="mt-1 text-[12px] font-medium text-holo">
                    New file staged: {photoFile.name} — uploads on save.
                  </p>
                )}
                {draft.photo && (
                  <button
                    onClick={() => {
                      if (draft.photo && draft.photo.startsWith("blob:")) URL.revokeObjectURL(draft.photo);
                      setPhotoFile(null);
                      setRemovePhoto(true);
                      set({ photo: undefined });
                    }}
                    className="mt-2 text-[12px] font-medium text-mist hover:text-punch">
                    Remove photo
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) readPhoto(f); }} />
            </div>
          </Panel>

          {/* Roles */}
          <Panel
            title="Ranked roles"
            aside={
              availableRoles.length > 0 && (
                <select
                  className="rounded-lg border border-line bg-paper px-2 py-1 text-[13px]"
                  value=""
                  aria-label="Add a role"
                  onChange={(e) => {
                    if (e.target.value) set({ roles: [...draft.roles, e.target.value] });
                  }}
                >
                  <option value="">+ Add role</option>
                  {availableRoles.map((r) => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              )
            }
          >
            {draft.roles.length === 0 ? (
              <p className="text-[14px] text-mist">
                No roles yet. Add at least one — it anchors the rating.
              </p>
            ) : (
              <ul className="space-y-2">
                {draft.roles.map((r, i) => (
                  <li key={r} className="flex items-center gap-3 rounded-lg bg-sleeve px-3 py-2">
                    <span className="tnum w-5 font-display text-[13px] font-bold text-punch">{i + 1}</span>
                    <span className="text-[14px] font-medium">{roleLabel(r)}</span>
                    <span className="ml-auto flex gap-1">
                      <RoleBtn label={`Move ${roleLabel(r)} up`} disabled={i === 0} onClick={() => moveRole(i, -1)}>↑</RoleBtn>
                      <RoleBtn label={`Move ${roleLabel(r)} down`} disabled={i === draft.roles.length - 1} onClick={() => moveRole(i, 1)}>↓</RoleBtn>
                      <RoleBtn label={`Remove ${roleLabel(r)}`} onClick={() => set({ roles: draft.roles.filter((x) => x !== r) })}>✕</RoleBtn>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[12px] text-mist">
              Rank is a statement of intent — the engine still re-ranks by measured
              scores, so ordering can't inflate the rating.
            </p>
          </Panel>

          {/* Attributes */}
          {CATEGORIES.map((cat) => (
            <Panel
              key={cat.key}
              title={cat.label}
              aside={
                <span className="tnum font-display text-[14px] font-semibold text-holo">
                  {preview.cats[cat.key].toFixed(1)}
                </span>
              }
            >
              <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                {cat.subs.map((s) => (
                  <div key={s.key}>
                    <div className="flex items-baseline justify-between">
                      <label className="text-[13px] font-medium" htmlFor={`sl-${s.key}`}>
                        {s.label}
                      </label>
                      <input
                        type="number" min={50} max={99}
                        value={draft.attrs[s.key] ?? 70}
                        onChange={(e) => setAttr(s.key, Number(e.target.value))}
                        aria-label={`${s.label} value`}
                        className="tnum w-14 rounded-md border border-line bg-paper px-1.5 py-0.5 text-right text-[13px] font-semibold"
                      />
                    </div>
                    <input
                      id={`sl-${s.key}`} type="range" min={50} max={99}
                      value={draft.attrs[s.key] ?? 70}
                      onChange={(e) => setAttr(s.key, Number(e.target.value))}
                      className="mt-1 w-full"
                    />
                  </div>
                ))}
              </div>
            </Panel>
          ))}

          {/* Popularity */}
          <Panel
            title="Popularity"
            aside={<span className="tnum font-display text-[14px] font-semibold text-punch">{draft.popularity} pts</span>}
          >
            <input
              type="range" min={0} max={100} value={draft.popularity}
              onChange={(e) => set({ popularity: Number(e.target.value) })}
              aria-label="Popularity points" className="w-full"
            />
            <p className="mt-2 text-[12px] text-mist">
              Drifts the overall rating by at most ±{config.driftMax} points. 50 is neutral.
            </p>
          </Panel>

          {/* Custom fields — global definitions, managed in Settings */}
          <Panel title="Custom fields">
            {fieldDefs.length === 0 ? (
              <p className="text-[13px] text-mist">
                No custom fields defined yet. Admins add them in Settings → Rating engine,
                and they apply to every idol.
              </p>
            ) : (
              <div className="space-y-2">
                {fieldDefs.map((d) => (
                  <div key={d.id} className="flex items-center gap-2">
                    <span className="w-40 shrink-0 text-[13px] font-medium">{d.label}</span>
                    <input
                      className={inputCls}
                      placeholder="Value"
                      value={draft.customFields.find((x) => x.id === String(d.id))?.value ?? ""}
                      aria-label={d.label}
                      onChange={(e) => {
                        const value = e.target.value;
                        set({
                          customFields: [
                            ...draft.customFields.filter((x) => x.id !== String(d.id)),
                            { id: String(d.id), label: d.label, value },
                          ],
                        });
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* Live preview */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <PhotoCard idol={{ ...draft, stageName: draft.stageName || "Stage name" }} ovr={preview.ovr} />
          <Panel className="mt-4" title="Live rating">
            <div className="flex items-center justify-between">
              <span className="text-[14px] text-mist">Overall</span>
              <OvrBadge ovr={preview.ovr} size="md" />
            </div>
            <div className="mt-3 space-y-1.5 text-[13px]">
              <div className="flex justify-between">
                <span className="text-mist">Role-weighted base</span>
                <span className="tnum font-semibold">{preview.base.toFixed(1)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-mist">Popularity drift</span>
                <span className="tnum font-semibold">
                  {preview.drift >= 0 ? "+" : ""}{preview.drift.toFixed(1)}
                </span>
              </div>
            </div>
          </Panel>
          {error && (
            <p role="alert" className="mt-3 rounded-lg bg-punch-soft px-3 py-2 text-[13px] font-medium text-punch">
              {error}
            </p>
          )}
          <button
            onClick={() => void save()}
            disabled={busy}
            className="mt-4 w-full rounded-lg bg-punch px-4 py-2.5 text-[15px] font-semibold text-white hover:bg-punch/90 disabled:opacity-50"
          >
            {busy ? "Saving…" : editing ? "Save changes" : "Add to database"}
          </button>
          {editing && (
            <button
              onClick={() => navigate(`/idol/${editing.id}`)}
              className="mt-2 w-full rounded-lg border border-line bg-paper px-4 py-2 text-[14px] font-medium text-mist hover:text-ink"
            >
              Discard changes
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Group field with closest-match suggestions. Matching is case-insensitive,
 * so typing "ive" surfaces canonical "IVE". Picking a suggestion (or typing
 * an exact match) stores the canonical spelling; a brand-new name is
 * auto-added as a group entry on save.
 */
function GroupCombobox({
  value,
  groups,
  onChange,
}: {
  value: string;
  groups: GroupEntry[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const q = value.trim().toLowerCase();
  const exact = q ? groups.find((g) => g.name.toLowerCase() === q) : undefined;
  const suggestions = (q
    ? groups.filter((g) => g.name.toLowerCase().includes(q) && g.name.toLowerCase() !== q)
    : groups
  ).slice(0, 8);
  const hi = suggestions.length > 0 ? highlight % suggestions.length : 0;

  const pick = (name: string) => {
    onChange(name);
    setOpen(false);
  };

  return (
    <div className="relative">
      <label className={labelCls} htmlFor="f-group">Group</label>
      <input
        id="f-group"
        className={inputCls}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setHighlight(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && suggestions.length > 0) {
            e.preventDefault();
            setHighlight((h) => (h + 1) % suggestions.length);
          } else if (e.key === "ArrowUp" && suggestions.length > 0) {
            e.preventDefault();
            setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
          } else if (e.key === "Enter" && open && suggestions.length > 0) {
            e.preventDefault();
            pick(suggestions[hi].name);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        role="combobox"
        aria-expanded={open}
        aria-controls="group-suggest"
        aria-autocomplete="list"
        placeholder="IVE, NOVA9, or Solo"
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul
          id="group-suggest"
          role="listbox"
          className="absolute inset-x-0 top-full z-10 mt-1 max-h-48 overflow-auto rounded-lg border border-line bg-paper py-1 shadow-lg"
        >
          {suggestions.map((g, i) => (
            <li
              key={g.id}
              role="option"
              aria-selected={i === hi}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(g.name);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={
                i === hi
                  ? "cursor-pointer bg-sleeve px-3 py-1.5 text-[14px] font-medium"
                  : "cursor-pointer px-3 py-1.5 text-[14px] text-mist"
              }
            >
              {g.name}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-[12px] text-mist">
        {exact ? (
          <>Matched canonical spelling: <strong>{exact.name}</strong></>
        ) : q ? (
          <>New group — “{value.trim()}” will be added automatically on save.</>
        ) : (
          "Start typing to match an existing group."
        )}
      </p>
    </div>
  );
}

function RoleBtn({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="h-7 w-7 rounded-md border border-line bg-paper text-[12px] text-mist enabled:hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}
