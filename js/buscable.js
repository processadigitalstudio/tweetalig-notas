// Pone un cuadro de búsqueda encima de un desplegable largo (p. ej. profesores).
// Escribir filtra las opciones por texto (sin tildes ni mayúsculas); la opción vacía
// "Selecciona..." y la opción elegida siempre se conservan. Se mantiene solo si el
// código vuelve a llenar la lista.
const norm = (t) => String(t || "").toLowerCase().trim()
  .replace(/[áàäâ]/g, "a").replace(/[éèëê]/g, "e").replace(/[íìïî]/g, "i")
  .replace(/[óòöô]/g, "o").replace(/[úùüû]/g, "u");

export function hacerBuscable(select, placeholder = "Buscar por nombre o correo...") {
  if (!select || select.dataset.buscable) return;
  select.dataset.buscable = "1";
  const input = document.createElement("input");
  input.type = "search";
  input.className = "buscador-select";
  input.placeholder = "🔍 " + placeholder;
  input.autocomplete = "off";
  select.parentNode.insertBefore(input, select);

  let todas = [...select.options];
  let propio = false;
  let obs = null;

  function aplicar() {
    const q = norm(input.value);
    const elegida = select.selectedOptions[0] || null;
    propio = true;
    todas.forEach((o) => o.remove());
    todas.forEach((o) => {
      if (!q || o.value === "" || o === elegida || norm(o.textContent).includes(q)) select.appendChild(o);
    });
    if (elegida) select.value = elegida.value;
    obs.takeRecords(); // descarta los cambios propios: si no, el observador se reactiva sin fin
    propio = false;
  }
  input.addEventListener("input", aplicar);
  input.addEventListener("keydown", (e) => { if (e.key === "Escape") { input.value = ""; aplicar(); } });

  obs = new MutationObserver(() => {
    if (propio) return;
    todas = [...select.options];
    if (input.value) aplicar();
  });
  obs.observe(select, { childList: true });
}
