// The check. Data comes from data/*.json. Unverified stays visibly unverified.

const $ = (s, r = document) => r.querySelector(s);
const el = (t, cls, html) => {
  const n = document.createElement(t);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const state = { device: null, downgrade: null, rom: null };

let DEVICES = null, RULES = null;

async function boot() {
  [DEVICES, RULES] = await Promise.all([
    fetch("/data/devices.json").then((r) => r.json()),
    fetch("/data/rules.json").then((r) => r.json()),
  ]);

  const sel = $("#device");
  if (sel) {
    for (const d of DEVICES.devices) {
      const o = el("option");
      o.value = d.id;
      o.textContent = `${d.name} (${d.markets.join("/")})`;
      sel.appendChild(o);
    }
    sel.addEventListener("change", () => { state.device = sel.value || null; render(); });
  }

  for (const g of document.querySelectorAll("[data-group]")) {
    g.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      const key = g.dataset.group;
      state[key] = state[key] === b.dataset.value ? null : b.dataset.value;
      for (const x of g.querySelectorAll("button"))
        x.setAttribute("aria-pressed", String(x.dataset.value === state[key]));
      render();
    });
  }

  renderCoverage();
  render();
}

function renderCoverage() {
  const box = $("#coverage");
  if (!box) return;
  const keys = ["bl_unlock", "edl_auth", "arb", "felica", "lineageos"];
  let total = 0, unknown = 0;
  for (const d of DEVICES.devices)
    for (const k of keys) { total++; if (d.fields?.[k]?.value == null) unknown++; }
  const pct = Math.round((unknown / total) * 100);
  box.innerHTML = "";
  box.append(
    el("span", null, `${DEVICES.devices.length} devices / <strong>${unknown} of ${total} fields unverified</strong>`),
    (() => { const b = el("span", "bar"); b.appendChild(el("i")).style.width = pct + "%"; return b; })(),
    el("span", null, `${pct}%`)
  );
}

function fieldRow(label, f) {
  if (!f || f.value == null) {
    return `<tr><th>${esc(label)}</th><td><span class="tag unknown">unverified</span>
      ${f?.note ? `<div class="src">${esc(f.note)}</div>` : ""}</td></tr>`;
  }
  const v = typeof f.value === "boolean" ? (f.value ? "yes" : "no") : f.value;
  return `<tr><th>${esc(label)}</th><td>${esc(v)}
    ${f.note ? `<div class="src">${esc(f.note)}</div>` : ""}
    <div class="src">${esc(f.verified_at)} · <a href="${esc(f.source)}" rel="noopener nofollow" target="_blank">source</a></div>
    </td></tr>`;
}

function render() {
  const out = $("#result");
  if (!out) return;
  out.innerHTML = "";

  const d = DEVICES.devices.find((x) => x.id === state.device);
  const arb = RULES.irreversible.find((r) => r.id === "arb");
  const edl = RULES.irreversible.find((r) => r.id === "edl");

  // 1. Irreversibility verdict. Works without device data — this is the core.
  // Data strings end in a period; drop it when embedding mid-sentence.
  const clip = (s) => esc(String(s).replace(/。\s*$/, ""));

  if (state.downgrade === "yes") {
    out.appendChild(el("div", "panel danger", `
      <div class="verdict"><span class="tag danger">irreversible risk</span></div>
      <p><strong>${esc(arb.title)}</strong> applies here. ${esc(arb.result)}</p>
      <p>${esc(arb.avoid)}</p>
      <p class="src">&rarr; <a href="/risk/#arb">ARB detail</a></p>`));
  } else if (state.downgrade === "unknown") {
    out.appendChild(el("div", "panel danger", `
      <div class="verdict"><span class="tag danger">do not flash</span></div>
      <p>Flashing without knowing the ARB index can end here: ${clip(arb.result)}.
      "It is probably newer" is not a check.</p>
      <p class="src">&rarr; <a href="/risk/#arb">ARB detail</a></p>`));
  } else if (state.downgrade === "no") {
    out.appendChild(el("div", "panel ok", `
      <div class="verdict"><span class="tag ok">ARB condition cleared</span></div>
      <p>Not downgrading removes the largest cause of permanent failure. The
      <a href="/risk/#edl">EDL</a> risk remains: ${clip(edl.result)}.</p>`));
  }

  // 2. ROM type
  if (state.rom) {
    const t = RULES.rom_types.find((x) => x.id === state.rom);
    out.appendChild(el("div", "panel", `
      <div class="verdict">${esc(t.name)} <span class="tag ${t.open_source ? "ok" : "warn"}">
        ${t.open_source ? "source published" : "source closed"}</span></div>
      <p>${esc(t.detail)}</p>`));
  }

  // 3. Device data. Blank fields are shown as blank.
  if (d) {
    out.appendChild(el("div", "panel", `
      <div class="verdict">${esc(d.name)}</div>
      <div class="scroll"><table>
        ${fieldRow("unlock", d.fields.bl_unlock)}
        ${fieldRow("EDL auth required", d.fields.edl_auth)}
        ${fieldRow("ARB index", d.fields.arb)}
        ${fieldRow("FeliCa", d.fields.felica)}
        ${fieldRow("LineageOS", d.fields.lineageos)}
      </table></div>
      <p class="src">Unverified fields can only be filled by someone holding the device.
      <a href="https://github.com/gdalabs/romguard">Pull requests welcome</a>.</p>`));
  }

  if (!out.children.length)
    out.appendChild(el("p", "src", "Answer the questions above to get a verdict."));
}

boot();
