// FOTOS DE ESTUDIANTES — se instala UNA vez en la cuenta examenes.cartagena (la que guarda las fotos).
// El formulario de los estudiantes vive en el portal (tweetalig-notas.web.app/subir-foto.html?c=...)
// y le habla a este script por POST. (El archivo HTML "subir-foto" ya no es necesario; puede quedarse o borrarse.)
//
// 1) Cambia CLAVE por una clave larga inventada por ti (mínimo 12 caracteres). La misma se escribe en el portal.
// 2) Ejecuta la función "autorizar" una vez y acepta los permisos (Drive y Hojas de cálculo).
//    Eso crea en Drive la carpeta FOTOS ESTUDIANTES y adentro la hoja "REGISTRO FOTOS (NO BORRAR)".
// 3) Implementar > Nueva implementación > Tipo: Aplicación web
//      Ejecutar como: Yo      Quién tiene acceso: Cualquier persona
//    y copia la URL que termina en /exec: es la que se pega en el portal (Fotos de estudiantes).
// Si cambias algo del código, haz Implementar > Administrar implementaciones > Editar > Nueva versión
// (así la URL y los links de los cursos siguen siendo los mismos).
//
// Estructura en Drive:  FOTOS ESTUDIANTES / PROFESOR / CURSO / APELLIDOS NOMBRES - CEDULA.jpg
// Una foto por estudiante: si vuelve a subir, la nueva reemplaza a la anterior (la vieja va a la papelera).
// Clave del estudiante: su número de documento. Si no coincide con el nombre elegido, la foto NO se guarda.

const CLAVE = "CAMBIA_ESTA_CLAVE_POR_UNA_LARGA";
const NOMBRE_CARPETA_RAIZ = "FOTOS ESTUDIANTES";
const NOMBRE_REGISTRO = "REGISTRO FOTOS (NO BORRAR)";
const COMPARTIR_CON_PROFESOR = false;      // true = cada profesor recibe acceso de lector a la carpeta de SU curso
const MAX_BYTES_FOTO = 4 * 1024 * 1024;    // la página ya la reduce a ~300-500 KB; esto es solo un tope de seguridad
const MAX_CURSOS_POR_LLAMADA = 40;

const COLS_CURSOS = ["TOKEN", "CLASE_ID", "PROFESOR", "CORREO_PROFESOR", "CURSO", "SEDE", "ACTIVO", "ESTUDIANTES_JSON", "ACTUALIZADO"];
const COLS_SUBIDAS = ["FECHA", "TOKEN", "CURSO", "PROFESOR", "CEDULA", "ESTUDIANTE", "ARCHIVO_ID"];

// ───────────────────────── Página pública (estudiantes) ─────────────────────────

// Lo que necesita el formulario del estudiante. Al navegador NO se le mandan las cédulas: solo una llave por estudiante.
function datosPublicos(token) {
  const curso = token ? buscarCursoPorToken(token) : null;
  if (!curso) return { estado: "no_existe" };
  if (!curso.activo) return { estado: "cerrado", curso: curso.curso, profesor: curso.profesor };
  const subidos = cedulasConFoto(token);
  return {
    estado: "activo", curso: curso.curso, profesor: curso.profesor, sede: curso.sede,
    estudiantes: curso.estudiantes.map(function (s) { return { k: s.k, nombre: s.nombre, subio: subidos[s.cedula] === true }; })
  };
}

function doGet() {
  return ContentService.createTextOutput("Script de fotos de Tweetalig activo. El formulario está en el portal.");
}

// Documento sin puntos, espacios ni guiones, en mayúsculas (sirve para cédula, TI, PPT, pasaporte).
function normalizarDocumento(t) {
  return String(t || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
}

// La llama el formulario del portal (acción "subirFoto"). base64 = foto JPEG ya reducida en el celular.
function subirFoto(token, k, base64, documento) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const curso = buscarCursoPorToken(String(token || ""));
    if (!curso) throw new Error("Este link no existe.");
    if (!curso.activo) throw new Error("Este link ya está cerrado. Pídele uno nuevo a tu profesor.");
    const est = curso.estudiantes.filter(function (s) { return s.k === k; })[0];
    if (!est) throw new Error("Selecciona tu nombre de la lista.");
    if (!normalizarDocumento(documento)) throw new Error("Escribe tu número de documento.");
    if (normalizarDocumento(documento) !== normalizarDocumento(est.cedula)) {
      throw new Error("El número de documento no coincide con el nombre que elegiste. Revisa tu nombre y tu documento.");
    }

    const bytes = Utilities.base64Decode(String(base64 || ""));
    if (bytes.length < 1000) throw new Error("La foto llegó vacía. Intenta de nuevo.");
    if (bytes.length > MAX_BYTES_FOTO) throw new Error("La foto es demasiado pesada.");
    if (!((bytes[0] & 0xff) === 0xff && (bytes[1] & 0xff) === 0xd8)) throw new Error("El archivo no es una foto válida.");

    const carpetaProfe = carpetaHija(carpetaRaiz(), limpiarNombre(curso.profesor || "SIN PROFESOR"));
    const carpetaCurso = carpetaHija(carpetaProfe, limpiarNombre(curso.curso));
    const nombreArchivo = limpiarNombre(est.nombre + " - " + est.cedula) + ".jpg";

    // Una sola foto por estudiante: la anterior va a la papelera.
    const viejos = carpetaCurso.getFilesByName(nombreArchivo);
    while (viejos.hasNext()) viejos.next().setTrashed(true);

    const archivo = carpetaCurso.createFile(Utilities.newBlob(bytes, "image/jpeg", nombreArchivo));

    if (COMPARTIR_CON_PROFESOR && curso.correoProfesor) {
      try { carpetaCurso.addViewer(curso.correoProfesor); } catch (err) { /* si falla compartir, la foto igual queda guardada */ }
    }

    hoja("SUBIDAS", COLS_SUBIDAS).appendRow([new Date(), token, curso.curso, curso.profesor, "'" + est.cedula, est.nombre, archivo.getId()]);
    return { ok: true, nombre: est.nombre };
  } finally {
    lock.releaseLock();
  }
}

