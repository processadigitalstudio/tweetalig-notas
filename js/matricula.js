// matricula.js
// Lógica compartida para: (1) que el profesor reporte a un estudiante que "no es
// de su clase" o añada uno por cédula, y (2) que coordinación/Admin/Master
// resuelvan esos reportes o muevan estudiantes de clase.
//
// Reglas de oro (las hace cumplir firestore.rules, no este archivo):
// - El profesor NUNCA mueve ni borra a nadie: solo reporta o añade, y de una
//   vez le queda un aviso a coordinación en "reportes_estudiantes".
// - Mover = crear la matrícula nueva (en blanco) y dejar la vieja marcada como
//   "movido" (sus notas y asistencia se conservan en la clase anterior).
// - Coordinación solo puede mover dentro de sus sedes.

import { db } from "./firebase-config.js?v=3";
import { leerClases } from "./clases-lectura.js?v=1";
import { registrarLog } from "./auth.js?v=3";
import {
  collection, doc, getDoc, getDocs, writeBatch, deleteField, query, where, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

export function estaMovido(est) {
  return est.estado === "movido";
}

// Separa una lista de matrículas en activas y movidas (historial).
export function separarMovidos(lista) {
  return {
    activos: lista.filter((e) => !estaMovido(e)),
    movidos: lista.filter((e) => estaMovido(e))
  };
}

function escapar(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Etiqueta que se pega al lado del nombre en cualquier planilla.
export function badgeReporte(est) {
  if (!est.reporte) return "";
  if (est.reporte.tipo === "agregado_por_profesor") {
    return ` <span title="Añadido por el profesor; coordinación ya fue avisada" style="font-size:11px; padding:2px 7px; border-radius:10px; background:#e3f4ee; color:#2d6a58; border:1px solid #5db69c; white-space:nowrap;">Añadido · avisado</span>`;
  }
  return ` <span title="Reportado a coordinación: ${escapar(est.reporte.motivo || "sin motivo")}" style="font-size:11px; padding:2px 7px; border-radius:10px; background:#fbf0c9; color:#7a5d00; border:1px solid #e6c14f; white-space:nowrap;">Reportado</span>`;
}

function datosProfesor(usuario, perfil) {
  return {
    correo: usuario.email.toLowerCase(),
    nombre: perfil?.nombre || usuario.email
  };
}

function textoClase(c) {
  return `${c.nivel} - ${c.grupo} (${c.anio}-${c.periodo}, ciclo ${c.ciclo})`;
}

// ───────────────────────── Profesor: reportar ─────────────────────────

export async function reportarNoPertenece({ est, grupo, usuario, perfil, motivo }) {
  if (est.reporte) throw new Error("Este estudiante ya tiene un reporte pendiente.");
  const clase = grupo.clases.find((c) => c.id === est.claseId);
  if (!clase) throw new Error("No se encontró la clase de este estudiante.");
  const prof = datosProfesor(usuario, perfil);
  const fecha = new Date().toISOString();

  const refReporte = doc(collection(db, "reportes_estudiantes"));
  const batch = writeBatch(db);
  batch.set(refReporte, {
    tipo: "no_pertenece",
    estado: "pendiente",
    estudianteDocId: est.id,
    cedula: est.cedula,
    estudianteNombre: `${est.apellido} ${est.nombre}`,
    claseId: clase.id,
    claseTexto: textoClase(clase),
    programaId: clase.programaId || null,
    ciudadId: clase.ciudadId,
    ciudadOrigenId: clase.ciudadId,
    ciudadNombre: clase.ciudadNombre || "",
    anio: clase.anio, periodo: clase.periodo, ciclo: clase.ciclo,
    profesorCorreo: prof.correo,
    profesorNombre: prof.nombre,
    motivo: motivo || "",
    fecha
  });
  batch.update(doc(db, "estudiantes", est.id), {
    reporte: { id: refReporte.id, tipo: "no_pertenece", motivo: motivo || "", fecha, por: prof.nombre }
  });
  await batch.commit();
  await registrarLog(usuario, "profesor", "Reportó estudiante que no es de su clase", `${est.apellido} ${est.nombre} (${est.cedula}) — ${textoClase(clase)}`);
}

// ───────────────────────── Profesor: añadir por cédula ─────────────────────────

// Quita tildes y mayúsculas (conserva la ñ) para comparar y buscar nombres.
export function normalizar(texto) {
  return String(texto || "").toLowerCase().trim()
    .replace(/[áàäâ]/g, "a").replace(/[éèëê]/g, "e").replace(/[íìïî]/g, "i")
    .replace(/[óòöô]/g, "o").replace(/[úùüû]/g, "u").replace(/\s+/g, " ");
}

// Dónde está matriculado hoy el estudiante (se guarda en su ficha del directorio).
export function ultimaMatriculaDe(clase, docId) {
  return {
    docId,
    claseId: clase.id,
    claseTexto: textoClase(clase),
    nivel: clase.nivel || "", grupo: clase.grupo || "",
    anio: clase.anio, periodo: clase.periodo, ciclo: clase.ciclo,
    ciudadId: clase.ciudadId || null,
    ciudadNombre: clase.ciudadNombre || "",
    docenteNombre: clase.docenteNombre || ""
  };
}

// Ficha mínima del directorio. NO lleva correo (solo lo que el profesor necesita
// para encontrar al estudiante y saber dónde está).
export function datosDirectorio(e, clase = null, docId = null) {
  const um = clase ? ultimaMatriculaDe(clase, docId) : (e.ultimaMatricula || null);
  return {
    cedula: e.cedula, nombre: e.nombre, apellido: e.apellido,
    ciudadId: e.ciudadId || null, ciudadNombre: e.ciudadNombre || "",
    busqueda: normalizar(`${e.apellido} ${e.nombre}`),
    busquedaInv: normalizar(`${e.nombre} ${e.apellido}`),
    ultimaMatricula: um
  };
}

// Busca por cédula (exacta) o por nombre/apellido (empieza con..., mínimo 3 letras).
export async function buscarEstudiantes(texto) {
  const t = String(texto || "").trim();
  if (!t) return [];
  if (/^\d+$/.test(t)) {
    const snap = await getDoc(doc(db, "directorio_estudiantes", t));
    return snap.exists() ? [snap.data()] : [];
  }
  const n = normalizar(t);
  if (n.length < 3) throw new Error("Escribe al menos 3 letras del nombre o apellido.");
  const consulta = (campo) => getDocs(query(
    collection(db, "directorio_estudiantes"),
    where(campo, ">=", n), where(campo, "<=", n + "\uf8ff"),
    orderBy(campo), limit(10)
  ));
  const [a, b] = await Promise.all([consulta("busqueda"), consulta("busquedaInv")]);
  const porCedula = new Map();
  [...a.docs, ...b.docs].forEach((d) => porCedula.set(d.data().cedula, d.data()));
  return [...porCedula.values()].sort((x, y) => (x.apellido || "").localeCompare(y.apellido || "")).slice(0, 10);
}

export async function agregarEstudianteAClase({ dir, clase, usuario, perfil }) {
  const prof = datosProfesor(usuario, perfil);
  const fecha = new Date().toISOString();
  const idEst = `${clase.id}_${dir.cedula}`;

  const refReporte = doc(collection(db, "reportes_estudiantes"));
  const batch = writeBatch(db);

  batch.set(doc(db, "estudiantes", idEst), {
    nombre: dir.nombre, apellido: dir.apellido, cedula: dir.cedula, correo: "",
    claseId: clase.id,
    claseTexto: textoClase(clase),
    anio: clase.anio, periodo: clase.periodo, ciclo: clase.ciclo,
    ciudadId: clase.ciudadId, ciudadNombre: clase.ciudadNombre || "",
    agregadoPor: prof.correo,
    agregadoEn: fecha,
    reporte: { id: refReporte.id, tipo: "agregado_por_profesor", motivo: "", fecha, por: prof.nombre }
  });

  batch.set(refReporte, {
    tipo: "agregado_por_profesor",
    estado: "pendiente",
    estudianteDocId: idEst,
    cedula: dir.cedula,
    estudianteNombre: `${dir.apellido} ${dir.nombre}`,
    claseId: clase.id,
    claseTexto: textoClase(clase),
    programaId: clase.programaId || null,
    ciudadId: clase.ciudadId,
    ciudadOrigenId: clase.ciudadId,
    ciudadNombre: clase.ciudadNombre || "",
    anio: clase.anio, periodo: clase.periodo, ciclo: clase.ciclo,
    profesorCorreo: prof.correo,
    profesorNombre: prof.nombre,
    motivo: "",
    fecha
  });

  // Que el siguiente profesor que lo busque vea que ya está en esta clase.
  batch.update(doc(db, "directorio_estudiantes", dir.cedula), {
    ultimaMatricula: ultimaMatriculaDe(clase, idEst)
  });

  await batch.commit();
  await registrarLog(usuario, "profesor", "Añadió estudiante a su clase", `${dir.apellido} ${dir.nombre} (${dir.cedula}) — ${textoClase(clase)}`);
}

// El estudiante ya está en OTRA clase: el profesor no lo mueve, solo pide el
// traspaso. Coordinación (de la sede de origen o de destino) lo autoriza.
export async function solicitarTraspaso({ dir, clase, usuario, perfil, motivo }) {
  const um = dir.ultimaMatricula;
  if (!um) throw new Error("No se sabe en qué clase está este estudiante.");
  const prof = datosProfesor(usuario, perfil);
  const refReporte = doc(collection(db, "reportes_estudiantes"));
  await setDocLote(refReporte, {
    tipo: "solicitud_traspaso",
    estado: "pendiente",
    estudianteDocId: um.docId || `${um.claseId}_${dir.cedula}`,
    cedula: dir.cedula,
    estudianteNombre: `${dir.apellido} ${dir.nombre}`,
    // Clase de DESTINO (la del profesor que lo pide):
    claseId: clase.id,
    claseTexto: textoClase(clase),
    programaId: clase.programaId || null,
    ciudadId: clase.ciudadId,
    ciudadNombre: clase.ciudadNombre || "",
    anio: clase.anio, periodo: clase.periodo, ciclo: clase.ciclo,
    // Dónde está hoy (ORIGEN):
    ciudadOrigenId: um.ciudadId || clase.ciudadId,
    origenClaseId: um.claseId,
    origenClaseTexto: um.claseTexto || "",
    origenCiudadNombre: um.ciudadNombre || "",
    origenDocente: um.docenteNombre || "",
    profesorCorreo: prof.correo,
    profesorNombre: prof.nombre,
    motivo: motivo || "",
    fecha: new Date().toISOString()
  });
  await registrarLog(usuario, "profesor", "Solicitó traspaso de estudiante", `${dir.apellido} ${dir.nombre} (${dir.cedula}): ${um.claseTexto || um.claseId} → ${textoClase(clase)}`);
}

async function setDocLote(ref, datos) {
  const batch = writeBatch(db);
  batch.set(ref, datos);
  await batch.commit();
}

// Solicitudes que este profesor ya envió (para que vea si las autorizaron).
export async function misSolicitudes(usuario, idsClases) {
  const snap = await getDocs(query(
    collection(db, "reportes_estudiantes"),
    where("profesorCorreo", "==", usuario.email.toLowerCase()),
    where("tipo", "==", "solicitud_traspaso")
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => idsClases.includes(r.claseId))
    .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))
    .slice(0, 8);
}

// ───────────────────────── Coordinación / Admin / Master ─────────────────────────

function misSedesDe(perfil) {
  return perfil?.ciudadIds || (perfil?.ciudadId ? [perfil.ciudadId] : []);
}

// Carga los estudiantes de una o varias clases. Para coordinación/secretaria la
// consulta DEBE llevar la sede de la clase (así Firestore puede comprobar que solo
// lee estudiantes de sus sedes) y solo se piden las clases de sus sedes.
export async function cargarEstudiantesDeClases(clases, rol, perfil) {
  const esCoord = rol === "coordinador" || rol === "secretaria";
  const sedes = misSedesDe(perfil);
  const visibles = esCoord ? clases.filter((c) => sedes.includes(c.ciudadId)) : clases;
  const snaps = await Promise.all(visibles.map((c) => getDocs(esCoord
    ? query(collection(db, "estudiantes"), where("claseId", "==", c.id), where("ciudadId", "==", c.ciudadId))
    : query(collection(db, "estudiantes"), where("claseId", "==", c.id))
  )));
  const lista = [];
  snaps.forEach((sn) => sn.forEach((d) => lista.push({ id: d.id, ...d.data() })));
  return lista;
}

// Clases a las que se puede mover un estudiante: cualquier nivel o grupo del
// mismo año y período (también de otro ciclo o programa; la etiqueta lo dice),
// distintas a la actual. Coordinación solo ve las de sus sedes.
export async function cargarDestinos(est, rol, perfil) {
  const snapOrigen = await getDoc(doc(db, "clases", est.claseId));
  if (!snapOrigen.exists()) throw new Error("La clase de origen ya no existe.");
  const origen = snapOrigen.data();

  const snap = await leerClases(db, rol, perfil, [where("anio", "==", origen.anio), where("periodo", "==", origen.periodo)]);
  let destinos = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => c.id !== est.claseId);

  if (rol === "coordinador" || rol === "secretaria") {
    const sedes = misSedesDe(perfil);
    destinos = destinos.filter((c) => sedes.includes(c.ciudadId));
  }
  destinos.sort((a, b) =>
    (a.ciudadNombre || "").localeCompare(b.ciudadNombre || "") ||
    (a.nivel || "").localeCompare(b.nivel || "", "es", { numeric: true }) ||
    (a.grupo || "").localeCompare(b.grupo || "")
  );
  return destinos;
}

