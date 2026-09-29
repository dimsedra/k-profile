import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import {
  CATEGORIES,
  DEFAULT_CONFIG,
  ROLES,
  computeOvr,
  type CategoryKey,
  type EngineConfig,
  type Idol,
} from "./engine/ovr";
import { computeGroupStats, type GroupMemberInput, type GroupStats } from "./engine/groups";
import { getSupabase, supabaseEnvMissing, versionedPhotoUrl } from "./lib/supabase";

/* ------------------------- database row shapes ------------------------ */

interface IdolRow {
  id: number;
  stage_name: string;
  real_name: string | null;
  group_id: number;
  gender: string;
  generation: number;
  debut_year: number | null;
  agency_id: number | null;
  bio: string;
  photo_path: string | null;
  photo_kind: string;
  popularity: number;
  updated_at: string;
}

interface RoleRow {
  idol_id: number;
  role_id: string;
  position: number;
}

interface AttrRow {
  idol_id: number;
  attr_key: string;
  value: number;
}

export interface FieldDef {
  id: number;
  label: string;
}

export interface GroupEntry {
  id: number;
  name: string;
  photo?: string;
  photoPath?: string;
  photoKind?: "image" | "video";
  photoFocus: { x: number; y: number };
  bio: string;
  debutYear?: number;
  agency: string;
  fandomName: string;
}

export interface AgencyEntry {
  id: number;
  name: string;
}

interface FieldDefRow {
  id: number;
  label: string;
  sort_order: number;
}

interface ValueRow {
  idol_id: number;
  field_id: number;
  value: string;
}

interface EngineRow {
  sub_weights: Record<CategoryKey, Record<string, number>>;
  role_matrix: Record<string, Record<CategoryKey, number>>;
  role_decay: number | string;
  drift_max: number | string;
  group_weight_mode: string | null;
}

const errMsg = (e: unknown, fallback: string) =>
  e instanceof Error ? e.message : fallback;

const CAT_KEYS: CategoryKey[] = ["vocal", "rap", "dance", "stage", "visual"];

/**
 * Engine weights must carry exact canonical keys (atomic attr keys per
 * category, the 5 category keys per role). Anything else — wrong keys,
 * non-numbers — falls back to defaults per group, so a malformed row can
 * never freeze the UI or skew the rating silently.
 */
function sanitizeEngine(eng: EngineRow): EngineConfig {
  const subWeights = { ...DEFAULT_CONFIG.subWeights };
  for (const cat of CATEGORIES) {
    const expected = cat.subs.map((s) => s.key);
    const row = (eng.sub_weights as Record<string, unknown> | null)?.[cat.key];
    if (
      row !== null &&
      typeof row === "object" &&
      expected.every((k) => typeof (row as Record<string, unknown>)[k] === "number")
    ) {
      subWeights[cat.key] = Object.fromEntries(
        expected.map((k) => [k, Number((row as Record<string, number>)[k])])
      );
    }
  }
  const roleMatrix = { ...DEFAULT_CONFIG.roleMatrix };
  for (const r of ROLES) {
    const row = (eng.role_matrix as Record<string, unknown> | null)?.[r.id];
    if (
      row !== null &&
      typeof row === "object" &&
      CAT_KEYS.every((k) => typeof (row as Record<string, unknown>)[k] === "number")
    ) {
      roleMatrix[r.id] = Object.fromEntries(
        CAT_KEYS.map((k) => [k, Number((row as Record<string, number>)[k])])
      ) as Record<CategoryKey, number>;
    }
  }
  const roleDecay = Number(eng.role_decay);
  const driftMax = Number(eng.drift_max);
  const groupWeightMode =
    eng.group_weight_mode === "equal" ? "equal" : DEFAULT_CONFIG.groupWeightMode;
  return {
    subWeights,
    roleMatrix,
    roleDecay: Number.isFinite(roleDecay) ? roleDecay : DEFAULT_CONFIG.roleDecay,
    driftMax: Number.isFinite(driftMax) ? driftMax : DEFAULT_CONFIG.driftMax,
    groupWeightMode,
  };
}

/* -------------------------------- mapping ----------------------------- */

