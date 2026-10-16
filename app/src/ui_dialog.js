/* ── Real in-app popups ────────────────────────────────────────────────────
   Replaces the native alert()/confirm() dialogs — the WebView/Chrome
   "browser pop up" look the user explicitly banned. One styled modal in the
   app's own theme, Promise based, one instance at a time (a second call
   waits its turn instead of stacking). */

function ensureHost() {
  var host = document.getElementById("lt-dialog-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "lt-dialog-host";
    (document.body || document.documentElement).appendChild(host);
  }
  return host;
}

var _chain = Promise.resolve();

function showModal(opts) {
  var run = function (resolve) {
    try {
      var host = ensureHost();
      var back = document.createElement("div");
      back.style.cssText =
        "position:fixed;inset:0;background:rgba(4,9,30,.55);z-index:2147483000;" +
        "display:flex;align-items:center;justify-content:center;padding:26px;" +
        "opacity:0;transition:opacity .18s ease;box-sizing:border-box;";
      var box = document.createElement("div");
      box.setAttribute("role", "alertdialog");
      box.setAttribute("aria-modal", "true");
      box.style.cssText =
        "background:#FDFBF7;border-radius:20px;max-width:340px;width:100%;" +
        "padding:22px 20px 16px;box-shadow:0 24px 60px rgba(4,9,30,.4);" +
        "transform:translateY(10px);transition:transform .2s cubic-bezier(.22,.61,.36,1);" +
        "font-family:Inter,system-ui,-apple-system,sans-serif;box-sizing:border-box;";
      var t = document.createElement("div");
      t.textContent = opts.title || "Minutics";
      t.style.cssText =
        "font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;" +
        "color:#00A88F;margin-bottom:9px;";
      var m = document.createElement("div");
      m.textContent = opts.message || "";
      m.style.cssText =
        "font-size:14px;line-height:1.55;color:#1a2140;white-space:pre-wrap;" +
        "word-break:break-word;max-height:52vh;overflow:auto;";
      box.appendChild(t);
      box.appendChild(m);
      var row = document.createElement("div");
      row.style.cssText = "display:flex;gap:10px;justify-content:flex-end;margin-top:20px;flex-wrap:wrap;";
      (opts.buttons || [{ label: "OK", value: true, primary: true }]).forEach(function (b) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = b.label;
        btn.style.cssText =
          "border:none;border-radius:13px;padding:11px 20px;font-size:14px;font-weight:700;" +
          "cursor:pointer;font-family:inherit;transition:filter .12s ease;" +
          (b.danger ? "background:#FEE2E2;color:#B91C1C;"
            : b.primary ? "background:#00C2A8;color:#fff;"
              : "background:rgba(4,9,30,.07);color:#1a2140;");
        btn.addEventListener("click", function () { close(b.value); });
        row.appendChild(btn);
      });
      box.appendChild(row);
      back.appendChild(box);
      host.appendChild(back);
      requestAnimationFrame(function () {
        back.style.opacity = "1";
        box.style.transform = "translateY(0)";
      });
      var onKey = function (e) { if (e.key === "Escape") { e.stopPropagation(); close(null); } };
      window.addEventListener("keydown", onKey, true);
      var close = function (v) {
        window.removeEventListener("keydown", onKey, true);
        back.style.opacity = "0";
        box.style.transform = "translateY(10px)";
        setTimeout(function () { if (back.parentNode) back.parentNode.removeChild(back); }, 220);
        resolve(v);
      };
      back.addEventListener("click", function (e) { if (e.target === back) close(null); });
    } catch (e) {
      resolve(null);
    }
  };
  /* One dialog at a time: queue behind whatever is currently open. */
  _chain = _chain.then(function () { return new Promise(run); });
  return _chain;
}

/** Info popup with a single OK. Resolves when dismissed. */
export function ltAlert(message, title) {
  return showModal({
    title: title || "Minutics",
    message: String(message == null ? "" : message),
    buttons: [{ label: "OK", value: true, primary: true }]
  });
}

/** Yes/No question → Promise<boolean> (true only for the affirmative). */
export function ltAsk(message, title, opts) {
  return showModal({
    title: title || "Minutics",
    message: String(message == null ? "" : message),
    buttons: [
      { label: (opts && opts.no) || "No", value: false },
      { label: (opts && opts.yes) || "Yes", value: true, primary: true }
    ]
  });
}

/** Destructive question → Promise<boolean>, red confirm button. */
export function ltConfirmDanger(message, title, opts) {
  return showModal({
    title: title || "Are you sure?",
    message: String(message == null ? "" : message),
    buttons: [
      { label: (opts && opts.no) || "Cancel", value: false },
      { label: (opts && opts.yes) || "Delete", value: true, danger: true }
    ]
  });
}
