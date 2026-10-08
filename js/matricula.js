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
import { registrarLog } from "./auth.js?v=3";
import {
  collection, doc, getDoc, getDocs, writeBatch, deleteField, query, where
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

export async function buscarEnDirectorio(cedula) {
  const limpia = String(cedula || "").trim();
  if (!limpia) return null;
  const snap = await getDoc(doc(db, "directorio_estudiantes", limpia));
  return snap.exists() ? snap.data() : null;
}

export async function agregarEstudianteAClase({ dir, clase, usuario, perfil }) {
  const prof = datosProfesor(usuario, perfil);
  const fecha = new Date().toISOString();
  const idEst = `${clase.id}_${dir.cedula}`;

  const refReporte = doc(collection(db, "reportes_estudiantes"));
  const batch = writeBatch(db);

  batch.set(doc(db, "estudiantes", idEst), {
    nombre: dir.nombre, apellido: dir.apellido, cedula: dir.cedula, correo: dir.correo || "",
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
    ciudadNombre: clase.ciudadNombre || "",
    anio: clase.anio, periodo: clase.periodo, ciclo: clase.ciclo,
    profesorCorreo: prof.correo,
    profesorNombre: prof.nombre,
    motivo: "",
    fecha
  });

  await batch.commit();
  await registrarLog(usuario, "profesor", "Añadió estudiante a su clase", `${dir.apellido} ${dir.nombre} (${dir.cedula}) — ${textoClase(clase)}`);
}

// ───────────────────────── Coordinación / Admin / Master ─────────────────────────

function misSedesDe(perfil) {
  return perfil?.ciudadIds || (perfil?.ciudadId ? [perfil.ciudadId] : []);
}

// Clases a las que se puede mover un estudiante: mismo período y mismo
// programa, distintas a la actual; coordinación solo ve las de sus sedes.
export async function cargarDestinos(est, rol, perfil) {
  const snapOrigen = await getDoc(doc(db, "clases", est.claseId));
  if (!snapOrigen.exists()) throw new Error("La clase de origen ya no existe.");
  const origen = snapOrigen.data();

  const q = query(
    collection(db, "clases"),
    where("anio", "==", origen.anio),
    where("periodo", "==", origen.periodo),
    where("ciclo", "==", origen.ciclo),
    where("programaId", "==", origen.programaId)
  );
  const snap = await getDocs(q);
  let destinos = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => c.id !== est.claseId);

  if (rol === "coordinador" || rol === "secretaria") {
    const sedes = misSedesDe(perfil);
    destinos = destinos.filter((c) => sedes.includes(c.ciudadId));
  }
  destinos.sort((a, b) =>
    (a.ciudadNombre || "").localeCompare(b.ciudadNombre || "") ||
    (a.nivel || "").localeCompare(b.nivel || "") ||
    (a.grupo || "").localeCompare(b.grupo || "")
  );
  return destinos;
}

export function etiquetaDestino(c) {
  return `${c.nivel} - ${c.grupo} · ${c.ciudadNombre || "—"} · ${c.docenteNombre || "sin profesor"}`;
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
  const refEst = doc(db, "estudiantes", reporte.estudianteDocId);
  const snapEst = await getDoc(refEst);
  if (snapEst.exists() && snapEst.data().estado !== "movido") {
    batch.update(refEst, { reporte: deleteField() });
  }
  await batch.commit();
  await registrarLog(usuario, rol, resolucion === "enterada" ? "Marcó como enterada la adición de un estudiante" : "Dejó al estudiante en su clase (reporte cerrado)", `${reporte.estudianteNombre} (${reporte.cedula}) — ${reporte.claseTexto}`);
}

// Mantiene al día el directorio mínimo que permite al profesor buscar por cédula.
export function datosDirectorio(e) {
  return {
    cedula: e.cedula, nombre: e.nombre, apellido: e.apellido,
    correo: e.correo || "", ciudadId: e.ciudadId || null, ciudadNombre: e.ciudadNombre || ""
  };
}

// ───────────────────────── Panel del profesor ─────────────────────────
// ctx: { grupo, getEstudiantes(), getMovidos(), usuario, perfil, alCambiar() }

