// Selector de profesor para coordinación, secretaría, Admin y Master (Notas y Asistencia).
// Filtra por sede, programa y búsqueda (nombre o correo); arranca en "Selecciona un profesor...".
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const sinTildes = (t) => String(t || "").toLowerCase().trim()
  .replace(/[áàäâ]/g, "a").replace(/[éèëê]/g, "e").replace(/[íìïî]/g, "i")
  .replace(/[óòöô]/g, "o").replace(/[úùüû]/g, "u");
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Devuelve { correoInicial } (null si no hay uno elegido). alCambiar(correo|null) se llama
// cada vez que el usuario elige (o deja sin elegir) un profesor.
export async function montarSelectorProfesor({ db, rol, perfil, correoDesdeUrl, alCambiar }) {
  const cont = document.getElementById("selector-profesor");
  cont.style.display = "block";
  const esCoord = rol === "coordinador" || rol === "secretaria";
  const misSedes = perfil?.ciudadIds || (perfil?.ciudadId ? [perfil.ciudadId] : []);
  const restringido = esCoord && misSedes.length > 0;

  // Profesores (usuarios) — incluye el formato antiguo de una sola sede.
  let docsProf = [];
  let errorUsuarios = null;
  try {
    const snapProf = await getDocs(restringido
      ? query(collection(db, "usuarios"), where("rol", "==", "profesor"), where("ciudadIds", "array-contains-any", misSedes))
      : query(collection(db, "usuarios"), where("rol", "==", "profesor")));
    docsProf = snapProf.docs;
  } catch (e) { errorUsuarios = e; console.warn("No se pudieron leer los profesores:", e); }
  if (restringido) {
    try {
      const viejos = await getDocs(query(collection(db, "usuarios"), where("rol", "==", "profesor"), where("ciudadId", "in", misSedes)));
      const ya = new Set(docsProf.map((d) => d.id));
      viejos.docs.forEach((d) => { if (!ya.has(d.id)) docsProf.push(d); });
    } catch (e) { console.warn("No se pudieron leer profesores del formato antiguo:", e); }
  }

  // Clases (para saber sede y programa de cada profesor).
  let clases = [];
  try {
    const snapCl = await getDocs(collection(db, "clases"));
    clases = snapCl.docs.map((d) => d.data());
    if (restringido) clases = clases.filter((c) => misSedes.includes(c.ciudadId));
  } catch (e) { console.warn("No se pudieron leer las clases:", e); }

  const nombresSede = new Map();
  try {
    (await getDocs(collection(db, "ciudades"))).docs.forEach((d) => nombresSede.set(d.id, d.data().nombre || d.id));
  } catch (e) { /* si falla, se usan los nombres de las clases */ }
  clases.forEach((c) => { if (c.ciudadId && !nombresSede.has(c.ciudadId)) nombresSede.set(c.ciudadId, c.ciudadNombre || c.ciudadId); });

  const profes = new Map(); // correo -> {correo, nombre, sedes:Set, programas:Set}
  docsProf.forEach((d) => {
    const u = d.data();
    const sedes = new Set(u.ciudadIds || (u.ciudadId ? [u.ciudadId] : []));
    profes.set(d.id, { correo: d.id, nombre: u.nombre || d.id, sedes, programas: new Set() });
  });
  clases.forEach((c) => {
    if (!c.docenteCorreo) return;
    const k = c.docenteCorreo.toLowerCase();
    if (!profes.has(k) && !profes.has(c.docenteCorreo)) profes.set(c.docenteCorreo, { correo: c.docenteCorreo, nombre: c.docenteNombre || c.docenteCorreo, sedes: new Set(), programas: new Set() });
    const p = profes.get(c.docenteCorreo) || profes.get(k);
    if (c.ciudadId) p.sedes.add(c.ciudadId);
    if (c.programaNombre) p.programas.add(c.programaNombre);
  });
  const lista = [...profes.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));

  const sedesDisponibles = (restringido ? misSedes : [...nombresSede.keys()]).filter((id) => nombresSede.has(id));
  const programasDisponibles = [...new Set(clases.map((c) => c.programaNombre).filter(Boolean))].sort();
  const estilo = "font-family:var(--fuente-cuerpo); font-size:13px; padding:8px 10px; border:1px solid var(--linea); border-radius:7px; background:var(--fondo); color:var(--tinta);";
  const etq = "display:block; font-size:11.5px; font-weight:500; color:var(--tinta-suave); margin-bottom:4px; text-transform:uppercase; letter-spacing:0.02em;";

  cont.innerHTML = `
    <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end; margin-bottom:10px;">
      ${sedesDisponibles.length > 1 ? `<div><label style="${etq}" for="sp-sede">Sede</label>
        <select id="sp-sede" style="${estilo}"><option value="">Todas las sedes</option>${sedesDisponibles.map((id) => `<option value="${esc(id)}">${esc(nombresSede.get(id))}</option>`).join("")}</select></div>` : ""}
      ${programasDisponibles.length > 0 ? `<div><label style="${etq}" for="sp-programa">Programa</label>
        <select id="sp-programa" style="${estilo}"><option value="">Todos los programas</option>${programasDisponibles.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join("")}</select></div>` : ""}
      <div><label style="${etq}" for="sp-buscar">Buscar profesor</label>
        <input type="text" id="sp-buscar" placeholder="Nombre o correo..." style="${estilo} min-width:210px;"></div>
    </div>
    <label style="${etq}" for="profesor-vista">Ver como profesor (solo para revisión)</label>
    <select id="profesor-vista" style="${estilo} max-width:460px; width:100%;"></select>
    <span id="sp-conteo" style="font-size:12px; color:var(--tinta-suave); margin-left:8px;"></span>
    ${errorUsuarios ? `<p style="color:var(--error); font-size:12.5px; margin:6px 0 0;">No se pudo leer la lista completa de profesores (${esc(errorUsuarios.code || errorUsuarios.message)}); se muestran los que tienen clases.</p>` : ""}`;

  const selSede = document.getElementById("sp-sede");
  const selPrograma = document.getElementById("sp-programa");
  const buscar = document.getElementById("sp-buscar");
  const selProf = document.getElementById("profesor-vista");
  const conteo = document.getElementById("sp-conteo");

  function filtrados() {
    const sede = selSede ? selSede.value : "";
    const programa = selPrograma ? selPrograma.value : "";
    const t = sinTildes(buscar.value);
    return lista.filter((p) =>
      (!sede || p.sedes.has(sede)) &&
      (!programa || p.programas.has(programa)) &&
      (!t || sinTildes(p.nombre).includes(t) || sinTildes(p.correo).includes(t)));
  }

  function pintar(mantener) {
    const f = filtrados();
    selProf.innerHTML = `<option value="">Selecciona un profesor...</option>` +
      f.map((p) => `<option value="${esc(p.correo)}">${esc(p.nombre)} — ${esc(p.correo)}</option>`).join("");
    conteo.textContent = `${f.length} profesor(es)`;
    if (mantener && f.some((p) => p.correo === mantener)) { selProf.value = mantener; return mantener; }
    return null;
  }

  let actual = null;
  const refrescar = () => {
    const previo = actual;
    actual = pintar(previo);
    if (actual !== previo) alCambiar(actual);
  };
  [selSede, selPrograma].forEach((s) => s && s.addEventListener("change", refrescar));
  buscar.addEventListener("input", refrescar);
  selProf.addEventListener("change", () => { actual = selProf.value || null; alCambiar(actual); });

  actual = pintar(correoDesdeUrl && profes.has(correoDesdeUrl) ? correoDesdeUrl : null);
  return { correoInicial: actual };
}
