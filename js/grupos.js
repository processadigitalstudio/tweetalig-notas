// Agrupa las clases a distancia: mismo programa de distancia, mismo profesor,
// mismo nivel, grupo y período, aunque estén en sedes distintas.
// Las clases presenciales nunca se agrupan (cada una es su propio grupo).
export function esProgramaDistancia(c) {
  return String(c?.programaNombre || "").toLowerCase().includes("distancia");
}

export function claveGrupo(c) {
  if (c.grupoDistanciaId) return c.grupoDistanciaId;
  if (esProgramaDistancia(c) && c.docenteCorreo) {
    return ["dist", c.programaId || c.programaNombre, c.docenteCorreo, c.nivel, c.grupo, c.anio, c.periodo, c.ciclo]
      .map((x) => String(x ?? "").trim().toLowerCase()).join("|");
  }
  return c.id;
}
