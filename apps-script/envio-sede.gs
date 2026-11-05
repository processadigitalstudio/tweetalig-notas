// ENVÍO DE CORREOS DEL PORTAL DE NOTAS — se instala UNA vez en la cuenta de Google de cada sede.
// El correo sale desde la cuenta donde se instala este script.
//
// 1) Cambia CLAVE por una clave larga inventada por ti (mínimo 12 caracteres). La misma se escribe en el portal.
// 2) Ejecuta la función "autorizar" una vez y acepta los permisos (enviar correo).
// 3) Implementar > Nueva implementación > Tipo: Aplicación web
//      Ejecutar como: Yo      Quién tiene acceso: Cualquier persona
//    y copia la URL que termina en /exec: es la que se pega en el portal.
// Si cambias algo del código, haz Implementar > Administrar implementaciones > Editar > Nueva versión.

const CLAVE = "CAMBIA_ESTA_CLAVE_POR_UNA_LARGA";
const MAX_POR_LLAMADA = 40;

function doPost(e) {
  try {
    const datos = JSON.parse(e.postData.contents);
    if (CLAVE.length < 12 || CLAVE.indexOf("CAMBIA_ESTA") === 0) return responder({ ok: false, error: "El script todavía tiene la clave de ejemplo." });
    if (datos.secreto !== CLAVE) return responder({ ok: false, error: "Clave incorrecta." });
    const cuenta = Session.getEffectiveUser().getEmail();

    if (datos.accion === "ping") {
      return responder({ ok: true, cuenta: cuenta, cuota: MailApp.getRemainingDailyQuota() });
    }

    if (datos.accion === "enviar") {
      const lista = datos.correos || [];
      if (lista.length > MAX_POR_LLAMADA) return responder({ ok: false, error: "Demasiados correos en una sola llamada." });
      const nombre = String(datos.nombre || "Tweetalig Centro de Idiomas").slice(0, 80);
      const resultados = lista.map(function (c) {
        const id = String(c.id);
        try {
          const para = String(c.para || "").trim();
          if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(para)) return { id: id, ok: false, error: "Correo de destino no válido." };
          if (MailApp.getRemainingDailyQuota() < 1) return { id: id, ok: false, error: "Se agotó el cupo diario de envíos de esta cuenta." };
          const texto = String(c.texto || "");
          MailApp.sendEmail({
            to: para,
            subject: String(c.asunto || "").replace(/[\r\n]+/g, " ").slice(0, 200),
            body: texto.replace(/\*\*([^*\n]+?)\*\*/g, "$1"),   // versión en texto, por si el programa de correo no muestra HTML
            htmlBody: textoAHtml(texto),     // versión que se ve: las líneas ocupan todo el ancho, sin cortes a la mitad
            name: nombre
          });
          return { id: id, ok: true };
        } catch (err) {
          return { id: id, ok: false, error: String(err).slice(0, 200) };
        }
      });
      return responder({ ok: true, cuenta: cuenta, resultados: resultados });
    }

    return responder({ ok: false, error: "Acción desconocida." });
  } catch (err) {
    return responder({ ok: false, error: String(err).slice(0, 200) });
  }
}

// Convierte el texto del mensaje en HTML: cada párrafo (separado por una línea en blanco) fluye
// completo, sin límite de ancho, y los saltos de línea sueltos se conservan.
// Negrita: lo que se escriba entre dos asteriscos dobles, **así**, sale en negrita.
function textoAHtml(texto) {
  const esc = function (t) { return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); };
  const negrita = function (t) { return t.replace(/\*\*([^*\n]+?)\*\*/g, "<b>$1</b>"); };
  const parrafos = String(texto).replace(/\r\n/g, "\n").split(/\n{2,}/).map(function (p) {
    return '<p style="margin:0 0 14px 0;">' + negrita(esc(p)).replace(/\n/g, "<br>") + "</p>";
  }).join("");
  return '<div style="font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:1.5; color:#222;">' + parrafos + "</div>";
}

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Ejecutar UNA vez a mano para dar el permiso de enviar correo.
function autorizar() {
  Logger.log("Cuenta: " + Session.getEffectiveUser().getEmail() + " — envíos disponibles hoy: " + MailApp.getRemainingDailyQuota());
}
