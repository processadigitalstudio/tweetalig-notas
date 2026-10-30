// Desplegable con escritura integrada: se hace clic, se escribe y la lista se reduce
// (sin tildes ni mayúsculas). El <select> original queda oculto y sigue siendo el que
// guarda el valor (select.value, evento "change"), así el resto del código no cambia.
const norm = (t) => String(t || "").toLowerCase().trim()
  .replace(/[áàäâ]/g, "a").replace(/[éèëê]/g, "e").replace(/[íìïî]/g, "i")
  .replace(/[óòöô]/g, "o").replace(/[úùüû]/g, "u");

let estiloPuesto = false;
function ponerEstilo() {
  if (estiloPuesto) return; estiloPuesto = true;
  const st = document.createElement("style");
  st.textContent = `
    .combo-buscable { position: relative; display: block; width: 100%; max-width: 420px; }
    .combo-buscable input.combo-entrada { width: 100%; box-sizing: border-box; padding: 8px 30px 8px 10px; border-radius: 7px; font-family: var(--fuente-cuerpo); font-size: 13px; cursor: text; text-overflow: ellipsis;
      background: #fff url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8'><path d='M1 1l5 5 5-5' fill='none' stroke='%235C6B78' stroke-width='2'/></svg>") no-repeat right 10px center !important; }
    .combo-buscable .combo-lista { position: absolute; left: 0; right: 0; top: 100%; z-index: 60; max-height: 260px; overflow-y: auto; margin-top: 2px;
      background: #fff; border: 1px solid #B9C4C0; border-radius: 7px; box-shadow: 0 6px 18px rgba(44,61,77,.15); display: none; }
    .combo-buscable.abierto .combo-lista { display: block; }
    .combo-buscable .combo-item { padding: 8px 10px; font-family: var(--fuente-cuerpo); font-size: 13px; color: var(--tinta); cursor: pointer; }
    .combo-buscable .combo-item.activo { background: var(--verde-marca-suave); }
    .combo-buscable .combo-item.elegido { font-weight: 600; }
    .combo-buscable .combo-vacio { padding: 8px 10px; font-size: 13px; color: var(--tinta-suave); }`;
  document.head.appendChild(st);
}

export function hacerBuscable(select, placeholder = "Escribe para buscar...") {
  if (!select || select.dataset.buscable) return;
  select.dataset.buscable = "1";
  ponerEstilo();

  const caja = document.createElement("div");
  caja.className = "combo-buscable";
  const input = document.createElement("input");
  input.type = "text"; input.className = "combo-entrada"; input.autocomplete = "off";
  const lista = document.createElement("div");
  lista.className = "combo-lista";
  select.parentNode.insertBefore(caja, select);
  caja.appendChild(input); caja.appendChild(lista);
  select.style.display = "none";

  let activo = -1, visibles = [];
  const textoElegido = () => { const o = select.selectedOptions[0]; return o ? o.textContent : ""; };
  const mostrarElegido = () => { input.value = textoElegido(); input.placeholder = placeholder; };

  function pintar() {
    const q = norm(input.dataset.filtrando === "1" ? input.value : "");
    lista.innerHTML = "";
    visibles = [...select.options].filter((o) => o.value === "" || !q || norm(o.textContent).includes(q));
    if (visibles.length === 0) { lista.innerHTML = '<div class="combo-vacio">Sin resultados</div>'; return; }
    visibles.forEach((o, i) => {
      const d = document.createElement("div");
      d.className = "combo-item" + (o.selected ? " elegido" : "") + (i === activo ? " activo" : "");
      d.textContent = o.textContent;
      d.addEventListener("mousedown", (e) => { e.preventDefault(); elegir(o); });
      lista.appendChild(d);
    });
  }
  function abrir() { caja.classList.add("abierto"); pintar(); }
  function cerrar() { caja.classList.remove("abierto"); input.dataset.filtrando = "0"; activo = -1; mostrarElegido(); }
  function elegir(o) {
    const cambio = select.value !== o.value;
    select.value = o.value;
    input.blur();
    cerrar();
    if (cambio) select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  input.addEventListener("focus", () => { input.dataset.filtrando = "0"; input.select(); abrir(); });
  input.addEventListener("click", () => { if (!caja.classList.contains("abierto")) { input.select(); abrir(); } });
  input.addEventListener("input", () => {
    input.dataset.filtrando = "1"; abrir();
    activo = visibles.findIndex((o) => o.value !== ""); // la primera coincidencia real, no "Selecciona..."
    pintar();
  });
  input.addEventListener("blur", cerrar);
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (!caja.classList.contains("abierto")) abrir(); activo = Math.min(visibles.length - 1, activo + 1); pintar(); lista.children[activo]?.scrollIntoView({ block: "nearest" }); }
    else if (e.key === "ArrowUp") { e.preventDefault(); activo = Math.max(0, activo - 1); pintar(); lista.children[activo]?.scrollIntoView({ block: "nearest" }); }
    else if (e.key === "Enter") { e.preventDefault(); if (visibles[activo]) elegir(visibles[activo]); else if (visibles.length === 1) elegir(visibles[0]); }
    else if (e.key === "Escape") { input.blur(); }
  });

  // Si el código cambia select.value directamente, el cuadro se actualiza.
  const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  Object.defineProperty(select, "value", {
    get() { return desc.get.call(this); },
    set(v) { desc.set.call(this, v); if (document.activeElement !== input) mostrarElegido(); },
    configurable: true
  });

  // Si el código vuelve a llenar las opciones, se actualiza el cuadro.
  new MutationObserver(() => { if (document.activeElement !== input) mostrarElegido(); else pintar(); })
    .observe(select, { childList: true });
  select.addEventListener("change", () => { if (document.activeElement !== input) mostrarElegido(); });
  mostrarElegido();
}