export function etiquetaDestino(c) {
  return `${c.nivel} - ${c.grupo} · ${c.ciudadNombre || "—"} · ciclo ${c.ciclo}${c.programaNombre ? ` · ${c.programaNombre}` : ""} · ${c.docenteNombre || "sin profesor"}`;
}

export async function moverEstudiante({ est, destino, usuario, rol, reporteId = null }) {
  const snapOrigen = await getDoc(doc(db, "estudiantes", est.id));
  if (!snapOrigen.exists()) throw new Error("La matrícula de origen ya no existe.");
  const o = snapOrigen.data();
  if (o.estado === "movido") throw new Error("Este estudiante ya fue movido antes.");

  // ¿Ya está activo en la clase destino?
  const dup = await getDocs(query(
    collection(db, "estudiantes"),
    where("claseId", "==", destino.id),
    where("cedula", "==", o.cedula),
    where("ciudadId", "==", destino.ciudadId)
  ));
  if (dup.docs.some((d) => d.data().estado !== "movido")) {
    throw new Error("Ese estudiante ya está matriculado en la clase destino.");
  }

  const fecha = new Date().toISOString();
  const nuevoId = `${destino.id}_${o.cedula}`;
  const destinoTexto = `${destino.nivel} - ${destino.grupo} (${destino.ciudadNombre || "—"})`;

  const batch = writeBatch(db);
  // Matrícula nueva, en blanco (las notas y asistencia NO se copian).
  batch.set(doc(db, "estudiantes", nuevoId), {
    nombre: o.nombre, apellido: o.apellido, cedula: o.cedula, correo: o.correo || "",
    claseId: destino.id,
    claseTexto: textoClase(destino),
    anio: destino.anio, periodo: destino.periodo, ciclo: destino.ciclo,
    ciudadId: destino.ciudadId, ciudadNombre: destino.ciudadNombre || "",
    movidoDesde: est.id,
    movidoPor: usuario.email.toLowerCase(),
    movidoEn: fecha
  });
  // La vieja se conserva como historial.
  batch.update(doc(db, "estudiantes", est.id), {
    estado: "movido",
    movidoA: nuevoId,
    movidoATexto: destinoTexto,
    movidoEn: fecha,
    movidoPor: usuario.email.toLowerCase(),
    reporte: deleteField()
  });
  // El directorio pasa a mostrar la clase nueva.
  batch.set(doc(db, "directorio_estudiantes", String(o.cedula)),
    { ...datosDirectorio({ ...o, ciudadId: destino.ciudadId, ciudadNombre: destino.ciudadNombre || "" }, destino, nuevoId), correo: deleteField() },
    { merge: true });
  if (reporteId) {
    batch.update(doc(db, "reportes_estudiantes", reporteId), {
      estado: "resuelto",
      resolucion: "movido",
      destinoTexto,
      resueltoPor: usuario.email.toLowerCase(),
      resueltoEn: fecha
    });
  }
  await batch.commit();
  await registrarLog(usuario, rol, "Movió estudiante de clase", `${o.apellido} ${o.nombre} (${o.cedula}): ${o.claseTexto || est.claseId} → ${destinoTexto}`);
  return nuevoId;
}

