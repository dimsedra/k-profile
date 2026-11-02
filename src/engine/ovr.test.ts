import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ROLES,
  SCORING_ROLES,
  DEFAULT_CONFIG,
  roleScore,
  computeOvr,
  ARCHETYPES,
  computeArchetype,
  CATEGORIES,
  type CategoryKey,
  type Idol,
} from "./ovr.ts";

describe("BP-OVR-001: Functional Role Pool & Role Scoring", () => {
  test("ROLES defines 12 canonical roles and excludes allRounder", () => {
    assert.equal(ROLES.length, 12);
    assert.equal(ROLES.some((r) => r.id === "allRounder"), false);
    const leader = ROLES.find((r) => r.id === "leader");
    assert.ok(leader);
    assert.equal(leader.family, null);
  });

  test("SCORING_ROLES exports exactly 11 functional roles with valid families", () => {
    assert.equal(SCORING_ROLES.length, 11);
    const expectedIds = [
      "mainVocal", "leadVocal", "subVocalist",
      "mainRapper", "leadRapper", "subRapper",
      "mainDancer", "leadDancer", "subDancer",
      "visual", "center",
    ];
    assert.deepEqual(SCORING_ROLES.map((r) => r.id), expectedIds);
    for (const r of SCORING_ROLES) {
      assert.ok(["vocal", "rap", "dance", "visual", "center"].includes(r.family));
    }
  });

  test("roleScore computes weighted category scores accurately", () => {
    const cats: Record<CategoryKey, number> = {
      vocal: 90,
      rap: 60,
      dance: 70,
      stage: 80,
      visual: 75,
    };
    // mainVocal: vocal 55, rap 5, dance 10, stage 20, visual 10
    // expected = (90*55 + 60*5 + 70*10 + 80*20 + 75*10) / 100
    // = (4950 + 300 + 700 + 1600 + 750) / 100 = 8300 / 100 = 83.0
    const score = roleScore(cats, "mainVocal", DEFAULT_CONFIG);
    assert.equal(Math.round(score * 10) / 10, 83.0);
  });

  test("roleScore fails fast and loud on unknown role or removed allRounder", () => {
    const cats: Record<CategoryKey, number> = {
      vocal: 80,
      rap: 80,
      dance: 80,
      stage: 80,
      visual: 80,
    };
    assert.throws(
      () => roleScore(cats, "allRounder", DEFAULT_CONFIG),
      /Unknown or degenerate role in roleMatrix: allRounder/
    );
    assert.throws(
      () => roleScore(cats, "unknownRole", DEFAULT_CONFIG),
      /Unknown or degenerate role in roleMatrix: unknownRole/
    );
  });
});

