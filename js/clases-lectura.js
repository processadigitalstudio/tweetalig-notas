// Lectura de clases respetando las sedes (las reglas de Firestore bloquean cualquier otra consulta).
// - Master/Admin: todas.  - Profesor: solo las suyas (la consulta debe filtrar por docenteCorreo).
// - Coordinación/Secretaría: las clases de sus sedes y, si incluirDistancia=true, también las
//   clases a distancia de otras sedes (solo para ubicar bien el grupo; la pantalla muestra las suyas).
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

export function sedesDe(perfil) {
  return perfil?.ciudadIds || (perfil?.ciudadId ? [perfil.ciudadId] : []);
}

export async function leerClases(db, rol, perfil, filtros = [], opciones = {}) {
  const base = collection(db, "clases");
  let docs;
  if (rol === "coordinador" || rol === "secretaria") {
    const sedes = sedesDe(perfil);
    const consultas = [];
    for (let i = 0; i < sedes.length; i += 10) {
      consultas.push(query(base, ...filtros, where("ciudadId", "in", sedes.slice(i, i + 10))));
    }
    if (opciones.incluirDistancia && sedes.length > 0) consultas.push(query(base, ...filtros, where("esDistancia", "==", true)));
    const mapa = new Map();
    const snaps = await Promise.all(consultas.map((q) => getDocs(q)));
    snaps.forEach((s) => s.docs.forEach((d) => mapa.set(d.id, d)));
    docs = [...mapa.values()];
  } else {
    docs = (await getDocs(query(base, ...filtros))).docs;
  }
  return { docs, size: docs.length, empty: docs.length === 0, forEach: (fn) => docs.forEach(fn) };
}
