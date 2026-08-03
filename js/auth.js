// auth.js
// Lógica compartida de sesión y roles. Cada página protegida (dashboard,
// estudiantes, notas, etc.) importa requireAuth() al cargar.
//
// IMPORTANTE: los perfiles se guardan en Firestore usando el CORREO como ID
// del documento (no el uid). Esto es porque con login de Google Workspace,
// la cuenta de Firebase se crea sola en el primer inicio de sesión — no
// existe un uid antes de eso. Así, tú puedes "pre-registrar" a alguien con
// su correo y rol, y en cuanto esa persona entre por primera vez con Google,
// el sistema ya sabe quién es.

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

function esperarUsuario() {
  return new Promise((resolve) => {
    const cancelar = onAuthStateChanged(auth, (usuario) => {
      cancelar();
      resolve(usuario);
    });
  });
}

function idPerfil(correo) {
  return correo.trim().toLowerCase();
}

// Llamar al inicio de cualquier página protegida.
// rolesPermitidos: array opcional, ej. ["master"] para páginas solo-MASTER.
async function requireAuth(rolesPermitidos = null) {
  const usuario = await esperarUsuario();

  if (!usuario) {
    window.location.href = rutaLogin();
    return null;
  }

  const refPerfil = doc(db, "usuarios", idPerfil(usuario.email));
  const snap = await getDoc(refPerfil);

  if (!snap.exists()) {
    alert("Tu cuenta no está registrada en el sistema todavía. Contacta a la administración.");
    await signOut(auth);
    window.location.href = rutaLogin();
    return null;
  }

  const perfil = snap.data();
  const rol = perfil.rol;

  if (rolesPermitidos && !rolesPermitidos.includes(rol)) {
    alert("No tienes permiso para ver esta página.");
    window.location.href = "dashboard.html";
    return null;
  }

  return { usuario, rol, perfil };
}

function rutaLogin() {
  const enSubcarpeta = window.location.pathname.includes("/pages/");
  return enSubcarpeta ? "../index.html" : "index.html";
}

async function cerrarSesion() {
  await signOut(auth);
  window.location.href = rutaLogin();
}

export { requireAuth, cerrarSesion, idPerfil };
