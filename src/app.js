(function () {
  const $ = (sel) => document.querySelector(sel);

  const COUNTRY_CONFIG = {
    IN: {
      name: "India",
      currencyCode: "INR",
      currencySymbol: "₹",
      currencyPosition: "prefix",
      defaultBudget: 18000,
      minBudget: 3000,
      step: 500,
      usdRate: 83,
      note: "Prices are shown in INR. India catalog prices are used when available.",
    },
    US: {
      name: "United States",
      currencyCode: "USD",
      currencySymbol: "$",
      currencyPosition: "prefix",
      defaultBudget: 180,
      minBudget: 50,
      step: 10,
      usdRate: 1,
      note: "Prices are shown in USD using available MSRP or estimated local equivalents.",
    },
    GB: {
      name: "United Kingdom",
      currencyCode: "GBP",
      currencySymbol: "£",
      currencyPosition: "prefix",
      defaultBudget: 160,
      minBudget: 40,
      step: 10,
      usdRate: 0.78,
      note: "Prices are shown in GBP using estimated local equivalents where exact prices are unavailable.",
    },
    EU: {
      name: "Europe",
      currencyCode: "EUR",
      currencySymbol: "€",
      currencyPosition: "prefix",
      defaultBudget: 180,
      minBudget: 50,
      step: 10,
      usdRate: 0.92,
      note: "Prices are shown in EUR using estimated local equivalents where exact prices are unavailable.",
    },
    CA: {
      name: "Canada",
      currencyCode: "CAD",
      currencySymbol: "C$",
      currencyPosition: "prefix",
      defaultBudget: 250,
      minBudget: 70,
      step: 10,
      usdRate: 1.35,
      note: "Prices are shown in CAD using estimated local equivalents where exact prices are unavailable.",
    },
    AU: {
      name: "Australia",
      currencyCode: "AUD",
      currencySymbol: "A$",
      currencyPosition: "prefix",
      defaultBudget: 280,
      minBudget: 80,
      step: 10,
      usdRate: 1.5,
      note: "Prices are shown in AUD using estimated local equivalents where exact prices are unavailable.",
    },
    SG: {
      name: "Singapore",
      currencyCode: "SGD",
      currencySymbol: "S$",
      currencyPosition: "prefix",
      defaultBudget: 250,
      minBudget: 70,
      step: 10,
      usdRate: 1.35,
      note: "Prices are shown in SGD using estimated local equivalents where exact prices are unavailable.",
    },
  };

  function getCountryConfig(country) {
    return COUNTRY_CONFIG[country] ?? COUNTRY_CONFIG.IN;
  }

  function formatMoneyForCountry(n, country) {
    const cfg = getCountryConfig(country);
    const value = Math.round(Number(n) || 0).toLocaleString(undefined, {
      maximumFractionDigits: 0,
    });

    return cfg.currencyPosition === "suffix"
      ? `${value} ${cfg.currencySymbol}`
      : `${cfg.currencySymbol}${value}`;
  }

  function getFormPrefs(form) {
    const fd = new FormData(form);
    const country = String(fd.get("country") || "IN");
    const countryConfig = getCountryConfig(country);

    const prefs = {
      country,
      countryName: countryConfig.name,
      currencyCode: countryConfig.currencyCode,
      currencySymbol: countryConfig.currencySymbol,
      currencyPosition: countryConfig.currencyPosition,
      surface: String(fd.get("surface") || "road"),
      budget: Number(fd.get("budget") || countryConfig.defaultBudget),
      distance: String(fd.get("distance") || "hm"),
      use: String(fd.get("use") || "daily"),
      gender: String(fd.get("gender") || "all"),
      stability: String(fd.get("stability") || "neutral"),
      width: String(fd.get("width") || "regular"),
      cushion: String(fd.get("cushion") || "balanced"),
      weightKg: Number(fd.get("weightKg") || 72),
      terrain: String(fd.get("terrain") || "mixed"),
      trailPriority: String(fd.get("trailPriority") || "grip"),
    };
    return prefs;
  }

  function fmtMoney(n, country = "IN") {
    return formatMoneyForCountry(n, country);
  }

  function formatMeasurement(value, unit) {
    return value === null || value === undefined ? "—" : `${value}${unit}`;
  }

  function badge(text, kind) {
    const cls = kind ? `badge ${kind}` : "badge";
    return `<span class="${cls}">${text}</span>`;
  }

  function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
  }

  function localizePrice(shoe, country) {
    const cfg = getCountryConfig(country);

    if (shoe.prices?.[country]) {
      return {
        amount: shoe.prices[country],
        source: "local",
      };
    }

    if (shoe.priceCurrency === cfg.currencyCode) {
      return {
        amount: shoe.msrp,
        source: "local",
      };
    }

    let usdPrice = Number(shoe.msrp) || 0;
    if (shoe.priceCurrency === "INR") {
      usdPrice = usdPrice / COUNTRY_CONFIG.IN.usdRate;
    }

    return {
      amount: Math.round(usdPrice * cfg.usdRate),
      source: "estimated",
    };
  }

  function localizeCatalogForCountry(catalog, country) {
    return (catalog ?? []).map((shoe) => {
      const localized = localizePrice(shoe, country);
      return {
        ...shoe,
        msrp: localized.amount,
        priceCurrency: getCountryConfig(country).currencyCode,
        priceSource: localized.source,
        marketCountry: country,
      };
    });
  }

  function renderRec(item, idx, prefs) {
    const { shoe, score, reasons, cautions } = item;
    const country = prefs?.country ?? "IN";
    const priceLabel = fmtMoney(shoe.msrp, country);
    const priceSourceLabel = shoe.priceSource === "estimated" ? "est. price" : "local price";

    const topBadges = [
      badge(`#${idx + 1}`, "good"),
      badge(shoe.category.toUpperCase()),
      shoe.gender ? badge(`${shoe.gender} fit`) : "",
      badge(priceLabel),
      badge(priceSourceLabel),
      badge(`${formatMeasurement(shoe.dropMm, "mm")} drop`),
      badge(formatMeasurement(shoe.weightG, "g")),
    ].join("");

    const reasonBadges = reasons.slice(0, 4).map((r) => badge(r, "good")).join("");
    const cautionBadges = cautions.slice(0, 3).map((c) => badge(c, "warn")).join("");

    const notes = (shoe.notes ?? [])
      .slice(0, 3)
      .map((n) => `<li>${escapeHtml(n)}</li>`)
      .join("");

    const countryNote =
      shoe.priceSource === "estimated"
        ? `Estimated ${prefs.currencyCode} price for ${prefs.countryName}; check local retailers for exact availability.`
        : `Shown with ${prefs.countryName} pricing.`;

    return `
      <article class="rec">
        <div class="recTop">
          <div>
            <div><strong>${escapeHtml(shoe.brand)} ${escapeHtml(shoe.model)}</strong></div>
            <div class="muted">Match: ${(score * 100).toFixed(1)} / 100</div>
          </div>
          <div class="badges">${topBadges}</div>
        </div>

        <p class="countryNote">${escapeHtml(countryNote)}</p>

        <div class="badges" style="margin-top:10px">${reasonBadges}${cautionBadges}</div>

        <div class="kv">
          <div><strong>Best use</strong><br/>${(shoe.bestUse ?? []).join(", ")}</div>
          <div><strong>Distance</strong><br/>${(shoe.distance ?? []).join(", ").toUpperCase()}</div>
          <div><strong>Stability</strong><br/>${shoe.stability}</div>
          <div><strong>Cushion</strong><br/>${shoe.cushionFeel}</div>
        </div>

        <div style="margin-top:10px">
          <div class="muted" style="margin-bottom:6px">Why this helps you</div>
          <ul class="muted" style="margin:0; padding-left:18px">${notes}</ul>
        </div>
      </article>
    `;
  }

  function renderCatalogTable(catalog, prefs = { country: "IN" }) {
    const rows = catalog
      .map((s) => {
        const extras =
          s.category === "trail"
            ? `lug ${s.trail?.lugMm ?? "-"}mm, grip ${s.trail?.grip ?? "-"}`
            : s.category === "track"
              ? `${s.track?.type ?? "track"}`
              : "—";

        return `<tr>
          <td><strong style="color: var(--text)">${escapeHtml(s.brand)} ${escapeHtml(s.model)}</strong></td>
          <td>${s.category}</td>
          <td>${fmtMoney(s.msrp, prefs.country)} ${s.priceSource === "estimated" ? "<span class=\"muted\">est.</span>" : ""}</td>
          <td>${formatMeasurement(s.weightG, "g")}</td>
          <td>${formatMeasurement(s.dropMm, "mm")}</td>
          <td>${s.stability}</td>
          <td>${s.cushionFeel}</td>
          <td>${extras}</td>
        </tr>`;
      })
      .join("");

    return `
      <table>
        <thead>
          <tr>
            <th>Shoe</th>
            <th>Category</th>
            <th>Price</th>
            <th>Weight</th>
            <th>Drop</th>
            <th>Stability</th>
            <th>Cushion</th>
            <th>Trail/Track</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function updateCountryUi(form, baseCatalog) {
    const country = form.country.value || "IN";
    const cfg = getCountryConfig(country);
    const budget = form.budget;

    budget.min = String(cfg.minBudget);
    budget.step = String(cfg.step);

    if (!budget.dataset.userEdited) {
      budget.value = String(cfg.defaultBudget);
    }

    const budgetLabel = $("#budgetLabel");
    if (budgetLabel) {
      budgetLabel.textContent = `Budget (${cfg.currencyCode}, max)`;
    }

    const countryNotice = $("#countryNotice");
    if (countryNotice) {
      countryNotice.innerHTML = `<strong>${cfg.name} selected:</strong> ${cfg.note}`;
    }

    const prefs = getFormPrefs(form);
    const localizedCatalog = localizeCatalogForCountry(baseCatalog, country);
    $("#catalog").innerHTML = renderCatalogTable(localizedCatalog, prefs);
  }

  async function init() {
    const fallbackCatalog = window.SHOE_CATALOG ?? [];
    let catalog = fallbackCatalog;

    // Prefer external JSON catalog so the deployed site can use real-ish data
    // without bundling it in JS. Fallback to window.SHOE_CATALOG.
    try {
      // Prefer the API when served with `npm start`; opening index.html or
      // using a static host still works through the JSON fallback below.
      let res = await fetch("./api/shoes", { cache: "no-store" });
      if (!res.ok) res = await fetch("./data/shoes.json", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.shoes)) {
          const externalCatalog = data.shoes.map(normalizeExternalShoe);
          // The INR dataset is more detailed but currently has no track shoes.
          // Retain any category absent from it so every surface in the form works.
          const externalCategories = new Set(externalCatalog.map((shoe) => shoe.category));
          catalog = [
            ...externalCatalog,
            ...fallbackCatalog.filter((shoe) => !externalCategories.has(shoe.category)),
          ];
        }
      }
    } catch (e) {
      // ignore; we will use fallback
    }

    const form = $("#prefsForm");
    const results = $("#results");
    const meta = $("#meta");
    const resetBtn = $("#resetBtn");

    updateCountryUi(form, catalog);

    form.country.addEventListener("change", () => {
      form.budget.dataset.userEdited = "";
      updateCountryUi(form, catalog);
      meta.textContent = "";
      results.innerHTML = '<p class="muted">Fill the form and click <em>Recommend shoes</em>.</p>';
    });

    form.budget.addEventListener("input", () => {
      form.budget.dataset.userEdited = "true";
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const prefs = getFormPrefs(form);
      const localizedCatalog = localizeCatalogForCountry(catalog, prefs.country);
      results.innerHTML = '<p class="muted">Finding your best matches…</p>';

      let ranked;
      try {
        const response = await fetch("./api/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prefs }),
        });
        if (!response.ok) throw new Error("Recommendation API unavailable");
        const data = await response.json();
        if (!Array.isArray(data.recommendations)) throw new Error("Invalid recommendation response");
        ranked = data.recommendations;
      } catch (error) {
        // Keep direct-file and static-hosted deployments fully usable.
        ranked = window.Recommender.recommend(prefs, localizedCatalog);
      }

      const top = ranked.slice(0, 5);
      const fitLabel = prefs.gender === "all" ? "all fits" : `${prefs.gender}'s fit`;
      meta.textContent = `${ranked.length} ${fitLabel} matches in ${prefs.countryName} • showing top ${top.length}`;

      if (top.length === 0) {
        results.innerHTML =
          `<p class="muted">No matches found for ${prefs.countryName}. Try increasing your ${prefs.currencyCode} budget or changing stability/width.</p>`;
        return;
      }

      results.innerHTML = top.map((item, idx) => renderRec(item, idx, prefs)).join("");
      $("#catalog").innerHTML = renderCatalogTable(localizedCatalog, prefs);
    });

    resetBtn.addEventListener("click", () => {
      form.reset();
      form.budget.dataset.userEdited = "";
      updateCountryUi(form, catalog);
      meta.textContent = "";
      results.innerHTML = '<p class="muted">Fill the form and click <em>Recommend shoes</em>.</p>';
    });
  }

  function normalizeExternalShoe(s) {
    // Map `data/shoes.json` (starter dataset) into the internal structure used
    // by the recommender + UI.
    return {
      id: s.id,
      brand: s.brand,
      model: s.model,
      gender: s.gender,
      category: s.category,
      msrp: s.msrp_inr,
      prices: {
        IN: s.msrp_inr,
      },
      priceCurrency: "INR",
      weightG: s.weight_g ?? null,
      dropMm: s.drop_mm ?? null,
      stack: {
        heelMm: s.stack_mm_heel ?? null,
        forefootMm: s.stack_mm_forefoot ?? null,
      },
      stability: s.stability ?? "neutral",
      cushionFeel: s.cushion ?? "balanced",
      widthOptions: s.width_options ?? ["regular"],
      bestUse: s.best_use ?? [],
      distance: s.distance_focus ?? [],
      trail:
        s.category === "trail"
          ? {
              lugMm: s.lug_depth_mm ?? null,
              grip: s.scores?.grip ?? null,
              protection: s.scores?.protection ?? null,
              rockPlate: s.rock_plate ?? null,
              waterproof: s.waterproof ?? null,
              gaiterCompatible: s.gaiter_compatible ?? null,
              terrain: s.terrain ?? ["mixed"],
            }
          : undefined,
      track: s.category === "track" ? { type: "track" } : undefined,
      ride: {
        cushioning: s.scores?.cushioning ?? 5,
        responsiveness: s.scores?.responsiveness ?? 5,
        stability: s.scores?.stability ?? 5,
        durability: s.scores?.durability ?? 5,
        value: s.scores?.value ?? 5,
      },
      scores: s.scores ?? {},
      notes: s.notes ?? [],
    };
  }

  window.addEventListener("DOMContentLoaded", () => {
    init();
  });
})();
