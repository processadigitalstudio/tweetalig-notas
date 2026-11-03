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
          MailApp.sendEmail({
            to: para,
            subject: String(c.asunto || "").replace(/[\r\n]+/g, " ").slice(0, 200),
            body: String(c.texto || ""),
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

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Ejecutar UNA vez a mano para dar el permiso de enviar correo.
function autorizar() {
  Logger.log("Cuenta: " + Session.getEffectiveUser().getEmail() + " — envíos disponibles hoy: " + MailApp.getRemainingDailyQuota());
}