describe("BP-OVR-002: Midrange Archetype Selection & OVR Calculation", () => {
  const makeIdol = (attrs: Record<string, number>, roles: string[] = ["mainVocal"]): Idol => ({
    id: 1,
    stageName: "Test Idol",
    group: "Test Group",
    gender: "Female",
    generation: 5,
    bio: "",
    popularity: 50,
    roles,
    attrs,
    customFields: [],
  });

  test("deduplicates hierarchical families and allows visual + center simultaneously", () => {
    // Attributes favoring vocal + visual + center
    const attrs: Record<string, number> = {
      "vocal.technique": 95, "vocal.range": 95, "vocal.tone": 95, "vocal.stability": 95,
      "rap.flow": 55, "rap.speed": 55, "rap.lyricism": 55, "rap.delivery": 55,
      "dance.precision": 70, "dance.power": 70, "dance.flexibility": 70, "dance.musicality": 70,
      "stage.charisma": 90, "stage.expression": 90, "stage.engagement": 90, "stage.energy": 90,
      "visual.harmony": 95, "visual.aura": 95, "visual.styling": 95, "visual.camera": 95,
    };
    const idol = makeIdol(attrs);
    const breakdown = computeOvr(idol, DEFAULT_CONFIG);

    // Should include mainVocal, visual, center
    const selectedIds = breakdown.roleScores.map((r) => r.roleId);
    assert.ok(selectedIds.includes("mainVocal"));
    assert.ok(!selectedIds.includes("leadVocal"));
    assert.ok(!selectedIds.includes("subVocalist"));
    assert.ok(selectedIds.includes("visual"));
    assert.ok(selectedIds.includes("center"));

    // Weights must sum to 1.0
    const totalWeight = breakdown.roleScores.reduce((s, r) => s + r.weight, 0);
    assert.ok(Math.abs(totalWeight - 1.0) < 1e-6);
  });

  test("uniform attributes yield exactly 5 roles across the 5 distinct families", () => {
    const attrs: Record<string, number> = {
      "vocal.technique": 80, "vocal.range": 80, "vocal.tone": 80, "vocal.stability": 80,
      "rap.flow": 80, "rap.speed": 80, "rap.lyricism": 80, "rap.delivery": 80,
      "dance.precision": 80, "dance.power": 80, "dance.flexibility": 80, "dance.musicality": 80,
      "stage.charisma": 80, "stage.expression": 80, "stage.engagement": 80, "stage.energy": 80,
      "visual.harmony": 80, "visual.aura": 80, "visual.styling": 80, "visual.camera": 80,
    };
    const idol = makeIdol(attrs);
    const breakdown = computeOvr(idol, DEFAULT_CONFIG);

    assert.equal(breakdown.roleScores.length, 5);
    assert.equal(breakdown.base, 80);
    assert.equal(breakdown.ovr, 80);
    assert.equal(breakdown.threshold, 80);
  });

  test("core invariant: idol.roles mutation has zero effect on computeOvr", () => {
    const attrs: Record<string, number> = {
      "vocal.technique": 92, "vocal.range": 90, "vocal.tone": 88, "vocal.stability": 91,
      "rap.flow": 60, "rap.speed": 60, "rap.lyricism": 60, "rap.delivery": 60,
      "dance.precision": 75, "dance.power": 75, "dance.flexibility": 75, "dance.musicality": 75,
      "stage.charisma": 85, "stage.expression": 85, "stage.engagement": 85, "stage.energy": 85,
      "visual.harmony": 94, "visual.aura": 93, "visual.styling": 92, "visual.camera": 95,
    };

    const idolA = makeIdol(attrs, ["leadVocal"]);
    const idolB = makeIdol(attrs, ["mainDancer", "mainRapper"]);
    const idolC = makeIdol(attrs, []);

    const resA = computeOvr(idolA, DEFAULT_CONFIG);
    const resB = computeOvr(idolB, DEFAULT_CONFIG);
    const resC = computeOvr(idolC, DEFAULT_CONFIG);

    assert.equal(resA.ovr, resB.ovr);
    assert.equal(resA.ovr, resC.ovr);
    assert.equal(resA.base, resB.base);
    assert.equal(resA.threshold, resB.threshold);
    assert.deepEqual(resA.roleScores, resB.roleScores);
    assert.deepEqual(resA.roleScores, resC.roleScores);
  });

  test("fails fast on invalid roleDecay in EngineConfig", () => {
    const idol = makeIdol({});
    const badCfg = { ...DEFAULT_CONFIG, roleDecay: 0 };
    assert.throws(() => computeOvr(idol, badCfg), /Invalid roleDecay in EngineConfig/);

    const nanCfg = { ...DEFAULT_CONFIG, roleDecay: NaN };
    assert.throws(() => computeOvr(idol, nanCfg), /Invalid roleDecay in EngineConfig/);
  });
});