function toIdol(
  row: IdolRow,
  groupName: string,
  agencyName: string,
  roles: RoleRow[],
  attrs: AttrRow[],
  values: ValueRow[],
  defs: FieldDef[]
): Idol {
  const attrMap: Record<string, number> = {};
  for (const a of attrs) attrMap[a.attr_key] = Number(a.value);
  const valueByField = new Map(values.map((v) => [v.field_id, v.value]));
  return {
    id: row.id,
    stageName: row.stage_name,
    realName: row.real_name ?? "",
    group: groupName,
    gender: row.gender as Idol["gender"],
    generation: row.generation as Idol["generation"],
    debutYear: row.debut_year ?? undefined,
    agency: agencyName,
    bio: row.bio,
    photo: row.photo_path ? versionedPhotoUrl(row.photo_path, row.updated_at) : undefined,
    photoPath: row.photo_path ?? undefined,
    photoKind: row.photo_kind as Idol["photoKind"],
    roles: roles.map((r) => r.role_id),
    attrs: attrMap,
    popularity: Number(row.popularity),
    customFields: defs.map((d) => ({
      id: String(d.id),
      label: d.label,
      value: valueByField.get(d.id) ?? "",
    })),
  };
}

/* --------------------------------- store ------------------------------ */

interface Store {
  ready: boolean;
  envMissing: boolean;
  error: string | null;
  idols: Idol[];
  config: EngineConfig;
  fieldDefs: FieldDef[];
  groups: GroupEntry[];
  agencies: AgencyEntry[];
  userEmail: string | null;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  addIdol: (draft: Idol, photoFile?: File | null) => Promise<string | null>;
  updateIdol: (
    draft: Idol,
    opts?: { photoFile?: File | null; removePhoto?: boolean }
  ) => Promise<string | null>;
  deleteIdol: (id: number) => Promise<string | null>;
  setConfig: (cfg: EngineConfig) => Promise<string | null>;
  resetConfig: () => Promise<string | null>;
  addFieldDef: (label: string) => Promise<string | null>;
  groupStats: (groupId: number) => GroupStats | null;
  groupMemberIds: (groupId: number) => number[];
  addGroup: (
    input: { name: string; bio: string; debutYear?: number; agency: string; fandomName: string },
    photoFile?: File | null
  ) => Promise<{ id?: number; error?: string }>;
  deleteGroup: (id: number) => Promise<string | null>;
  updateGroup: (
    id: number,
    patch: { bio: string; debutYear?: number; agency: string; fandomName: string; photoFocus?: { x: number; y: number } },
    opts?: { photoFile?: File | null; removePhoto?: boolean }
  ) => Promise<string | null>;
  deleteFieldDef: (id: number) => Promise<string | null>;
}

const StoreContext = createContext<Store | null>(null);

