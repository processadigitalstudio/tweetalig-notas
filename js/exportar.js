// Descarga una tabla (arreglo de filas) como Excel (.xlsx) o CSV.
// Las cédulas y demás textos se guardan como texto; solo los números reales van como número.
let promesaXlsx = null;
function cargarXlsx() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (!promesaXlsx) {
    promesaXlsx = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      s.onload = () => resolve(window.XLSX);
      s.onerror = () => { promesaXlsx = null; reject(new Error("No se pudo cargar el generador de Excel.")); };
      document.head.appendChild(s);
    });
  }
  return promesaXlsx;
}

function bajar(blob, nombre) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(a.href);
}

// filas: [[...], [...]] (la primera suele ser el encabezado). nombreBase: sin extensión.
export async function descargarTabla(filas, nombreBase, formato = "xlsx", nombreHoja = "Reporte") {
  const limpias = filas.map((f) => f.map((c) => {
    const v = (c && typeof c === "object") ? c.texto : c;
    return v === undefined || v === null ? "" : v;
  }));
  if (formato === "csv") {
    const celda = (c) => `"${String(c).replace(/"/g, '""')}"`;
    const csv = limpias.map((f) => f.map(celda).join(",")).join("\r\n");
    bajar(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), `${nombreBase}.csv`);
    return;
  }
  const XLSX = await cargarXlsx();
  const hoja = XLSX.utils.aoa_to_sheet(limpias);
  const ancho = [];
  limpias.forEach((f) => f.forEach((c, i) => { ancho[i] = Math.min(60, Math.max(ancho[i] || 8, String(c).length + 2)); }));
  hoja["!cols"] = ancho.map((w) => ({ wch: w }));
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, nombreHoja.slice(0, 31));
  XLSX.writeFile(libro, `${nombreBase}.xlsx`);
}

// Selector de formato listo para poner junto a un botón de descarga.
export function selectorFormatoHtml(id) {
  return `<select id="${id}" style="font-family:var(--fuente-cuerpo); font-size:12.5px; padding:7px 8px; border:1px solid var(--linea); border-radius:6px; background:var(--fondo); color:var(--tinta);">
    <option value="xlsx">Excel (.xlsx)</option><option value="csv">CSV (texto)</option></select>`;
}
