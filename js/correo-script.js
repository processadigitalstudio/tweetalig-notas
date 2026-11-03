// Envío de correo por el Apps Script de cada sede. El script vive en la cuenta de Google de la sede
// y es el que envía (el correo sale de esa cuenta). El portal solo le entrega los correos ya revisados.
export function correoValido(c) {
  return /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(String(c || "").trim());
}

export function urlScriptValida(u) {
  return /^https:\/\/script\.google\.com\/(a\/macros\/[^/]+\/|macros\/)s\/[A-Za-z0-9_-]+\/exec$/.test(String(u || "").trim());
}

async function llamar(cfg, cuerpo) {
  let r;
  try {
    // text/plain evita la consulta previa (CORS) que Apps Script no responde.
    r = await fetch(cfg.url, {
      method: "POST", redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...cuerpo, secreto: cfg.secreto })
    });
  } catch (e) {
    const err = new Error("No se pudo contactar el script de envío. Revisa la dirección y que la implementación permita acceso a «Cualquier persona».");
    err.sinConfirmacion = true; throw err;
  }
  let datos;
  try { datos = await r.json(); }
  catch (e) {
    const err = new Error("El script respondió algo inesperado. Revisa que la dirección sea la de la implementación web (termina en /exec).");
    err.sinConfirmacion = true; throw err;
  }
  if (!datos.ok) throw new Error(datos.error || "El script rechazó la solicitud.");
  return datos;
}

// -> { ok, cuenta, cuota }
export const probarScript = (cfg) => llamar(cfg, { accion: "ping" });

// correos: [{ id, para, asunto, texto }] -> { ok, cuenta, resultados: [{ id, ok, error }] }
export const enviarPorScript = (cfg, correos, nombre) => llamar(cfg, { accion: "enviar", nombre, correos });