// Cierra un reporte sin mover a nadie ("dejar en su clase" / "enterada").
export async function resolverReporte({ reporte, resolucion, usuario, rol }) {
  const fecha = new Date().toISOString();
  const batch = writeBatch(db);
  batch.update(doc(db, "reportes_estudiantes", reporte.id), {
    estado: "resuelto",
    resolucion,
    resueltoPor: usuario.email.toLowerCase(),
    resueltoEn: fecha
  });
  // Quita la etiqueta de la planilla del profesor (si la matrícula sigue existiendo).
  // Las solicitudes de traspaso no dejan etiqueta en ninguna planilla.
  if (reporte.tipo !== "solicitud_traspaso") {
    const refEst = doc(db, "estudiantes", reporte.estudianteDocId);
    const snapEst = await getDoc(refEst);
    if (snapEst.exists() && snapEst.data().estado !== "movido") {
      batch.update(refEst, { reporte: deleteField() });
    }
  }
  await batch.commit();
  await registrarLog(usuario, rol, resolucion === "enterada" ? "Marcó como enterada la adición de un estudiante" : resolucion === "rechazada" ? "Rechazó una solicitud de traspaso" : "Dejó al estudiante en su clase (reporte cerrado)", `${reporte.estudianteNombre} (${reporte.cedula}) — ${reporte.claseTexto}`);
}

