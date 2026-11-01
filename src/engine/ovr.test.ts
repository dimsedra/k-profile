import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ROLES,
  SCORING_ROLES,
  DEFAULT_CONFIG,
  roleScore,
  type CategoryKey,
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
