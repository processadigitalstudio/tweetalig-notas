// login.js — lógica de la pantalla de inicio de sesión (index.html)

import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const form = document.getElementById("form-login");
const mensajeError = document.getElementById("mensaje-error");
const botonEntrar = document.getElementById("boton-entrar");

// Si ya hay una sesión activa (por persistencia), no mostrar el login:
// mandar directo al dashboard.
onAuthStateChanged(auth, async (usuario) => {
  if (usuario) {
    window.location.href = "pages/dashboard.html";
  }
});

form.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mensajeError.textContent = "";
  botonEntrar.disabled = true;
  botonEntrar.textContent = "Entrando...";

  const correo = document.getElementById("correo").value.trim();
  const clave = document.getElementById("clave").value;

  try {
    const credencial = await signInWithEmailAndPassword(auth, correo, clave);

    // Verificar que el usuario tenga un rol asignado en Firestore
    const refPerfil = doc(db, "usuarios", credencial.user.uid);
    const snap = await getDoc(refPerfil);

    if (!snap.exists()) {
      mensajeError.textContent = "Tu cuenta no tiene un rol asignado todavía. Contacta a la administración.";
      botonEntrar.disabled = false;
      botonEntrar.textContent = "Entrar";
      return;
    }

    window.location.href = "pages/dashboard.html";
  } catch (error) {
    mensajeError.textContent = traducirError(error.code);
    botonEntrar.disabled = false;
    botonEntrar.textContent = "Entrar";
  }
});

function traducirError(codigo) {
  const mensajes = {
    "auth/invalid-email": "El correo no tiene un formato válido.",
    "auth/user-not-found": "No existe una cuenta con ese correo.",
    "auth/wrong-password": "La contraseña es incorrecta.",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/too-many-requests": "Demasiados intentos. Espera unos minutos e intenta de nuevo."
  };
  return mensajes[codigo] || "No se pudo iniciar sesión. Intenta de nuevo.";
}
