(function () {
  const $ = (sel) => document.querySelector(sel);

  function getFormPrefs(form) {
    const fd = new FormData(form);
    const prefs = {
      surface: String(fd.get("surface") || "road"),
      budget: Number(fd.get("budget") || 180),
      distance: String(fd.get("distance") || "hm"),
      use: String(fd.get("use") || "daily"),
      stability: String(fd.get("stability") || "neutral"),
      width: String(fd.get("width") || "regular"),
      cushion: String(fd.get("cushion") || "balanced"),
      weightKg: Number(fd.get("weightKg") || 72),
      terrain: String(fd.get("terrain") || "mixed"),
      trailPriority: String(fd.get("trailPriority") || "grip"),
    };
    return prefs;
  }

  function fmtMoney(n) {
    return `$${Math.round(n)}`;
  }

  function badge(text, kind) {
    const cls = kind ? `badge ${kind}` : "badge";
    return `<span class="${cls}">${text}</span>`;
  }

  function renderRec(item, idx) {
    const { shoe, score, reasons, cautions } = item;

    const topBadges = [
      badge(`#${idx + 1}`, "good"),
      badge(shoe.category.toUpperCase()),
      badge(fmtMoney(shoe.msrp)),
      badge(`${shoe.dropMm}mm drop`),
      badge(`${shoe.weightG}g`),
    ].join("");

    const reasonBadges = reasons.slice(0, 4).map((r) => badge(r, "good")).join("");
    const cautionBadges = cautions.slice(0, 3).map((c) => badge(c, "warn")).join("");

    const notes = (shoe.notes ?? []).slice(0, 3).map((n) => `<li>${n}</li>`).join("");

    return `
      <article class="rec">
        <div class="recTop">
          <div>
            <div><strong>${shoe.brand} ${shoe.model}</strong></div>
            <div class="muted">Score: ${(score * 100).toFixed(1)} / 100</div>
          </div>
          <div class="badges">${topBadges}</div>
        </div>

        <div class="badges" style="margin-top:10px">${reasonBadges}${cautionBadges}</div>

        <div class="kv">
          <div><strong>Best use</strong><br/>${(shoe.bestUse ?? []).join(", ")}</div>
          <div><strong>Distance</strong><br/>${(shoe.distance ?? []).join(", ").toUpperCase()}</div>
          <div><strong>Stability</strong><br/>${shoe.stability}</div>
          <div><strong>Cushion</strong><br/>${shoe.cushionFeel}</div>
        </div>

        <div style="margin-top:10px">
          <div class="muted" style="margin-bottom:6px">Notes</div>
          <ul class="muted" style="margin:0; padding-left:18px">${notes}</ul>
        </div>
      </article>
    `;
  }

  function renderCatalogTable(catalog) {
    const rows = catalog
      .map((s) => {
        const extras =
          s.category === "trail"
            ? `lug ${s.trail?.lugMm ?? "-"}mm, grip ${s.trail?.grip ?? "-"}`
            : s.category === "track"
              ? `${s.track?.type ?? "track"}`
              : "—";

        return `<tr>
          <td><strong style="color: var(--text)">${s.brand} ${s.model}</strong></td>
          <td>${s.category}</td>
          <td>${fmtMoney(s.msrp)}</td>
          <td>${s.weightG}g</td>
          <td>${s.dropMm}mm</td>
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
            <th>MSRP</th>
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

  function init() {
    const catalog = window.SHOE_CATALOG ?? [];
    $("#catalog").innerHTML = renderCatalogTable(catalog);

    const form = $("#prefsForm");
    const results = $("#results");
    const meta = $("#meta");
    const resetBtn = $("#resetBtn");

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const prefs = getFormPrefs(form);
      const ranked = window.Recommender.recommend(prefs, catalog);

      const top = ranked.slice(0, 5);
      meta.textContent = `${ranked.length} matches • showing top ${top.length}`;

      if (top.length === 0) {
        results.innerHTML =
          '<p class="muted">No matches found. Try increasing budget or changing stability/width.</p>';
        return;
      }

      results.innerHTML = top.map(renderRec).join("");
    });

    resetBtn.addEventListener("click", () => {
      form.reset();
      meta.textContent = "";
      results.innerHTML = '<p class="muted">Fill the form and click <em>Recommend shoes</em>.</p>';
    });
  }

  window.addEventListener("DOMContentLoaded", init);
})();