// login.js — inicio de sesión con Google Workspace de Tweetalig
// Usamos signInWithPopup: ahora que el sitio vive en el dominio de Firebase
// (web.app), esto evita la protección de Chrome contra "bounce tracking"
// que bloqueaba el signInWithRedirect (borraba el estado a mitad de camino
// en la cadena de redirecciones Google → firebaseapp.com → nuestro sitio).

import { auth, db, proveedorGoogle, DOMINIO_PERMITIDO } from "./firebase-config.js?v=3";
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const mensajeError = document.getElementById("mensaje-error");
const botonGoogle = document.getElementById("boton-google");

onAuthStateChanged(auth, (usuario) => {
  if (usuario) {
    validarYRedirigir(usuario);
  }
});

botonGoogle.addEventListener("click", async () => {
  mensajeError.textContent = "";
  botonGoogle.disabled = true;
  botonGoogle.textContent = "Conectando...";

  try {
    const resultado = await signInWithPopup(auth, proveedorGoogle);
    await validarYRedirigir(resultado.user);
  } catch (error) {
    console.error("Error de login:", error);
    if (error.code === "auth/popup-closed-by-user") {
      restaurarBoton();
      return;
    }
    mensajeError.textContent = `No se pudo iniciar sesión (${error.code || error.message}).`;
    restaurarBoton();
  }
});

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

function restaurarBoton() {
  botonGoogle.disabled = false;
  botonGoogle.textContent = "Entrar con Google";
}
