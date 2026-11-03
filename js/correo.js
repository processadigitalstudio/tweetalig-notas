// Envío de correo desde la cuenta de Google con la que la persona inició sesión (Gmail API).
// El permiso "enviar correo" lo da la propia persona en una ventana de Google; dura ~1 hora.
import { reauthenticateWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const b64 = (texto) => {
  const bytes = new TextEncoder().encode(texto);
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
};

export function correoValido(c) {
  return /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(String(c || "").trim());
}

// Devuelve { token, expira }. Debe llamarse directamente desde un clic (abre una ventana de Google).
export async function conectarGmail(auth, email, dominio) {
  const prov = new GoogleAuthProvider();
  prov.addScope("https://www.googleapis.com/auth/gmail.send");
  prov.setCustomParameters({ hd: dominio, login_hint: email });
  let res;
  try { res = await reauthenticateWithPopup(auth.currentUser, prov); }
  catch (e) {
    if (e.code === "auth/user-mismatch") throw new Error(`Elegiste otra cuenta de Google. Elige ${email}, la misma con la que entraste al portal.`);
    throw e;
  }
  const cred = GoogleAuthProvider.credentialFromResult(res);
  if (!cred?.accessToken) throw new Error("Google no entregó el permiso para enviar correo.");
  return { token: cred.accessToken, expira: Date.now() + 55 * 60 * 1000 };
}

// Arma el mensaje (texto plano UTF-8) tal como lo pide Gmail: base64 URL-safe.
export function armarMensajeRaw({ de, nombreDe, para, asunto, texto }) {
  const destino = String(para).replace(/[\r\n]/g, "").trim();
  const tema = String(asunto).replace(/[\r\n]/g, " ").trim();
  const cuerpo = b64(String(texto).replace(/\r?\n/g, "\r\n")).replace(/(.{76})/g, "$1\r\n");
  // Remitente explícito: sin esto Gmail usa la dirección principal de la cuenta, que puede ser
  // de otro dominio (p. ej. si las cuentas de Tweetalig viven dentro de otro espacio de Google).
  const remitente = de && correoValido(de)
    ? `${nombreDe ? `=?UTF-8?B?${b64(String(nombreDe).replace(/[\r\n"<>]/g, " "))}?= ` : ""}<${String(de).replace(/[\r\n]/g, "").trim()}>`
    : "";
  const mime = [
    ...(remitente ? [`From: ${remitente}`] : []),
    `To: ${destino}`,
    `Subject: =?UTF-8?B?${b64(tema)}?=`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    cuerpo
  ].join("\r\n");
  return b64(mime).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function enviarCorreo({ token, de, nombreDe, para, asunto, texto }) {
  if (!correoValido(para)) throw new Error("Correo de destino no válido.");
  const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: armarMensajeRaw({ de, nombreDe, para, asunto, texto }) })
  });
  if (!r.ok) throw new Error(`Gmail respondió ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return (await r.json()).id;
}