// ───────────────────────── Llamadas del portal (solo master) ─────────────────────────

function doPost(e) {
  try {
    const datos = JSON.parse(e.postData.contents);

    // ── Acciones públicas del formulario del estudiante: solo necesitan el token del curso ──
    if (datos.accion === "cursoPublico") {
      return responder({ ok: true, datos: datosPublicos(String(datos.token || "").trim()) });
    }
    if (datos.accion === "subirFoto") {
      try {
        const r = subirFoto(String(datos.token || "").trim(), String(datos.k || ""), String(datos.foto || ""), String(datos.documento || ""));
        return responder({ ok: true, nombre: r.nombre });
      } catch (err) {
        return responder({ ok: false, error: String(err && err.message ? err.message : err).slice(0, 200) });
      }
    }

    // ── Acciones del portal (master): necesitan la clave ──
    if (CLAVE.length < 12 || CLAVE.indexOf("CAMBIA_ESTA") === 0) return responder({ ok: false, error: "El script todavía tiene la clave de ejemplo." });
    if (datos.secreto !== CLAVE) return responder({ ok: false, error: "Clave incorrecta." });

    if (datos.accion === "ping") {
      return responder({ ok: true, cuenta: Session.getEffectiveUser().getEmail(), carpeta: carpetaRaiz().getUrl() });
    }

    if (datos.accion === "estado") {
      return responder({ ok: true, cursos: listarCursos() });
    }

    if (datos.accion === "activar") {
      const lista = datos.cursos || [];
      if (lista.length > MAX_CURSOS_POR_LLAMADA) return responder({ ok: false, error: "Demasiados cursos en una sola llamada." });
      const lock = LockService.getScriptLock();
      lock.waitLock(30000);
      try {
        const resultado = lista.map(activarCurso);
        return responder({ ok: true, cursos: resultado });
      } finally {
        lock.releaseLock();
      }
    }

    if (datos.accion === "cambiarEstado") {
      const lock = LockService.getScriptLock();
      lock.waitLock(30000);
      try {
        const sh = hoja("CURSOS", COLS_CURSOS);
        const fila = filaDeClase(sh, String(datos.claseId || ""));
        if (!fila) return responder({ ok: false, error: "Ese curso todavía no tiene link." });
        sh.getRange(fila, COLS_CURSOS.indexOf("ACTIVO") + 1).setValue(datos.activo === true ? "SI" : "NO");
        sh.getRange(fila, COLS_CURSOS.indexOf("ACTUALIZADO") + 1).setValue(new Date());
        return responder({ ok: true });
      } finally {
        lock.releaseLock();
      }
    }

    return responder({ ok: false, error: "Acción desconocida." });
  } catch (err) {
    return responder({ ok: false, error: String(err).slice(0, 200) });
  }
}

// Crea el link del curso, o si ya existe, actualiza profesor/lista y lo deja abierto (el link NO cambia).
function activarCurso(c) {
  const claseId = String(c.claseId || "").trim();
  if (!claseId) return { claseId: claseId, ok: false, error: "Falta el id de la clase." };
  const sh = hoja("CURSOS", COLS_CURSOS);
  const fila = filaDeClase(sh, claseId);

  // Conserva la llave de cada estudiante que ya estaba, para no romper una página abierta.
  const previas = {};
  if (fila) {
    const viejoJson = sh.getRange(fila, COLS_CURSOS.indexOf("ESTUDIANTES_JSON") + 1).getValue();
    try { JSON.parse(viejoJson || "[]").forEach(function (s) { previas[s.cedula] = s.k; }); } catch (err) { /* lista dañada: se regenera */ }
  }
  const estudiantes = (c.estudiantes || [])
    .filter(function (s) { return s && s.cedula && s.nombre; })
    .map(function (s) {
      const cedula = String(s.cedula).trim();
      return { cedula: cedula, nombre: String(s.nombre).trim().toUpperCase(), k: previas[cedula] || Utilities.getUuid().slice(0, 8) };
    })
    .sort(function (a, b) { return a.nombre.localeCompare(b.nombre); });

  const token = fila ? String(sh.getRange(fila, 1).getValue()) : Utilities.getUuid().replace(/-/g, "");
  const valores = [token, claseId,
    String(c.profesor || "SIN PROFESOR").toUpperCase(), String(c.correoProfesor || "").toLowerCase(),
    String(c.curso || claseId).toUpperCase(), String(c.sede || "").toUpperCase(),
    "SI", JSON.stringify(estudiantes), new Date()];
  if (fila) sh.getRange(fila, 1, 1, valores.length).setValues([valores]);
  else sh.appendRow(valores);
  return { claseId: claseId, ok: true, token: token, url: urlCurso(token), total: estudiantes.length };
}

