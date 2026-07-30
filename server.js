#!/usr/bin/env node

// Zero-dependency local API and static server. For production, place this
// behind HTTPS and point SHOE_DB_PATH at a regularly imported database.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const Recommender = require("./src/recommender.js");

const root = __dirname;
const port = Number(process.env.PORT || 8080);
const databasePath = process.env.SHOE_DB_PATH || path.join(root, "db", "sqlite", "shoe_kb.sqlite");

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value || "");
  } catch {
    return fallback;
  }
}

function openDatabase() {
  if (!fs.existsSync(databasePath)) throw new Error(`Database not found at ${databasePath}. Run npm run import:india first.`);
  return new DatabaseSync(databasePath);
}

function catalog(market = "IN") {
  const db = openDatabase();
  try {
    const rows = db.prepare(`
      SELECT mv.id AS variant_id, mv.gender, mv.msrp_cents, mv.currency_code, mv.available, mv.source_url,
             f.brand, f.model, f.category,
             sp.weight_g_men, sp.weight_g_women, sp.stack_mm_heel, sp.stack_mm_forefoot, sp.drop_mm,
             sp.lug_depth_mm, sp.rock_plate, sp.waterproof, sp.gaiter_compatible,
             a.stability, a.cushion, a.width_options_json, a.best_use_json, a.distance_focus_json, a.notes_json,
             sc.cushioning_score, sc.responsiveness_score, sc.stability_score, sc.durability_score,
             sc.value_score, sc.grip_score, sc.protection_score
      FROM shoe_market_variant mv
      JOIN shoe_version v ON v.id = mv.shoe_version_id
      JOIN shoe_family f ON f.id = v.family_id
      LEFT JOIN shoe_specs sp ON sp.shoe_version_id = v.id
      LEFT JOIN shoe_attributes a ON a.shoe_version_id = v.id
      LEFT JOIN shoe_scores sc ON sc.shoe_version_id = v.id
      WHERE mv.market_code = ? AND mv.available = 1 AND v.discontinued = 0
      ORDER BY f.brand, f.model, mv.gender
    `).all(market);

    return rows.map((row) => ({
      id: row.variant_id,
      brand: row.brand,
      model: row.model,
      gender: row.gender,
      category: row.category,
      msrp_inr: Math.round(row.msrp_cents / 100),
      weight_g: row.gender === "women" ? row.weight_g_women : row.weight_g_men,
      drop_mm: row.drop_mm,
      stack_mm_heel: row.stack_mm_heel,
      stack_mm_forefoot: row.stack_mm_forefoot,
      stability: row.stability || "neutral",
      cushion: row.cushion || "balanced",
      width_options: parseJson(row.width_options_json, ["regular"]),
      best_use: parseJson(row.best_use_json, []),
      distance_focus: parseJson(row.distance_focus_json, []),
      lug_depth_mm: row.lug_depth_mm,
      rock_plate: Boolean(row.rock_plate),
      waterproof: Boolean(row.waterproof),
      gaiter_compatible: Boolean(row.gaiter_compatible),
      scores: {
        cushioning: row.cushioning_score,
        responsiveness: row.responsiveness_score,
        stability: row.stability_score,
        durability: row.durability_score,
        value: row.value_score,
        grip: row.grip_score,
        protection: row.protection_score,
      },
      source_url: row.source_url || null,
      notes: parseJson(row.notes_json, []),
    }));
  } finally {
    db.close();
  }
}

const countryConfig = {
  IN: { currencyCode: "INR", currencySymbol: "₹", currencyPosition: "prefix", usdRate: 83 },
  US: { currencyCode: "USD", currencySymbol: "$", currencyPosition: "prefix", usdRate: 1 },
  GB: { currencyCode: "GBP", currencySymbol: "£", currencyPosition: "prefix", usdRate: 0.78 },
  EU: { currencyCode: "EUR", currencySymbol: "€", currencyPosition: "prefix", usdRate: 0.92 },
  CA: { currencyCode: "CAD", currencySymbol: "C$", currencyPosition: "prefix", usdRate: 1.35 },
  AU: { currencyCode: "AUD", currencySymbol: "A$", currencyPosition: "prefix", usdRate: 1.5 },
  SG: { currencyCode: "SGD", currencySymbol: "S$", currencyPosition: "prefix", usdRate: 1.35 },
};

function recommendationCatalog(prefs) {
  const country = countryConfig[prefs.country] ? prefs.country : "IN";
  const config = countryConfig[country];
  return catalog("IN").map((shoe) => {
    const localizedPrice = country === "IN" ? shoe.msrp_inr : Math.round((shoe.msrp_inr / countryConfig.IN.usdRate) * config.usdRate);
    return {
      ...shoe,
      msrp: localizedPrice,
      priceCurrency: config.currencyCode,
      priceSource: country === "IN" ? "local" : "estimated",
      weightG: shoe.weight_g,
      dropMm: shoe.drop_mm,
      cushionFeel: shoe.cushion,
      widthOptions: shoe.width_options,
      bestUse: shoe.best_use,
      distance: shoe.distance_focus,
      ride: {
        cushioning: shoe.scores.cushioning ?? 5,
        responsiveness: shoe.scores.responsiveness ?? 5,
        stability: shoe.scores.stability ?? 5,
        durability: shoe.scores.durability ?? 5,
        value: shoe.scores.value ?? 5,
      },
      trail: shoe.category === "trail" ? {
        lugMm: shoe.lug_depth_mm,
        grip: shoe.scores.grip,
        protection: shoe.scores.protection,
        rockPlate: shoe.rock_plate,
        waterproof: shoe.waterproof,
        gaiterCompatible: shoe.gaiter_compatible,
        terrain: ["mixed"],
      } : undefined,
    };
  });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 100_000) reject(new Error("Request body too large."));
    });
    req.on("end", () => {
      try { resolve(JSON.parse(body || "{}")); } catch { reject(new Error("Invalid JSON request body.")); }
    });
    req.on("error", reject);
  });
}

const contentTypes = { ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8" };

function serveStatic(req, res, pathname) {
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = path.resolve(root, relativePath);
  const isPublicAsset = relativePath === "index.html" || relativePath === "styles.css" || relativePath.startsWith("src/") || relativePath.startsWith("data/");
  if (!isPublicAsset || !filePath.startsWith(`${root}${path.sep}`) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404); res.end("Not found"); return;
  }
  res.writeHead(200, { "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    if (url.pathname === "/api/health") return json(res, 200, { ok: true, database: path.basename(databasePath) });
    if (url.pathname === "/api/shoes" || url.pathname === "/api/catalog") {
      const market = (url.searchParams.get("market") || "IN").toUpperCase();
      if (market !== "IN") return json(res, 400, { error: "Only the IN market is currently available." });
      return json(res, 200, { schema_version: "1.0", market, currency: "INR", generated_at: new Date().toISOString(), shoes: catalog(market) });
    }
    if (url.pathname === "/api/recommend" && req.method === "POST") {
      const { prefs } = await readJson(req);
      if (!prefs || typeof prefs !== "object") return json(res, 400, { error: "A preferences object is required." });
      const ranked = Recommender.recommend(prefs, recommendationCatalog(prefs));
      return json(res, 200, { recommendations: ranked, generated_at: new Date().toISOString() });
    }
    return serveStatic(req, res, url.pathname);
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: "Catalog service unavailable." });
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Open http://localhost:${port} or run: PORT=${port + 1} npm start`);
    process.exitCode = 1;
    return;
  }
  throw error;
});

server.listen(port, () => console.log(`Runner Shoe API available at http://localhost:${port}`));
