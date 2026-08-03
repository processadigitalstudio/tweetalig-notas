// login.js — inicio de sesión con Google Workspace de Tweetalig
// Usa signInWithRedirect en vez de signInWithPopup: más confiable, porque
// no depende de que el navegador permita ventanas emergentes ni cookies
// de terceros (eso era lo que cerraba la ventana de golpe).

import { auth, db, proveedorGoogle, DOMINIO_PERMITIDO } from "./firebase-config.js";
import {
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const mensajeError = document.getElementById("mensaje-error");
const botonGoogle = document.getElementById("boton-google");

async function validarYRedirigir(usuario) {
  const correo = usuario.email.toLowerCase();

  if (!correo.endsWith("@" + DOMINIO_PERMITIDO)) {
    await signOut(auth);
    mensajeError.textContent = `Debes iniciar sesión con una cuenta @${DOMINIO_PERMITIDO}.`;
    restaurarBoton();
    return;
  }

  const snap = await getDoc(doc(db, "usuarios", correo));

  if (!snap.exists()) {
    await signOut(auth);
    mensajeError.textContent = "Tu cuenta no está registrada en el sistema. Contacta a la administración de Tweetalig.";
    restaurarBoton();
    return;
  }

  window.location.href = "pages/dashboard.html";
}

// Al cargar la página: revisa si venimos de vuelta de un redirect a Google
getRedirectResult(auth)
  .then((resultado) => {
    if (resultado && resultado.user) {
      validarYRedirigir(resultado.user);
    }
  })
  .catch(() => {
    mensajeError.textContent = "No se pudo completar el inicio de sesión. Intenta de nuevo.";
    restaurarBoton();
  });

// Si ya hay sesión activa (por persistencia), saltar directo al dashboard
onAuthStateChanged(auth, (usuario) => {
  if (usuario) {
    validarYRedirigir(usuario);
  }
});

botonGoogle.addEventListener("click", () => {
  mensajeError.textContent = "";
  botonGoogle.disabled = true;
  botonGoogle.textContent = "Conectando...";
  signInWithRedirect(auth, proveedorGoogle);
});

function restaurarBoton() {
  botonGoogle.disabled = false;
  botonGoogle.textContent = "Entrar con Google";
}
