// login.js — inicio de sesión con Google Workspace de Tweetalig

import { auth, db, proveedorGoogle, DOMINIO_PERMITIDO } from "./firebase-config.js";
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const mensajeError = document.getElementById("mensaje-error");
const botonGoogle = document.getElementById("boton-google");

onAuthStateChanged(auth, async (usuario) => {
  if (usuario) {
    window.location.href = "pages/dashboard.html";
  }
});

botonGoogle.addEventListener("click", async () => {
  mensajeError.textContent = "";
  botonGoogle.disabled = true;
  botonGoogle.textContent = "Conectando...";

  try {
    const resultado = await signInWithPopup(auth, proveedorGoogle);
    const correo = resultado.user.email.toLowerCase();

    // Doble verificación: aunque el selector ya filtra por dominio, alguien
    // podría forzar otra cuenta. Si no es del dominio correcto, se rechaza.
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
  } catch (error) {
    if (error.code !== "auth/popup-closed-by-user") {
      mensajeError.textContent = "No se pudo iniciar sesión. Intenta de nuevo.";
    }
    restaurarBoton();
  }
});

function restaurarBoton() {
  botonGoogle.disabled = false;
  botonGoogle.textContent = "Entrar con Google";
}
