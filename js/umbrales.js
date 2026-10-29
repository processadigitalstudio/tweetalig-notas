// Límites de inasistencia por programa y nivel.
// El programa guarda: horasPorNivel [{nivel, horas}], pctAlerta1, pctAlerta2, pctPerdida.
// 1 bloque = 1 hora. Se pierde / alerta cuando las horas de inasistencia SUPERAN
// el porcentaje de las horas del curso (ej. 96 h al 10 % -> con 10 h ya se pierde).
export const PCT_POR_DEFECTO = { alerta1: 5, alerta2: 8, perdida: 10 };

export function normalizarNivel(n) {
  return String(n || "").toLowerCase().replace(/\s+/g, "").replace(/[-_]/g, "");
}

// Devuelve null si el programa no tiene horas configuradas para ese nivel.
export function calcularUmbrales(programa, nivel) {
  const fila = (programa?.horasPorNivel || []).find((x) => normalizarNivel(x.nivel) === normalizarNivel(nivel));
  const horas = Number(fila?.horas);
  if (!horas || horas <= 0) return null;
  const p1 = Number(programa.pctAlerta1) || PCT_POR_DEFECTO.alerta1;
  const p2 = Number(programa.pctAlerta2) || PCT_POR_DEFECTO.alerta2;
  const pp = Number(programa.pctPerdida) || PCT_POR_DEFECTO.perdida;
  return { horasCurso: horas, alerta1: horas * p1 / 100, alerta2: horas * p2 / 100, perdida: horas * pp / 100, pct: { alerta1: p1, alerta2: p2, perdida: pp } };
}

// umbrales: resultado de calcularUmbrales, o {alerta1,alerta2,perdida} manuales de respaldo.
export function estadoInasistencia(horas, umbrales) {
  if (!umbrales) return "ok";
  if (horas > umbrales.perdida) return "perdida";
  if (umbrales.alerta2 != null && horas > umbrales.alerta2) return "alerta2";
  if (umbrales.alerta1 != null && horas > umbrales.alerta1) return "alerta1";
  return "ok";
}

export const ETIQUETA_ESTADO = { ok: "Al día", alerta1: "Alerta 1", alerta2: "Alerta 2", perdida: "Pérdida" };
