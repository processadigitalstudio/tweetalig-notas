// tarjetas-clases.js
// Muestra las clases del profesor como tarjetas (en vez de un desplegable).
// Las clases de períodos activos van arriba; las de períodos cerrados, plegadas aparte.
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const CSS = `
.tc-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:12px; margin:0 0 16px; }
.tc-card { text-align:left; background:#fff; border:1px solid var(--linea); border-left:5px solid var(--verde-marca); border-radius:10px; padding:12px 14px; cursor:pointer; font-family:var(--fuente-cuerpo); color:var(--tinta); transition:box-shadow .15s, transform .15s; display:block; text-decoration:none; }
.tc-card:hover { box-shadow:0 4px 14px rgba(44,61,77,.14); transform:translateY(-1px); }
.tc-card.tc-activa { border-color:var(--azul-profundo); border-left-color:var(--dorado,#E6C14F); box-shadow:0 0 0 2px var(--azul-profundo) inset; background:#f3f8f6; }
.tc-card.tc-dist { border-left-color:var(--terracota,#D48167); }
.tc-card.tc-cerrada { border-left-color:#aab4bc; opacity:.85; }
.tc-nivel { font-family:var(--fuente-display); font-size:19px; color:var(--azul-profundo); margin:0 0 2px; }
.tc-prog { font-size:12px; color:var(--tinta-suave); margin:0 0 8px; }
.tc-fila { font-size:12.5px; margin:2px 0; }
.tc-chip { display:inline-block; font-size:11px; padding:2px 7px; border-radius:10px; background:#e8f1ee; color:#2d6a58; margin:6px 4px 0 0; }
.tc-chip.dist { background:#f7e6df; color:#9a4e37; }
.tc-acciones { display:flex; gap:8px; margin-top:10px; }
.tc-acciones a { font-size:12.5px; color:var(--azul-profundo); text-decoration:underline; }
.tc-tit { font-size:13px; font-weight:600; color:var(--tinta-suave); margin:0 0 8px; text-transform:uppercase; letter-spacing:.03em; }
.tc-barra { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin:0 0 14px; }
.tc-barra .tc-card { flex:1 1 260px; max-width:420px; }
.tc-ver { background:#fff; border:1px solid var(--azul-profundo); color:var(--azul-profundo); border-radius:8px; padding:8px 14px; font-size:13px; cursor:pointer; font-family:var(--fuente-cuerpo); }
.tc-ver:hover { background:var(--azul-profundo); color:#fff; }
details.tc-prev { margin:4px 0 16px; } details.tc-prev summary { cursor:pointer; font-size:13px; color:var(--tinta-suave); margin-bottom:10px; }
`;

function inyectarCss() {
  if (document.getElementById("tc-css")) return;
  const st = document.createElement("style");
  st.id = "tc-css"; st.textContent = CSS;
  document.head.appendChild(st);
}

// Períodos marcados como cerrados (activo === false). Los demás cuentan como activos.
export async function periodosCerrados(db) {
  const cerrados = new Set();
  try {
    const snap = await getDocs(collection(db, "periodos"));
    snap.forEach((d) => { const p = d.data(); if (p.activo === false) cerrados.add(`${p.anio}-${p.periodo}-${p.ciclo}`); });
  } catch (e) { /* si no se puede leer, todas se muestran como activas */ }
  return cerrados;
}

// Cerrados + fechas de inicio y fin de cada período académico.
export async function infoPeriodos(db) {
  const cerrados = new Set(); const fechas = new Map();
  try {
    const snap = await getDocs(collection(db, "periodos"));
    snap.forEach((d) => {
      const p = d.data(); const k = `${p.anio}-${p.periodo}-${p.ciclo}`;
      if (p.activo === false) cerrados.add(k);
      fechas.set(k, { ini: p.fechaInicio || "", fin: p.fechaFin || "" });
    });
  } catch (e) { /* sin permiso: sin fechas */ }
  return { cerrados, fechas };
}
const fechaCorta = (f) => { const m = String(f || "").match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ""; };

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function textoHorarios(clases) {
  const vistos = new Set();
  clases.forEach((c) => (c.horarios || []).forEach((h) => vistos.add(`${h.dia} ${h.horaInicio}-${h.horaFin}`)));
  return [...vistos].join(" · ");
}