export function montarPanelProfesor(contenedor, ctx) {
  const { grupo, usuario, perfil } = ctx;
  const estudiantes = ctx.getEstudiantes();
  const movidos = ctx.getMovidos();

  const opcionesSede = grupo.clases.map((c) => `<option value="${c.id}">${escapar(c.ciudadNombre || c.id)}</option>`).join("");

  const estabaAbierto = !!contenedor.querySelector("details")?.open;

  contenedor.innerHTML = `
    <details class="panel-estudiantes" ${estabaAbierto ? "open" : ""} style="margin-top:26px; max-width:900px; border:1px solid var(--linea); border-radius:10px; padding:12px 16px; background:var(--superficie);">
      <summary style="cursor:pointer; font-weight:600; font-size:14px;">👥 Gestionar estudiantes de esta clase (añadir o reportar)</summary>

      <div style="margin-top:14px;">
        <p style="font-weight:600; font-size:13.5px; margin:0 0 6px;">Añadir un estudiante que ya está en el sistema</p>
        <p style="font-size:12.5px; color:var(--tinta-suave); margin:0 0 8px;">Escribe su cédula. Al añadirlo, coordinación recibe el aviso automáticamente.</p>
        <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
          <input type="text" id="pe-cedula" inputmode="numeric" placeholder="Cédula" style="font-size:13px; padding:7px 9px; border:1px solid var(--linea); border-radius:6px; width:170px;">
          <button type="button" class="boton-secundario" id="pe-buscar">Buscar</button>
        </div>
        <div id="pe-resultado" style="margin-top:10px; font-size:13px;"></div>
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

  // — Añadir por cédula —
  const resultado = contenedor.querySelector("#pe-resultado");
  contenedor.querySelector("#pe-buscar").addEventListener("click", async () => {
    const cedula = contenedor.querySelector("#pe-cedula").value.trim();
    resultado.innerHTML = "";
    if (!cedula) return;

    if (estudiantes.some((e) => e.cedula === cedula)) {
      resultado.innerHTML = `<span style="color:var(--error);">Ese estudiante ya está en tu planilla.</span>`;
      return;
    }
    try {
      const dir = await buscarEnDirectorio(cedula);
      if (!dir) {
        resultado.innerHTML = `<span style="color:var(--error);">No encontré a nadie con la cédula ${escapar(cedula)}. Si es un estudiante nuevo, pídele a coordinación que lo cree.</span>`;
        return;
      }
      const porDefecto = grupo.clases.find((c) => c.ciudadId === dir.ciudadId) || grupo.clases[0];
      resultado.innerHTML = `
        <p style="margin:0 0 8px;"><b>${escapar(dir.apellido)} ${escapar(dir.nombre)}</b> · cédula ${escapar(dir.cedula)}${dir.ciudadNombre ? ` · sede ${escapar(dir.ciudadNombre)}` : ""}</p>
        ${grupo.clases.length > 1 ? `<label style="font-size:12.5px; color:var(--tinta-suave);">Añadir a la sede:
          <select id="pe-sede" style="font-size:13px; padding:5px 8px; border:1px solid var(--linea); border-radius:6px; margin-left:4px;">${opcionesSede}</select></label><br>` : ""}
        <button type="button" class="boton-primario" id="pe-añadir" style="max-width:340px; margin-top:8px;">Añadir a mi clase y avisar a coordinación</button>`;
      const sel = resultado.querySelector("#pe-sede");
      if (sel) sel.value = porDefecto.id;

      resultado.querySelector("#pe-añadir").addEventListener("click", async (ev) => {
        const claseElegida = grupo.clases.find((c) => c.id === (sel ? sel.value : porDefecto.id)) || porDefecto;
        const idEst = `${claseElegida.id}_${dir.cedula}`;
        if (movidos.some((m) => m.id === idEst)) {
          decir("Este estudiante fue movido de esta clase por coordinación. Pídeles a ellos que lo regresen.", true);
          return;
        }
        ev.target.disabled = true;
        try {
          await agregarEstudianteAClase({ dir, clase: claseElegida, usuario, perfil });
          await ctx.alCambiar();
        } catch (error) {
          ev.target.disabled = false;
          decir(error.code === "permission-denied"
            ? "No se pudo añadir: el período está cerrado o ese estudiante ya tiene matrícula en esta clase."
            : `No se pudo añadir (${error.code || error.message}).`, true);
        }
      });
    } catch (error) {
      resultado.innerHTML = `<span style="color:var(--error);">No se pudo buscar (${escapar(error.code || error.message)}).</span>`;
    }
  });
}
