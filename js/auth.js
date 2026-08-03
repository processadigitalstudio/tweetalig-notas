// auth.js
// Lógica compartida de sesión y roles. Cada página protegida (dashboard,
// estudiantes, notas, etc.) importa requireAuth() al cargar.

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// IMPORTANTE: esto arregla el segundo problema del examen B1.1.
// onAuthStateChanged es asíncrono — Firebase tarda un instante en confirmar
// si hay una sesión guardada. Si revisas "auth.currentUser" de inmediato,
// todavía es null aunque el usuario SÍ esté logueado, y por eso te mandaba
// al login de vuelta al refrescar. Por eso esta función devuelve una
// Promise: la página espera a que Firebase termine de confirmar antes de
// decidir si redirige o no.
function esperarUsuario() {
  return new Promise((resolve) => {
    const cancelar = onAuthStateChanged(auth, (usuario) => {
      cancelar();
      resolve(usuario);
    });
  });
}

// Roles válidos y a qué página redirige cada uno
const PANEL_POR_ROL = {
  master: "pages/dashboard.html",
  coordinador: "pages/dashboard.html",
  secretaria: "pages/dashboard.html",
  profesor: "pages/dashboard.html"
};

// Llamar al inicio de cualquier página protegida.
// rolesPermitidos: array opcional, ej. ["master"] para páginas solo-MASTER.
// Devuelve { usuario, rol } si todo está bien; si no, redirige y no devuelve nada útil.
async function requireAuth(rolesPermitidos = null) {
  const usuario = await esperarUsuario();

  if (!usuario) {
    window.location.href = rutaLogin();
    return null;
  }

  const refPerfil = doc(db, "usuarios", usuario.uid);
  const snap = await getDoc(refPerfil);

  if (!snap.exists()) {
    // Usuario autenticado pero sin perfil/rol asignado en Firestore.
    alert("Tu cuenta no tiene un rol asignado. Contacta a la administración.");
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

// Calcula la ruta relativa al login según en qué carpeta esté la página actual
function rutaLogin() {
  const enSubcarpeta = window.location.pathname.includes("/pages/");
  return enSubcarpeta ? "../index.html" : "index.html";
}

async function cerrarSesion() {
  await signOut(auth);
  window.location.href = rutaLogin();
}

export { requireAuth, cerrarSesion, PANEL_POR_ROL };
