// Configuración de Firebase — proyecto tweetalig-notas
// Estas credenciales son públicas por diseño: la seguridad real vive en las
// reglas de Firestore (firestore.rules), no en ocultar este archivo.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB5yLwagFdTjzYb2XdtSjohwGP8izenBDo",
  authDomain: "tweetalig-notas.firebaseapp.com",
  projectId: "tweetalig-notas",
  storageBucket: "tweetalig-notas.firebasestorage.app",
  messagingSenderId: "1016259397105",
  appId: "1:1016259397105:web:d177ff037ff784bff17050"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// IMPORTANTE: esto es lo que te faltaba en el examen B1.1.
// browserLocalPersistence guarda la sesión en el navegador de forma
// duradera, para que al refrescar la página NO te saque del login.
setPersistence(auth, browserLocalPersistence);

export { app, auth, db };
