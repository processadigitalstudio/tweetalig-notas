// mayusculas.js
// Todo lo que se escribe en el portal queda en MAYÚSCULAS, excepto correos,
// enlaces, claves, buscadores, el texto de los mensajes (plantillas) y los números.
// Se aplica mientras se escribe (y al pegar), conservando la posición del cursor.

export function esCampoExcluido(el) {
  if (!el || el.disabled || el.readOnly) return true;
  const tag = el.tagName;
  if (tag === "INPUT") {
    if ((el.type || "text") !== "text") return true;
  } else if (tag !== "TEXTAREA") return true;
  if (el.hasAttribute("data-no-mayus")) return true;
  const modo = el.getAttribute("inputmode");
  if (modo === "numeric" || modo === "decimal" || modo === "tel") return true;
  if (el.closest(".combo-buscable, .filtros")) return true;
  const id = (el.id || "").toLowerCase();
  const cls = (el.className || "").toString().toLowerCase();
  const nombre = (el.name || "").toLowerCase();
  const clave = `${id} ${cls} ${nombre}`;
  if (/(correo|email|mail|url|clave|password|secreto|asunto|plantilla|filtro|buscar|busqueda|^f-texto| f-texto)/.test(clave)) return true;
  return false;
}

export function activarMayusculas() {
  document.addEventListener("input", (ev) => {
    const el = ev.target;
    if (ev.isComposing || esCampoExcluido(el)) return;
    const v = el.value;
    const m = v.toUpperCase();
    if (v === m) return;
    let ini = null, fin = null;
    try { ini = el.selectionStart; fin = el.selectionEnd; } catch (e) { /* tipo sin selección */ }
    el.value = m;
    try { if (ini !== null) el.setSelectionRange(ini, fin); } catch (e) { /* nada */ }
  }, true);
}

// Para guardar: mayúsculas en nombres, apellidos, etc.; el correo siempre en minúsculas.
export const may = (t) => String(t ?? "").trim().toUpperCase();
export const minus = (t) => String(t ?? "").trim().toLowerCase();