function listarCursos() {
  const sh = hoja("CURSOS", COLS_CURSOS);
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  const conteo = {};
  const shS = hoja("SUBIDAS", COLS_SUBIDAS);
  if (shS.getLastRow() > 1) {
    const vistos = {};
    shS.getRange(2, 1, shS.getLastRow() - 1, COLS_SUBIDAS.length).getValues().forEach(function (r) {
      const clave = r[1] + "|" + r[4];
      if (vistos[clave]) return;
      vistos[clave] = true;
      conteo[r[1]] = (conteo[r[1]] || 0) + 1;
    });
  }
  return sh.getRange(2, 1, n, COLS_CURSOS.length).getValues().map(function (r) {
    let total = 0;
    try { total = JSON.parse(r[7] || "[]").length; } catch (err) { /* nada */ }
    return { claseId: String(r[1]), token: String(r[0]), url: urlCurso(String(r[0])), activo: r[6] === "SI", total: total, subidas: conteo[r[0]] || 0 };
  });
}

// ───────────────────────── Ayudantes ─────────────────────────

function buscarCursoPorToken(token) {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  const sh = hoja("CURSOS", COLS_CURSOS);
  const n = sh.getLastRow() - 1;
  if (n < 1) return null;
  const filas = sh.getRange(2, 1, n, COLS_CURSOS.length).getValues();
  for (let i = 0; i < filas.length; i++) {
    const r = filas[i];
    if (String(r[0]) !== token) continue;
    let estudiantes = [];
    try { estudiantes = JSON.parse(r[7] || "[]"); } catch (err) { /* nada */ }
    return { token: token, claseId: String(r[1]), profesor: String(r[2]), correoProfesor: String(r[3]), curso: String(r[4]), sede: String(r[5]), activo: r[6] === "SI", estudiantes: estudiantes };
  }
  return null;
}

function cedulasConFoto(token) {
  const sh = hoja("SUBIDAS", COLS_SUBIDAS);
  const res = {};
  if (sh.getLastRow() < 2) return res;
  sh.getRange(2, 1, sh.getLastRow() - 1, COLS_SUBIDAS.length).getValues().forEach(function (r) {
    if (String(r[1]) === token) res[String(r[4]).replace(/^'/, "")] = true;
  });
  return res;
}

function filaDeClase(sh, claseId) {
  const n = sh.getLastRow() - 1;
  if (n < 1) return null;
  const ids = sh.getRange(2, 2, n, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === claseId) return i + 2;
  return null;
}

function urlCurso(token) {
  return ScriptApp.getService().getUrl() + "?c=" + token;
}

function carpetaRaiz() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("CARPETA_RAIZ_ID");
  if (id) {
    try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (err) { /* se crea de nuevo */ }
  }
  const f = DriveApp.createFolder(NOMBRE_CARPETA_RAIZ);
  props.setProperty("CARPETA_RAIZ_ID", f.getId());
  return f;
}

function carpetaHija(padre, nombre) {
  const it = padre.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : padre.createFolder(nombre);
}

function registro() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("REGISTRO_ID");
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (err) { /* se crea de nuevo */ }
  }
  const ss = SpreadsheetApp.create(NOMBRE_REGISTRO);
  DriveApp.getFileById(ss.getId()).moveTo(carpetaRaiz());
  props.setProperty("REGISTRO_ID", ss.getId());
  return ss;
}

function hoja(nombre, columnas) {
  const ss = registro();
  let sh = ss.getSheetByName(nombre);
  if (!sh) {
    sh = ss.insertSheet(nombre);
    sh.getRange(1, 1, 1, columnas.length).setValues([columnas]).setFontWeight("bold");
    sh.setFrozenRows(1);
    const sobrante = ss.getSheetByName("Hoja 1") || ss.getSheetByName("Sheet1");
    if (sobrante && ss.getSheets().length > 1) ss.deleteSheet(sobrante);
  }
  return sh;
}

function limpiarNombre(t) {
  return String(t || "").replace(/[\/\\:*?"<>|#%]+/g, " ").replace(/\s+/g, " ").trim().toUpperCase().slice(0, 120);
}

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Ejecutar UNA vez a mano: da los permisos y crea la carpeta y la hoja de registro.
function autorizar() {
  hoja("CURSOS", COLS_CURSOS);
  hoja("SUBIDAS", COLS_SUBIDAS);
  Logger.log("Cuenta: " + Session.getEffectiveUser().getEmail() + " — carpeta: " + carpetaRaiz().getUrl());
}