describe("BP-ARCH-001: 31-Type Archetype Catalog & 5-Axis Midrange Calculation", () => {
  test("ARCHETYPES defines exactly 31 canonical archetype entries", () => {
    const keys = Object.keys(ARCHETYPES);
    assert.equal(keys.length, 31);

    const catKeys = CATEGORIES.map((c) => c.key);
    for (const k of keys) {
      const parts = k.split("+") as CategoryKey[];
      // Must be sorted in canonical order
      const expectedCanonical = catKeys.filter((c) => parts.includes(c)).join("+");
      assert.equal(k, expectedCanonical);
    }
  });

  test("all 31 archetype titles start with 'The ' and use unique primary nouns", () => {
    const nouns = [
      "Maestro", "Wordsmith", "Dynamo", "Commander", "Muse",
      "Rapper", "Engine", "Anchor", "Siren", "Striker",
      "Disruptor", "Trendsetter", "Pacesetter", "Performer", "Centerpiece",
      "Powerhouse", "Virtuoso", "Icon", "Showstopper", "Showman",
      "Headliner", "Igniter", "Maverick", "Frontman", "Sensation",
      "Prodigy", "Vanguard", "Luminary", "Protagonist", "Trailblazer",
      "All-Rounder",
    ];
    assert.equal(new Set(nouns).size, 31);

    const titles = Object.values(ARCHETYPES).map((a) => a.title);
    assert.equal(titles.length, 31);
    for (const title of titles) {
      assert.ok(title.startsWith("The "), `Expected "${title}" to start with "The "`);
    }

    // Each noun should appear in exactly one archetype title
    for (const noun of nouns) {
      const matches = titles.filter((t) => t.includes(noun));
      assert.equal(
        matches.length,
        1,
        `Expected noun "${noun}" to appear in exactly one title, found: ${matches.join(", ")}`
      );
    }
  });

  test("computeArchetype identifies single, dual, triple, quad, and 5-pillar traits", () => {
    // 1-pillar (Vocal)
    const single = computeArchetype({ vocal: 90, rap: 50, dance: 50, stage: 50, visual: 50 });
    assert.equal(single.key, "vocal");
    assert.equal(single.title, "The Vocal Maestro");
    assert.equal(single.threshold, 70);
    assert.deepEqual(single.activeCategories, ["vocal"]);

    // 2-pillar (Vocal + Dance)
    const dual = computeArchetype({ vocal: 90, rap: 50, dance: 90, stage: 50, visual: 50 });
    assert.equal(dual.key, "vocal+dance");
    assert.equal(dual.title, "The Stage Engine");
    assert.deepEqual(dual.activeCategories, ["vocal", "dance"]);

    // 3-pillar (Vocal + Rap + Stage)
    const triple = computeArchetype({ vocal: 85, rap: 85, dance: 50, stage: 85, visual: 50 });
    assert.equal(triple.key, "vocal+rap+stage");
    assert.equal(triple.title, "The Frontline Virtuoso");
    assert.deepEqual(triple.activeCategories, ["vocal", "rap", "stage"]);

    // 4-pillar (Vocal + Dance + Stage + Visual - Protagonist)
    const quad = computeArchetype({ vocal: 92, rap: 50, dance: 90, stage: 88, visual: 95 });
    assert.equal(quad.key, "vocal+dance+stage+visual");
    assert.equal(quad.title, "The Protagonist");
    assert.deepEqual(quad.activeCategories, ["vocal", "dance", "stage", "visual"]);

    // 5-pillar uniform attributes (max === min)
    const uniform = computeArchetype({ vocal: 75, rap: 75, dance: 75, stage: 75, visual: 75 });
    assert.equal(uniform.key, "vocal+rap+dance+stage+visual");
    assert.equal(uniform.title, "The All-Rounder");
    assert.equal(uniform.threshold, 75);
    assert.equal(uniform.activeCategories.length, 5);
  });

  test("computeOvr attaches archetype result into OvrBreakdown", () => {
    const idol: Idol = {
      id: 10,
      stageName: "Ace Idol",
      group: "K-Stars",
      gender: "Female",
      generation: 5,
      bio: "",
      popularity: 50,
      roles: ["mainVocal"],
      attrs: {
        "vocal.technique": 95, "vocal.range": 95, "vocal.tone": 95, "vocal.stability": 95,
        "rap.flow": 50, "rap.speed": 50, "rap.lyricism": 50, "rap.delivery": 50,
        "dance.precision": 95, "dance.power": 95, "dance.flexibility": 95, "dance.musicality": 95,
        "stage.charisma": 50, "stage.expression": 50, "stage.engagement": 50, "stage.energy": 50,
        "visual.harmony": 50, "visual.aura": 50, "visual.styling": 50, "visual.camera": 50,
      },
      customFields: [],
    };
    const breakdown = computeOvr(idol, DEFAULT_CONFIG);
    assert.ok(breakdown.archetype);
    assert.equal(breakdown.archetype.key, "vocal+dance");
    assert.equal(breakdown.archetype.title, "The Stage Engine");
  });

  test("computeArchetype fails fast on invalid or missing category values", () => {
    assert.throws(
      () => computeArchetype({ vocal: NaN, rap: 70, dance: 70, stage: 70, visual: 70 }),
      /Invalid category score for archetype calculation: vocal/
    );
    assert.throws(
      // @ts-expect-error testing missing property
      () => computeArchetype({ rap: 70, dance: 70, stage: 70, visual: 70 }),
      /Invalid category score for archetype calculation: vocal/
    );
  });
});
