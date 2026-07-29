// Transparent filter + scoring recommender.
//
// Core idea:
// 1) Filter by hard constraints (surface/category, budget, width, stability).
// 2) Score remaining shoes by how well they match preferences.

(function () {
  function clamp01(x) {
    return Math.max(0, Math.min(1, x));
  }

  function includesOrNeutral(list, value) {
    if (!Array.isArray(list)) return false;
    return list.includes(value);
  }

  function distanceScore(shoe, prefs) {
    // Shoe has distance array like ["10k","hm","fm"].
    if (includesOrNeutral(shoe.distance, prefs.distance)) return 1;

    // Neighbor heuristics: allow close distances with partial credit.
    const order = ["5k", "10k", "hm", "fm", "ultra"];
    const a = order.indexOf(prefs.distance);
    const b = order.indexOf(shoe.distance?.[0] ?? "10k");
    if (a === -1 || b === -1) return 0.5;

    const diff = Math.min(4, Math.abs(a - b));
    return clamp01(1 - diff * 0.25); // diff 0=>1, 1=>0.75, 2=>0.5, 3=>0.25, 4=>0
  }

  function stabilityMatch(shoe, prefs) {
    // prefs: neutral | mild | stability
    // shoe: neutral | mild | stability
    const levels = { neutral: 0, mild: 1, stability: 2 };
    const ps = levels[prefs.stability] ?? 0;
    const ss = levels[shoe.stability] ?? 0;

    if (ss === ps) return 1;
    // if user needs stability but shoe is neutral -> bad
    if (ps > ss) return clamp01(1 - (ps - ss) * 0.55);
    // if shoe has more stability than needed -> mild penalty (some neutral runners still fine)
    return clamp01(1 - (ss - ps) * 0.25);
  }

  function cushionMatch(shoe, prefs) {
    const map = { firm: 0, balanced: 1, soft: 2 };
    const pc = map[prefs.cushion] ?? 1;
    const sc = map[shoe.cushionFeel] ?? 1;
    const diff = Math.abs(pc - sc); // 0..2
    return diff === 0 ? 1 : diff === 1 ? 0.65 : 0.3;
  }

  function useMatch(shoe, prefs) {
    if (prefs.use === "mixed") {
      // Mixed: prefer shoes that can do multiple roles.
      const roles = new Set(shoe.bestUse ?? []);
      const count = ["easy", "daily", "tempo", "race"].filter((r) => roles.has(r)).length;
      return clamp01(0.3 + count * 0.2); // 1 role =>0.5, 2=>0.7, 3=>0.9, 4=>1.1 clamped
    }
    return includesOrNeutral(shoe.bestUse, prefs.use) ? 1 : 0.45;
  }

  function widthMatch(shoe, prefs) {
    return (shoe.widthOptions ?? []).includes(prefs.width) ? 1 : 0.2;
  }

  function budgetMatch(shoe, prefs) {
    if (shoe.msrp <= prefs.budget) return 1;
    const over = shoe.msrp - prefs.budget;
    // penalize gradually if slightly over budget
    return clamp01(1 - over / Math.max(1, prefs.budget) * 1.25);
  }

  function weightPreferenceBoost(shoe, prefs) {
    // Very rough heuristic: heavier runners often prefer more cushioning + stability.
    const w = prefs.weightKg;
    if (!w) return 0;
    if (w >= 85) return (shoe.ride.cushioning >= 8 ? 0.08 : 0) + (shoe.ride.stability >= 7 ? 0.06 : 0);
    if (w <= 60) return (shoe.weightG <= 250 ? 0.08 : 0) + (shoe.ride.responsiveness >= 8 ? 0.04 : 0);
    return 0;
  }

  function trailSpecificScore(shoe, prefs) {
    if (prefs.surface !== "trail") return 1;
    const t = shoe.trail;
    if (!t) return 0.1;

    let score = 0.6; // baseline for being trail

    // Terrain preference
    if (t.terrain?.includes(prefs.terrain)) score += 0.2;
    else if (prefs.terrain === "mixed" && t.terrain?.includes("mixed")) score += 0.2;
    else score += 0.08;

    // Priority
    if (prefs.trailPriority === "grip") score += clamp01((t.grip ?? 0) / 10) * 0.2;
    if (prefs.trailPriority === "protection") score += clamp01((t.protection ?? 0) / 10) * 0.2;
    if (prefs.trailPriority === "weight") score += (shoe.weightG <= 285 ? 0.2 : 0.08);

    return clamp01(score);
  }

  function roleSanity(shoe, prefs) {
    // Light guardrails for extreme mismatches:
    // e.g., track spikes not for daily training.
    if (prefs.surface === "track" && shoe.track?.type === "spike") {
      if (prefs.use !== "race") return 0.35;
    }
    if (prefs.surface !== "track" && shoe.track?.type === "spike") return 0.05;
    return 1;
  }

  function hardFilter(shoe, prefs) {
    if (shoe.category !== prefs.surface) return false;
    if (shoe.msrp > prefs.budget * 1.35) return false; // hard cap: too far over budget
    if (!(shoe.widthOptions ?? []).includes(prefs.width)) {
      // Allow if user is "regular" and shoe is regular-only; otherwise filter.
      if (prefs.width !== "regular") return false;
    }
    // If user requests stability and shoe is neutral, still allow but will score low. No hard filter.
    return true;
  }

  function totalScore(shoe, prefs) {
    // weights tuned for understandable output; adjust anytime.
    const weights = {
      distance: 0.18,
      use: 0.22,
      stability: 0.18,
      cushion: 0.12,
      width: 0.08,
      budget: 0.07,
      ride: 0.1, // derived from shoe ride attributes
      trail: 0.12, // only meaningful for trail
    };

    const rideScore =
      clamp01(shoe.ride.cushioning / 10) * 0.35 +
      clamp01(shoe.ride.responsiveness / 10) * 0.35 +
      clamp01(shoe.ride.durability / 10) * 0.2 +
      clamp01(shoe.ride.value / 10) * 0.1;

    const trail = trailSpecificScore(shoe, prefs);

    let s =
      distanceScore(shoe, prefs) * weights.distance +
      useMatch(shoe, prefs) * weights.use +
      stabilityMatch(shoe, prefs) * weights.stability +
      cushionMatch(shoe, prefs) * weights.cushion +
      widthMatch(shoe, prefs) * weights.width +
      budgetMatch(shoe, prefs) * weights.budget +
      rideScore * weights.ride +
      trail * (prefs.surface === "trail" ? weights.trail : 0);

    s = s * roleSanity(shoe, prefs);

    // Small heuristic boosts
    s += weightPreferenceBoost(shoe, prefs);

    return clamp01(s);
  }

  function explain(shoe, prefs) {
    const reasons = [];
    const cautions = [];

    if (shoe.msrp <= prefs.budget) reasons.push("Within budget");
    else cautions.push(`Above budget (MSRP $${shoe.msrp})`);

    if ((shoe.widthOptions ?? []).includes(prefs.width)) reasons.push(`Comes in ${prefs.width} width`);
    else cautions.push(`May not fit: no ${prefs.width} option`);

    if ((shoe.bestUse ?? []).includes(prefs.use)) reasons.push(`Good for ${prefs.use} running`);
    else if (prefs.use === "mixed") reasons.push("Versatile across multiple run types");
    else cautions.push(`Not primarily a ${prefs.use} shoe`);

    if (shoe.stability === prefs.stability) reasons.push(`${prefs.stability} stability match`);
    else if (prefs.stability === "stability" && shoe.stability !== "stability") cautions.push("Less support than requested");
    else if (prefs.stability === "neutral" && shoe.stability === "stability") cautions.push("More stability than requested");

    if (shoe.cushionFeel === prefs.cushion) reasons.push(`${prefs.cushion} cushioning feel`);
    else cautions.push(`Cushioning feels more ${shoe.cushionFeel}`);

    if ((shoe.distance ?? []).includes(prefs.distance)) reasons.push(`Suitable for ${prefs.distance.toUpperCase()}`);
    else reasons.push("Distance compatibility looks reasonable");

    if (prefs.surface === "trail" && shoe.trail) {
      reasons.push(`Trail grip ${shoe.trail.grip}/10, protection ${shoe.trail.protection}/10`);
      if (prefs.terrain && !(shoe.trail.terrain ?? []).includes(prefs.terrain) && prefs.terrain !== "mixed") {
        cautions.push(`Not optimized for ${prefs.terrain} terrain`);
      }
    }

    return { reasons, cautions };
  }

  window.Recommender = {
    recommend(prefs, catalog) {
      const candidates = (catalog ?? []).filter((s) => hardFilter(s, prefs));

      const ranked = candidates
        .map((shoe) => {
          const score = totalScore(shoe, prefs);
          const { reasons, cautions } = explain(shoe, prefs);
          return { shoe, score, reasons, cautions };
        })
        .sort((a, b) => b.score - a.score);

      return ranked;
    },
  };
})();