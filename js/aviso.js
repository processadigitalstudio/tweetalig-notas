// Ventanita de confirmación que aparece arriba y se va sola. tipo: "ok" | "error".
export function mostrarAviso(mensaje, tipo = "ok") {
  let caja = document.getElementById("caja-avisos-globales");
  if (!caja) {
    caja = document.createElement("div");
    caja.id = "caja-avisos-globales";
    caja.setAttribute("role", "status");
    caja.setAttribute("aria-live", "polite");
    caja.style.cssText = "position:fixed; top:18px; left:50%; transform:translateX(-50%); z-index:9999; display:flex; flex-direction:column; gap:8px; align-items:center; pointer-events:none;";
    document.body.appendChild(caja);
  }
  const t = document.createElement("div");
  const ok = tipo === "ok";
  t.style.cssText = `background:${ok ? "#5DB69C" : "#B4412B"}; color:#fff; font-family:var(--fuente-cuerpo, sans-serif); font-size:14.5px; font-weight:600; padding:13px 22px; border-radius:10px; box-shadow:0 6px 20px rgba(0,0,0,.22); max-width:90vw; opacity:0; transition:opacity .25s;`;
  t.textContent = (ok ? "✔ " : "✕ ") + mensaje;
  caja.appendChild(t);
  requestAnimationFrame(() => { t.style.opacity = "1"; });
  setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 300); }, ok ? 3500 : 7000);
}
