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

import { auth, db } from "./firebase-config.js?v=3";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, getDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// Registra una acción en el log de auditoría — quién hizo qué y cuándo.
// Se llama DESPUÉS de que una acción se guardó con éxito (crear, editar, borrar).
async function registrarLog(usuario, rol, accion, detalle = "") {
  try {
    await addDoc(collection(db, "logs"), {
      correo: usuario.email,
      rol,
      accion,
      detalle,
      fecha: serverTimestamp()
    });
  } catch (e) {
    console.error("No se pudo registrar el log:", e);
  }
}

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

// Qué ve cada rol en el menú lateral — se pinta automáticamente en CUALQUIER
// página que llame a requireAuth(), no hace falta repetirlo en cada archivo.
const MENU_POR_ROL = {
  master: [
    ["Sedes", "ciudades.html"],
    ["Profesores", "profesores.html"],
    ["Clases", "clases.html"],
    ["Estudiantes", "estudiantes.html"],
    ["Programas", "programas.html"],
    ["Accesos y usuarios", "usuarios.html"],
    ["Log de cambios", "logs.html"]
  ],
  coordinador: [
    ["Profesores", "profesores.html"],
    ["Clases", "clases.html"],
    ["Estudiantes", "estudiantes.html"]
  ],
  secretaria: [
    ["Profesores", "profesores.html"],
    ["Clases", "clases.html"],
    ["Estudiantes", "estudiantes.html"]
  ],
  profesor: [
    ["Notas", "notas.html"],
    ["Asistencia", "asistencia.html"]
  ]
};

function pintarMenu(rol) {
  const menuEl = document.getElementById("menu-rol");
  if (!menuEl) return;
  menuEl.innerHTML = "";

  // Enlace fijo al inicio, para que siempre haya forma de "volver"
  const inicio = document.createElement("a");
  inicio.href = "dashboard.html";
  inicio.textContent = "Inicio";
  menuEl.appendChild(inicio);

  (MENU_POR_ROL[rol] || []).forEach(([etiqueta, href]) => {
    const a = document.createElement("a");
    a.href = href;
    a.textContent = etiqueta;
    menuEl.appendChild(a);
  });
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

  pintarMenu(rol);

  const linkSalir = document.getElementById("link-salir");
  if (linkSalir) {
    linkSalir.addEventListener("click", (e) => {
      e.preventDefault();
      cerrarSesion();
    });
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

export { requireAuth, cerrarSesion, idPerfil, registrarLog };