// ───────────────────────── Panel del profesor ─────────────────────────
// ctx: { grupo, getEstudiantes(), getMovidos(), usuario, perfil, alCambiar() }

export function montarPanelProfesor(contenedor, ctx) {
  const { grupo, usuario, perfil } = ctx;
  const estudiantes = ctx.getEstudiantes();
  const movidos = ctx.getMovidos();
  const idsGrupo = grupo.clases.map((c) => c.id);
  const ref = grupo.clases[0];

  const opcionesSede = grupo.clases.map((c) => `<option value="${c.id}">${escapar(c.ciudadNombre || c.id)}</option>`).join("");

  const estabaAbierto = !!contenedor.querySelector("details")?.open;

  contenedor.innerHTML = `
    <details class="panel-estudiantes" ${estabaAbierto ? "open" : ""} style="margin-top:26px; max-width:900px; border:1px solid var(--linea); border-radius:10px; padding:12px 16px; background:var(--superficie);">
      <summary style="cursor:pointer; font-weight:600; font-size:14px;">👥 Gestionar estudiantes de esta clase (buscar, añadir o reportar)</summary>

      <div style="margin-top:14px;">
        <p style="font-weight:600; font-size:13.5px; margin:0 0 6px;">Buscar un estudiante que ya está en el sistema</p>
        <p style="font-size:12.5px; color:var(--tinta-suave); margin:0 0 8px;">Escribe su cédula, o parte de su nombre o apellido. Si ya está en otra clase, puedes pedir el traspaso: lo autoriza coordinación.</p>
        <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
          <input type="text" id="pe-texto" placeholder="Cédula, nombre o apellido" style="font-size:13px; padding:7px 9px; border:1px solid var(--linea); border-radius:6px; width:260px;">
          <button type="button" class="boton-secundario" id="pe-buscar">Buscar</button>
        </div>
        <div id="pe-resultado" style="margin-top:10px; font-size:13px;"></div>
      </div>

      <div style="margin-top:20px;">
        <p style="font-weight:600; font-size:13.5px; margin:0 0 6px;">Solicitudes de traspaso que enviaste</p>
        <div id="pe-solicitudes" style="font-size:13px; color:var(--tinta-suave);">Cargando...</div>
      </div>

      <div style="margin-top:20px;">
        <p style="font-weight:600; font-size:13.5px; margin:0 0 6px;">¿Alguien aparece en tu planilla pero no es de tu clase?</p>
        <p style="font-size:12.5px; color:var(--tinta-suave); margin:0 0 8px;">Repórtalo: seguirá apareciendo en tu planilla, marcado como “Reportado”, hasta que coordinación decida.</p>
        <table style="width:100%; border-collapse:collapse; font-size:13px;">
          <tbody id="pe-lista"></tbody>
        </table>
      </div>
      <p id="pe-aviso" style="font-size:13px; min-height:18px; margin:10px 0 0;"></p>
    </details>
  `;

  const aviso = contenedor.querySelector("#pe-aviso");
  function decir(texto, error = false) {
    aviso.textContent = texto;
    aviso.style.color = error ? "var(--error)" : "#2E6E4E";
  }

  // — Lista para reportar —
  const lista = contenedor.querySelector("#pe-lista");
  estudiantes.forEach((est, idx) => {
    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td style="padding:6px 8px; border-bottom:1px solid var(--linea); width:32px;">${idx + 1}</td>
      <td style="padding:6px 8px; border-bottom:1px solid var(--linea);">${escapar(est.apellido)} ${escapar(est.nombre)}${badgeReporte(est)}</td>
      <td style="padding:6px 8px; border-bottom:1px solid var(--linea); text-align:right;">
        ${est.reporte ? "" : `<button type="button" class="boton-secundario pe-reportar" data-id="${est.id}">No es de mi clase</button>`}
      </td>`;
    lista.appendChild(fila);
  });
  lista.querySelectorAll(".pe-reportar").forEach((b) => b.addEventListener("click", async () => {
    const est = estudiantes.find((e) => e.id === b.dataset.id);
    if (!est) return;
    const motivo = prompt(`Reportar a ${est.apellido} ${est.nombre} como "no es de mi clase".\n\nEscribe el motivo (opcional, ayuda a coordinación):`);
    if (motivo === null) return;
    b.disabled = true;
    try {
      await reportarNoPertenece({ est, grupo, usuario, perfil, motivo: motivo.trim() });
      await ctx.alCambiar();
    } catch (error) {
      b.disabled = false;
      decir(`No se pudo reportar (${error.code || error.message}).`, true);
    }
  }));

  // — Solicitudes enviadas —
  const cajaSol = contenedor.querySelector("#pe-solicitudes");
  misSolicitudes(usuario, idsGrupo).then((sols) => {
    if (sols.length === 0) { cajaSol.textContent = "Todavía no has enviado solicitudes."; return; }
    cajaSol.innerHTML = sols.map((r) => {
      const estado = r.estado === "pendiente" ? "⏳ Pendiente"
        : r.resolucion === "movido" ? "✅ Autorizado" : "✖ Rechazado";
      return `<div style="padding:4px 0; border-bottom:1px solid var(--linea);">${escapar(r.estudianteNombre)} · desde ${escapar(r.origenClaseTexto)} — <b>${estado}</b></div>`;
    }).join("");
  }).catch(() => { cajaSol.textContent = "No se pudieron cargar tus solicitudes."; });

  // — Buscar / añadir / solicitar traspaso —
  const resultado = contenedor.querySelector("#pe-resultado");
  const inputTexto = contenedor.querySelector("#pe-texto");

  function mismoPeriodo(um) {
    return um && um.anio === ref.anio && um.periodo === ref.periodo && um.ciclo === ref.ciclo;
  }

  async function buscar() {
    resultado.innerHTML = "";
    const texto = inputTexto.value.trim();
    if (!texto) return;
    resultado.textContent = "Buscando...";
    let encontrados;
    try {
      encontrados = await buscarEstudiantes(texto);
    } catch (error) {
      resultado.innerHTML = `<span style="color:var(--error);">${escapar(error.code === "permission-denied" ? "No tienes permiso para buscar." : (error.message || error.code))}</span>`;
      return;
    }
    if (encontrados.length === 0) {
      resultado.innerHTML = `<span style="color:var(--error);">No encontré a nadie con “${escapar(texto)}”. Si es un estudiante nuevo, pídele a coordinación que lo cree.</span>`;
      return;
    }

    resultado.innerHTML = "";
    encontrados.forEach((dir) => {
      const um = dir.ultimaMatricula;
      const yaEsMio = estudiantes.some((e) => e.cedula === dir.cedula) || (um && idsGrupo.includes(um.claseId) && mismoPeriodo(um));
      const enOtraClase = um && mismoPeriodo(um) && !idsGrupo.includes(um.claseId);

      const fila = document.createElement("div");
      fila.style.cssText = "padding:10px 0; border-bottom:1px solid var(--linea);";

      let estadoHtml, accionHtml = "";
      if (yaEsMio) {
        estadoHtml = `<span style="color:#2d6a58;">Ya está en tu planilla.</span>`;
      } else if (enOtraClase) {
        estadoHtml = `Está en <b>${escapar(um.claseTexto)}</b>${um.ciudadNombre ? ` · sede ${escapar(um.ciudadNombre)}` : ""}${um.docenteNombre ? ` · profe ${escapar(um.docenteNombre)}` : ""}.`;
        accionHtml = `<button type="button" class="boton-primario pe-traspaso" style="max-width:280px; margin-top:6px;">Solicitar traspaso a mi clase</button>`;
      } else {
        estadoHtml = `<span style="color:var(--tinta-suave);">No tiene clase en este período.</span>${um ? ` <span style="font-size:12px;">(Última: ${escapar(um.claseTexto)})</span>` : ""}`;
        accionHtml = `<button type="button" class="boton-primario pe-anadir" style="max-width:340px; margin-top:6px;">Añadir a mi clase y avisar a coordinación</button>`;
      }
      const selSede = (accionHtml && grupo.clases.length > 1)
        ? `<br><label style="font-size:12.5px; color:var(--tinta-suave);">Sede de mi clase:
            <select class="pe-sede" style="font-size:13px; padding:4px 7px; border:1px solid var(--linea); border-radius:6px; margin-left:4px;">${opcionesSede}</select></label>`
        : "";

      fila.innerHTML = `<b>${escapar(dir.apellido)} ${escapar(dir.nombre)}</b> · cédula ${escapar(dir.cedula)}<br>${estadoHtml}${selSede}<br>${accionHtml}`;
      resultado.appendChild(fila);

      const sel = fila.querySelector(".pe-sede");
      if (sel) sel.value = (grupo.clases.find((c) => c.ciudadId === dir.ciudadId) || grupo.clases[0]).id;
      const claseElegida = () => grupo.clases.find((c) => c.id === (sel ? sel.value : grupo.clases[0].id)) || grupo.clases[0];

      fila.querySelector(".pe-anadir")?.addEventListener("click", async (ev) => {
        const clase = claseElegida();
        if (movidos.some((m) => m.id === `${clase.id}_${dir.cedula}`)) {
          decir("Este estudiante fue movido de esta clase por coordinación. Pídeles a ellos que lo regresen.", true);
          return;
        }
        ev.target.disabled = true;
        try {
          await agregarEstudianteAClase({ dir, clase, usuario, perfil });
          await ctx.alCambiar();
        } catch (error) {
          ev.target.disabled = false;
          decir(error.code === "permission-denied"
            ? "No se pudo añadir: el período está cerrado o ese estudiante ya tiene matrícula en esta clase."
            : `No se pudo añadir (${error.code || error.message}).`, true);
        }
      });

      fila.querySelector(".pe-traspaso")?.addEventListener("click", async (ev) => {
        const motivo = prompt(`Solicitar el traspaso de ${dir.apellido} ${dir.nombre} desde ${um.claseTexto} a tu clase.\n\nMotivo (opcional):`);
        if (motivo === null) return;
        ev.target.disabled = true;
        try {
          await solicitarTraspaso({ dir, clase: claseElegida(), usuario, perfil, motivo: motivo.trim() });
          decir("Solicitud enviada. Coordinación la revisará y verás aquí si la autorizan.");
          ev.target.textContent = "Solicitud enviada";
          await ctx.alCambiar();
        } catch (error) {
          ev.target.disabled = false;
          decir(`No se pudo enviar la solicitud (${error.code || error.message}).`, true);
        }
      });
    });
  }

  contenedor.querySelector("#pe-buscar").addEventListener("click", buscar);
  inputTexto.addEventListener("keydown", (e) => { if (e.key === "Enter") buscar(); });
}