// grupos: [{key, clases:[...]}]. enlaces: si se da, cada tarjeta muestra esos atajos (para el panel de inicio).
export function pintarTarjetas(contenedor, grupos, opciones = {}) {
  const { cerrados = new Set(), fechas = new Map(), alElegir = null, enlaces = null } = opciones;
  let seleccionada = opciones.seleccionada || "";
  let expandido = !seleccionada || !!opciones.expandido;
  inyectarCss();
  const repintar = () => pintarTarjetas(contenedor, grupos, { ...opciones, seleccionada, expandido });
  contenedor.innerHTML = "";
  const clave = (g) => { const c = g.clases[0]; return `${c.anio}-${c.periodo}-${c.ciclo}`; };
  const activos = grupos.filter((g) => !cerrados.has(clave(g)));
  const previos = grupos.filter((g) => cerrados.has(clave(g)));

  function tarjeta(g) {
    const c = g.clases[0];
    const dist = String(c.programaNombre || "").toLowerCase().includes("distancia");
    const sedes = [...new Set(g.clases.map((x) => x.ciudadNombre).filter(Boolean))].join(" / ");
    const cerrada = cerrados.has(clave(g));
    const el = document.createElement(enlaces ? "div" : "button");
    if (!enlaces) el.type = "button";
    el.className = "tc-card" + (dist ? " tc-dist" : "") + (cerrada ? " tc-cerrada" : "") + (g.key === seleccionada ? " tc-activa" : "");
    el.dataset.key = g.key;
    const hor = textoHorarios(g.clases);
    el.innerHTML = `
      <p class="tc-nivel">${esc(c.nivel)} · ${esc(c.grupo)}</p>
      <p class="tc-prog">${esc(c.programaNombre || "Sin programa")}</p>
      <p class="tc-fila">📍 ${esc(sedes || "—")}</p>
      <p class="tc-fila">🕒 ${esc(hor || "Sin horario")}</p>
      ${(() => { const f = fechas.get(clave(g)); return f && (f.ini || f.fin) ? `<p class="tc-fila">📅 ${fechaCorta(f.ini) || "—"} → ${fechaCorta(f.fin) || "—"}</p>` : ""; })()}
      <span class="tc-chip${dist ? " dist" : ""}">${c.anio}-${c.periodo} · Ciclo ${c.ciclo}</span>${dist ? '<span class="tc-chip dist">Distancia</span>' : ""}
      ${enlaces ? `<div class="tc-acciones">${enlaces.map((e) => `<a href="${e.href(g)}">${esc(e.texto)}</a>`).join("")}</div>` : ""}`;
    if (!enlaces) el.addEventListener("click", () => { seleccionada = g.key; expandido = false; if (alElegir) alElegir(g.key); repintar(); });
    return el;
  }

  if (!enlaces && seleccionada && !expandido) {
    const g = grupos.find((x) => x.key === seleccionada);
    if (g) {
      const barra = document.createElement("div"); barra.className = "tc-barra";
      barra.appendChild(tarjeta(g));
      if (grupos.length > 1) {
        const b = document.createElement("button"); b.type = "button"; b.className = "tc-ver";
        b.textContent = `▼ Ver todas mis clases (${grupos.length})`;
        b.addEventListener("click", () => { expandido = true; repintar(); });
        barra.appendChild(b);
      }
      contenedor.appendChild(barra);
      return;
    }
  }
  if (!enlaces && seleccionada && expandido && grupos.length > 1) {
    const b = document.createElement("button"); b.type = "button"; b.className = "tc-ver"; b.style.marginBottom = "12px";
    b.textContent = "▲ Ocultar y volver a la clase elegida";
    b.addEventListener("click", () => { expandido = false; repintar(); });
    contenedor.appendChild(b);
  }
  if (activos.length) {
    const t = document.createElement("p"); t.className = "tc-tit"; t.textContent = `Mis clases activas (${activos.length})`;
    const grid = document.createElement("div"); grid.className = "tc-grid";
    activos.forEach((g) => grid.appendChild(tarjeta(g)));
    contenedor.append(t, grid);
  }
  if (previos.length) {
    const det = document.createElement("details"); det.className = "tc-prev";
    if (!activos.length || previos.some((g) => g.key === seleccionada)) det.open = true;
    det.innerHTML = `<summary>📁 Histórico — clases de períodos cerrados (${previos.length})</summary>`;
    const grid = document.createElement("div"); grid.className = "tc-grid";
    previos.sort((x, y) => (clave(y) > clave(x) ? 1 : -1)).forEach((g) => grid.appendChild(tarjeta(g)));
    det.appendChild(grid);
    contenedor.appendChild(det);
  }
}

export function marcarSeleccion(contenedor, clave) {
  contenedor.querySelectorAll(".tc-card").forEach((c) => c.classList.toggle("tc-activa", c.dataset.key === clave));
}