const PHOTO_BUCKET = "idol-cards";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idols, setIdols] = useState<Idol[]>([]);
  const [config, setConfigState] = useState<EngineConfig>(DEFAULT_CONFIG);
  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>([]);
  const [groups, setGroups] = useState<GroupEntry[]>([]);
  const [agencies, setAgencies] = useState<AgencyEntry[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const byGroup = useRef(new Map<number, number[]>());

  const refresh = useCallback(async () => {
    if (supabaseEnvMissing) return;
    try {
      const sb = getSupabase();
      const [idolsRes, rolesRes, attrsRes, defsRes, valuesRes, engineRes, groupsRes, agenciesRes] =
        await Promise.all([
          sb.from("idols").select("*").order("id"),
          sb.from("idol_roles").select("*").order("idol_id").order("position"),
          sb.from("idol_attrs").select("*"),
          sb
            .from("custom_field_defs")
            .select("*")
            .order("sort_order")
            .order("id"),
          sb.from("idol_custom_values").select("*"),
          sb.from("engine_config").select("*").eq("id", 1).maybeSingle(),
          sb.from("groups").select("*").order("name"),
          sb.from("agencies").select("id,name").order("name"),
        ]);
      const firstError = [
        idolsRes.error,
        rolesRes.error,
        attrsRes.error,
        defsRes.error,
        valuesRes.error,
        engineRes.error,
        groupsRes.error,
        agenciesRes.error,
      ].find(Boolean);
      if (firstError) throw firstError;

      const defs: FieldDef[] = ((defsRes.data ?? []) as FieldDefRow[]).map(
        (d) => ({ id: d.id, label: d.label })
      );
      const rolesByIdol = new Map<number, RoleRow[]>();
      for (const r of (rolesRes.data ?? []) as RoleRow[]) {
        const list = rolesByIdol.get(r.idol_id) ?? [];
        list.push(r);
        rolesByIdol.set(r.idol_id, list);
      }
      const attrsByIdol = new Map<number, AttrRow[]>();
      for (const a of (attrsRes.data ?? []) as AttrRow[]) {
        const list = attrsByIdol.get(a.idol_id) ?? [];
        list.push(a);
        attrsByIdol.set(a.idol_id, list);
      }
      const valuesByIdol = new Map<number, ValueRow[]>();
      for (const v of (valuesRes.data ?? []) as ValueRow[]) {
        const list = valuesByIdol.get(v.idol_id) ?? [];
        list.push(v);
        valuesByIdol.set(v.idol_id, list);
      }
      const groupNameById = new Map<number, string>(
        ((groupsRes.data ?? []) as GroupEntry[]).map((g) => [g.id, g.name])
      );
      const agencyRows = (agenciesRes.data ?? []) as AgencyEntry[];
      const agencyNameById = new Map<number, string>(agencyRows.map((a) => [a.id, a.name]));
      setAgencies(agencyRows.map((a) => ({ id: a.id, name: a.name })));
      const groupRows = (groupsRes.data ?? []) as Record<string, unknown>[];
      const membership = new Map<number, number[]>();
      for (const r of (idolsRes.data ?? []) as { id: number; group_id: number }[]) {
        const list = membership.get(r.group_id) ?? [];
        list.push(r.id);
        membership.set(r.group_id, list);
      }
      byGroup.current = membership;
      setIdols(
        ((idolsRes.data ?? []) as IdolRow[]).map((row) =>
          toIdol(
            row,
            groupNameById.get(row.group_id) ?? "",
            row.agency_id == null ? "" : (agencyNameById.get(row.agency_id) ?? ""),
            rolesByIdol.get(row.id) ?? [],
            attrsByIdol.get(row.id) ?? [],
            valuesByIdol.get(row.id) ?? [],
            defs
          )
        )
      );
      setFieldDefs(defs);
      setGroups(
        groupRows.map((g) => ({
          id: g.id as number,
          name: g.name as string,
          photo: g.photo_path
            ? versionedPhotoUrl(g.photo_path as string, g.updated_at as string)
            : undefined,
          photoPath: (g.photo_path as string | null) ?? undefined,
          photoKind: ((g.photo_kind as string) ?? "image") as GroupEntry["photoKind"],
          photoFocus: {
            x: Number(g.photo_focus_x ?? 50),
            y: Number(g.photo_focus_y ?? 50),
          },
          bio: (g.bio as string) ?? "",
          debutYear: (g.debut_year as number | null) ?? undefined,
          agency: g.agency_id == null ? "" : (agencyNameById.get(g.agency_id as number) ?? ""),
          fandomName: (g.fandom_name as string | null) ?? "",
        }))
      );

      const eng = engineRes.data as EngineRow | null;
      if (eng) setConfigState(sanitizeEngine(eng));
      setError(null);
    } catch (e) {
      setError(errMsg(e, "Failed to load from Supabase."));
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (supabaseEnvMissing) {
      setReady(true);
      return;
    }
    let sub: { unsubscribe: () => void } | null = null;
    getSupabase()
      .auth.getSession()
      .then(({ data }) => setSession(data.session));
    // Sync callback (never async work in here — deadlock risk on refresh).
    const { data } = getSupabase().auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    sub = data.subscription;
    void refresh();
    return () => sub?.unsubscribe();
  }, [refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await getSupabase().auth.signInWithPassword({
        email,
        password,
      });
      if (error) return error.message;
      await refresh();
      return null;
    } catch (e) {
      return errMsg(e, "Sign-in failed.");
    }
  }, [refresh]);

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut();
  }, []);

  /**
   * Canonical group resolution: case-insensitive match against existing
   * groups ("ive" finds "IVE"), auto-create when nothing matches. The
   * unique index on lower(name) backs this against concurrent inserts.
   */
  const resolveGroupId = useCallback(async (name: string): Promise<number> => {
    const clean = name.trim();
    if (!clean) throw new Error("Group is required — use “Solo” for soloists.");
    const sb = getSupabase();
    const match = async () => {
      const { data, error } = await sb.from("groups").select("id,name");
      if (error) throw error;
      return ((data ?? []) as GroupEntry[]).find(
        (g) => g.name.toLowerCase() === clean.toLowerCase()
      );
    };
    const hit = await match();
    if (hit) return hit.id;
    const { data: created, error } = await sb
      .from("groups")
      .insert({ name: clean })
      .select("id")
      .single();
    if (!error) return (created as { id: number }).id;
    const retry = await match();
    if (retry) return retry.id;
    throw error;
  }, []);

  /**
   * Same canonical treatment as groups, but optional: empty input resolves
   * to null (no agency) instead of throwing.
   */
  const resolveAgencyId = useCallback(async (name: string): Promise<number | null> => {
    const clean = name.trim();
    if (!clean) return null;
    const sb = getSupabase();
    const match = async () => {
      const { data, error } = await sb.from("agencies").select("id,name");
      if (error) throw error;
      return ((data ?? []) as AgencyEntry[]).find(
        (a) => a.name.toLowerCase() === clean.toLowerCase()
      );
    };
    const hit = await match();
    if (hit) return hit.id;
    const { data: created, error } = await sb
      .from("agencies")
      .insert({ name: clean })
      .select("id")
      .single();
    if (!error) return (created as { id: number }).id;
    const retry = await match();
    if (retry) return retry.id;
    throw error;
  }, []);

  const uploadPhoto = useCallback(async (idolId: number, file: File) => {
    const sb = getSupabase();
    const path = `${idolId}/portrait`;
    const kind = file.type.startsWith("video/") ? "video" : "image";
    const { error } = await sb.storage
      .from(PHOTO_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw error;
    const { error: rowError } = await sb
      .from("idols")
      .update({ photo_path: path, photo_kind: kind, updated_at: new Date().toISOString() })
      .eq("id", idolId);
    if (rowError) throw rowError;
  }, []);

  const writeChildren = useCallback(async (idolId: number, draft: Idol) => {
    const sb = getSupabase();
    await sb.from("idol_roles").delete().eq("idol_id", idolId).throwOnError();
    await sb.from("idol_attrs").delete().eq("idol_id", idolId).throwOnError();
    await sb
      .from("idol_custom_values")
      .delete()
      .eq("idol_id", idolId)
      .throwOnError();
    if (draft.roles.length > 0) {
      await sb
        .from("idol_roles")
        .insert(
          draft.roles.map((role_id, position) => ({ idol_id: idolId, role_id, position }))
        )
        .throwOnError();
    }
    const attrEntries = Object.entries(draft.attrs);
    if (attrEntries.length > 0) {
      await sb
        .from("idol_attrs")
        .insert(
          attrEntries.map(([attr_key, value]) => ({ idol_id: idolId, attr_key, value }))
        )
        .throwOnError();
    }
    const filled = draft.customFields.filter((f) => f.value.trim() !== "");
    if (filled.length > 0) {
      await sb
        .from("idol_custom_values")
        .insert(
          filled.map((f) => ({ idol_id: idolId, field_id: Number(f.id), value: f.value.trim() }))
        )
        .throwOnError();
    }
  }, []);

  const addIdol = useCallback(
    async (draft: Idol, photoFile?: File | null) => {
      try {
        const sb = getSupabase();
        const group_id = await resolveGroupId(draft.group);
        const agency_id = await resolveAgencyId(draft.agency ?? "");
        const { data, error } = await sb
          .from("idols")
          .insert({
            stage_name: draft.stageName,
            real_name: draft.realName || null,
            group_id,
            gender: draft.gender,
            generation: draft.generation,
            debut_year: draft.debutYear ?? null,
            agency_id,
            bio: draft.bio,
            popularity: draft.popularity,
          })
          .select("id")
          .single();
        if (error) throw error;
        const idolId = (data as { id: number }).id;
        if (photoFile) await uploadPhoto(idolId, photoFile);
        await writeChildren(idolId, draft);
        await refresh();
        return null;
      } catch (e) {
        return errMsg(e, "Failed to add idol.");
      }
    },
    [refresh, resolveGroupId, resolveAgencyId, uploadPhoto, writeChildren]
  );

  const updateIdol = useCallback(
    async (draft: Idol, opts?: { photoFile?: File | null; removePhoto?: boolean }) => {
      try {
        const sb = getSupabase();
        const group_id = await resolveGroupId(draft.group);
        const agency_id = await resolveAgencyId(draft.agency ?? "");
        const patch: Record<string, unknown> = {
          stage_name: draft.stageName,
          real_name: draft.realName || null,
          group_id,
          gender: draft.gender,
          generation: draft.generation,
          debut_year: draft.debutYear ?? null,
          agency_id,
          bio: draft.bio,
          popularity: draft.popularity,
          updated_at: new Date().toISOString(),
        };
        if (opts?.removePhoto) {
          patch.photo_path = null;
          patch.photo_kind = "image";
          await sb.storage.from(PHOTO_BUCKET).remove([`${draft.id}/portrait`]);
        }
        await sb.from("idols").update(patch).eq("id", draft.id).throwOnError();
        if (opts?.photoFile) await uploadPhoto(draft.id, opts.photoFile);
        await writeChildren(draft.id, draft);
        await refresh();
        return null;
      } catch (e) {
        return errMsg(e, "Failed to save changes.");
      }
    },
    [refresh, resolveGroupId, resolveAgencyId, uploadPhoto, writeChildren]
  );

  const deleteIdol = useCallback(
    async (id: number) => {
      try {
        const sb = getSupabase();
        await sb.from("idols").delete().eq("id", id).throwOnError();
        await sb.storage.from(PHOTO_BUCKET).remove([`${id}/portrait`]);
        await refresh();
        return null;
      } catch (e) {
        return errMsg(e, "Failed to remove idol.");
      }
    },
    [refresh]
  );

  const setConfig = useCallback(
    async (cfg: EngineConfig) => {
      try {
        await getSupabase()
          .from("engine_config")
          .update({
            sub_weights: cfg.subWeights,
            role_matrix: cfg.roleMatrix,
            role_decay: cfg.roleDecay,
            drift_max: cfg.driftMax,
            group_weight_mode: cfg.groupWeightMode,
            updated_at: new Date().toISOString(),
          })
          .eq("id", 1)
          .throwOnError();
        await refresh();
        return null;
      } catch (e) {
        return errMsg(e, "Failed to save engine config.");
      }
    },
    [refresh]
  );

  const resetConfig = useCallback(async () => setConfig(DEFAULT_CONFIG), [setConfig]);

  const addFieldDef = useCallback(
    async (label: string) => {
      try {
        const clean = label.trim();
        if (!clean) return "Field name is required.";
        await getSupabase()
          .from("custom_field_defs")
          .insert({ label: clean })
          .throwOnError();
        await refresh();
        return null;
      } catch (e) {
        return errMsg(e, "Failed to add field.");
      }
    },
    [refresh]
  );

  const deleteFieldDef = useCallback(
    async (id: number) => {
      try {
        await getSupabase().from("custom_field_defs").delete().eq("id", id).throwOnError();
        await refresh();
        return null;
      } catch (e) {
        return errMsg(e, "Failed to delete field.");
      }
    },
    [refresh]
  );

  /**
   * Groups with members cannot be deleted (FK restrict) — the page disables
   * the button in that case; this is the last line of defense plus storage
   * cleanup for empty groups.
   */
  const deleteGroup = useCallback(
    async (id: number) => {
      try {
        const sb = getSupabase();
        await sb.from("groups").delete().eq("id", id).throwOnError();
        await sb.storage.from(PHOTO_BUCKET).remove([`group-${id}/portrait`]);
        await refresh();
        return null;
      } catch (e) {
        return errMsg(e, "Failed to remove group. Groups with members cannot be removed.");
      }
    },
    [refresh]
  );

  const groupMemberIds = useCallback(
    (groupId: number): number[] => byGroup.current.get(groupId) ?? [],
    []
  );

  const addGroup = useCallback(
    async (
      input: { name: string; bio: string; debutYear?: number; agency: string; fandomName: string },
      photoFile?: File | null
    ): Promise<{ id?: number; error?: string }> => {
      try {
        const sb = getSupabase();
        const clean = input.name.trim();
        if (!clean) return { error: "Group name is required." };
        const { data: all, error: listErr } = await sb.from("groups").select("id,name");
        if (listErr) throw listErr;
        const hit = ((all ?? []) as { id: number; name: string }[]).find(
          (g) => g.name.toLowerCase() === clean.toLowerCase()
        );
        if (hit) return { error: `“${clean}” already exists as a group.`, id: hit.id };
        const agency_id = await resolveAgencyId(input.agency);
        const { data: created, error } = await sb
          .from("groups")
          .insert({
            name: clean,
            bio: input.bio,
            debut_year: input.debutYear ?? null,
            agency_id,
            fandom_name: input.fandomName || null,
          })
          .select("id")
          .single();
        if (error) throw error;
        const id = (created as { id: number }).id;
        if (photoFile) {
          const kind = photoFile.type.startsWith("video/") ? "video" : "image";
          const { error: upErr } = await sb.storage
            .from(PHOTO_BUCKET)
            .upload(`group-${id}/portrait`, photoFile, { upsert: true, contentType: photoFile.type });
          if (upErr) throw upErr;
          await sb
            .from("groups")
            .update({
              photo_path: `group-${id}/portrait`,
              photo_kind: kind,
              updated_at: new Date().toISOString(),
            })
            .eq("id", id)
            .throwOnError();
        }
        await refresh();
        return { id };
      } catch (e) {
        return { error: errMsg(e, "Failed to add group.") };
      }
    },
    [refresh, resolveAgencyId]
  );

  const groupStats = useCallback(
    (groupId: number) => {
      const ids = new Set(byGroup.current.get(groupId) ?? []);
      const members = idols.filter((i) => ids.has(i.id));
      if (members.length === 0) return null;
      const inputs: GroupMemberInput[] = members.map((m) => {
        const b = computeOvr(m, config);
        return { id: m.id, cats: b.cats, ovr: b.ovr, popularity: m.popularity };
      });
      return computeGroupStats(inputs, config.groupWeightMode);
    },
    [idols, config]
  );

  const updateGroup = useCallback(
    async (
      id: number,
      patch: { bio: string; debutYear?: number; agency: string; fandomName: string; photoFocus?: { x: number; y: number } },
      opts?: { photoFile?: File | null; removePhoto?: boolean }
    ): Promise<string | null> => {
      try {
        const sb = getSupabase();
        const agency_id = await resolveAgencyId(patch.agency);
        const row: Record<string, unknown> = {
          bio: patch.bio,
          debut_year: patch.debutYear ?? null,
          agency_id,
          fandom_name: patch.fandomName || null,
        };
        if (patch.photoFocus) {
          row.photo_focus_x = Math.max(0, Math.min(100, Math.round(patch.photoFocus.x)));
          row.photo_focus_y = Math.max(0, Math.min(100, Math.round(patch.photoFocus.y)));
        }
        if (opts?.removePhoto) {
          row.photo_path = null;
          row.photo_kind = "image";
          await sb.storage.from(PHOTO_BUCKET).remove([`group-${id}/portrait`]);
        }
        await sb.from("groups").update(row).eq("id", id).throwOnError();
        if (opts?.photoFile) {
          const file = opts.photoFile;
          const kind = file.type.startsWith("video/") ? "video" : "image";
          const { error } = await sb.storage
            .from(PHOTO_BUCKET)
            .upload(`group-${id}/portrait`, file, { upsert: true, contentType: file.type });
          if (error) throw error;
          await sb
            .from("groups")
            .update({ photo_path: `group-${id}/portrait`, photo_kind: kind })
            .eq("id", id)
            .throwOnError();
        }
        await refresh();
        return null;
      } catch (e) {
        return errMsg(e, "Failed to save group.");
      }
    },
    [refresh, resolveAgencyId]
  );

  const value = useMemo<Store>(
    () => ({
      ready,
      envMissing: supabaseEnvMissing,
      error,
      idols,
      config,
      fieldDefs,
      groups,
      agencies,
      userEmail: session?.user?.email ?? null,
      isAdmin: session?.user?.app_metadata?.is_admin === true,
      signIn,
      signOut,
      refresh,
      addIdol,
      updateIdol,
      deleteIdol,
      setConfig,
      resetConfig,
      addFieldDef,
      deleteFieldDef,
      groupStats,
      groupMemberIds,
      updateGroup,
      addGroup,
      deleteGroup,
    }),
    [
      ready,
      error,
      idols,
      config,
      fieldDefs,
      groups,
      agencies,
      session,
      signIn,
      signOut,
      refresh,
      addIdol,
      updateIdol,
      deleteIdol,
      setConfig,
      resetConfig,
      addFieldDef,
      deleteFieldDef,
      groupStats,
      groupMemberIds,
      updateGroup,
      addGroup,
      deleteGroup,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
