// multiple.js
// Filtro de selección múltiple tipo Google Sheets: casillas, "Seleccionar todo", "Borrar" y buscador.
// Sin nada marcado (o con todo marcado) NO se filtra: equivale a "Todas".
// Se activa con el atributo data-multiple en un <select>. El <select> queda oculto y guarda las
// opciones; el código de la página lee  select.valores  (arreglo de valores marcados, vacío = todos).
// Compatibilidad: select.value devuelve el valor si hay uno solo marcado, o "" si hay varios o ninguno;
// asignar select.value = "" borra la selección.
const norm = (t) => String(t || "").toLowerCase().trim()
  .replace(/[áàäâ]/g, "a").replace(/[éèëê]/g, "e").replace(/[íìïî]/g, "i")
  .replace(/[óòöô]/g, "o").replace(/[úùüû]/g, "u");

let estiloPuesto = false;
function ponerEstilo() {
  if (estiloPuesto) return; estiloPuesto = true;
  const st = document.createElement("style");
  st.textContent = `
    .mult { position: relative; display: inline-block; box-sizing: border-box; max-width: 100%; min-width: 170px; vertical-align: middle; }
    select.mult-oculto { display: none !important; }
    .mult-btn { width: 100%; box-sizing: border-box; text-align: left; padding: 8px 30px 8px 10px; border: 1px solid #B9C4C0; border-radius: 7px; background: #fff; font-family: var(--fuente-cuerpo); font-size: 13px; color: var(--tinta); cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      background: #fff url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8'><path d='M1 1l5 5 5-5' fill='none' stroke='%235C6B78' stroke-width='2'/></svg>") no-repeat right 10px center; }
    .mult-btn.filtrando { border-color: var(--azul-profundo); background-color: #f3f8f6; font-weight: 600; }
    .mult-panel { position: absolute; left: 0; top: 100%; z-index: 70; min-width: 100%; width: max-content; max-width: 360px; margin-top: 2px; background: #fff; border: 1px solid #B9C4C0; border-radius: 8px; box-shadow: 0 6px 18px rgba(44,61,77,.18); display: none; }
    .mult.abierto .mult-panel { display: block; }
    .mult-panel .mult-buscar { width: calc(100% - 16px); margin: 8px; box-sizing: border-box; padding: 6px 8px; font-size: 13px; border: 1px solid #B9C4C0; border-radius: 6px; }
    .mult-acciones { display: flex; gap: 14px; padding: 0 10px 6px; font-size: 12.5px; }
    .mult-acciones button { background: none; border: none; padding: 0; color: var(--azul-profundo); text-decoration: underline; cursor: pointer; font-size: 12.5px; }
    .mult-lista { max-height: 250px; overflow-y: auto; border-top: 1px solid var(--linea); }
    .mult-item { display: flex; gap: 8px; align-items: center; padding: 7px 10px; font-size: 13px; cursor: pointer; font-family: var(--fuente-cuerpo); color: var(--tinta); }
    .mult-item:hover { background: var(--verde-marca-suave); }
    .mult-item input { margin: 0; }
    .mult-vacio { padding: 8px 10px; font-size: 13px; color: var(--tinta-suave); }`;
  document.head.appendChild(st);
}

export function hacerMultiple(select) {
  if (!select || select.dataset.multipleListo) return;
  select.dataset.multipleListo = "1";
  select.dataset.buscable = "1"; // que el buscador simple no lo toque
  ponerEstilo();

  const sel = new Set();
  const caja = document.createElement("div");
  caja.className = "mult";
  const cs = getComputedStyle(select);
  if (select.style.width) caja.style.width = select.style.width;
  if (select.style.maxWidth) caja.style.maxWidth = select.style.maxWidth;
  if (cs.display === "block") caja.style.display = "block";
  const boton = document.createElement("button");
  boton.type = "button"; boton.className = "mult-btn";
  const panel = document.createElement("div");
  panel.className = "mult-panel";
  panel.innerHTML = `<input type="text" class="mult-buscar" placeholder="Buscar...">
    <div class="mult-acciones"><button type="button" data-a="todo">Seleccionar todo</button><button type="button" data-a="borrar">Borrar</button></div>
    <div class="mult-lista"></div>`;
  caja.append(boton, panel);
  select.parentNode.insertBefore(caja, select);
  select.classList.add("mult-oculto");
  const buscar = panel.querySelector(".mult-buscar");
  const lista = panel.querySelector(".mult-lista");

  const opciones = () => [...select.options].filter((o) => o.value !== "");
  const textoTodas = () => (select.options[0] && select.options[0].value === "" ? select.options[0].textContent : "Todos");

  function resumen() {
    const ops = opciones();
    const n = [...sel].filter((v) => ops.some((o) => o.value === v)).length;
    let txt;
    if (n === 0 || n === ops.length) txt = textoTodas();
    else if (n === 1) txt = ops.find((o) => sel.has(o.value)).textContent;
    else txt = `${n} seleccionados`;
    boton.textContent = txt; boton.title = txt;
    boton.classList.toggle("filtrando", n > 0 && n < ops.length);
  }

  function pintarLista() {
    const q = norm(buscar.value);
    lista.innerHTML = "";
    const visibles = opciones().filter((o) => !q || norm(o.textContent).includes(q));
    if (!visibles.length) { lista.innerHTML = '<div class="mult-vacio">Sin resultados</div>'; return; }
    visibles.forEach((o) => {
      const lbl = document.createElement("label");
      lbl.className = "mult-item";
      const cb = document.createElement("input");
      cb.type = "checkbox"; cb.checked = sel.has(o.value);
      cb.addEventListener("change", () => { cb.checked ? sel.add(o.value) : sel.delete(o.value); cambio(); });
      lbl.append(cb, document.createTextNode(o.textContent));
      lista.appendChild(lbl);
    });
  }

  function cambio() { resumen(); select.dispatchEvent(new Event("change", { bubbles: true })); }

  panel.querySelector('[data-a="todo"]').addEventListener("click", () => {
    const q = norm(buscar.value);
    opciones().filter((o) => !q || norm(o.textContent).includes(q)).forEach((o) => sel.add(o.value));
    pintarLista(); cambio();
  });
  panel.querySelector('[data-a="borrar"]').addEventListener("click", () => { sel.clear(); buscar.value = ""; pintarLista(); cambio(); });
  buscar.addEventListener("input", pintarLista);
  boton.addEventListener("click", () => {
    caja.classList.toggle("abierto");
    if (caja.classList.contains("abierto")) { buscar.value = ""; pintarLista(); buscar.focus(); }
  });
  document.addEventListener("mousedown", (e) => { if (!caja.contains(e.target)) caja.classList.remove("abierto"); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") caja.classList.remove("abierto"); });

  // Lectura desde el código de la página.
  Object.defineProperty(select, "valores", {
    get() { const ops = opciones(); const v = [...sel].filter((x) => ops.some((o) => o.value === x)); return v.length === ops.length ? [] : v; },
    configurable: true
  });
  const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  Object.defineProperty(select, "value", {
    get() { const v = select.valores; return v.length === 1 ? v[0] : ""; },
    set(v) { sel.clear(); if (v !== "" && v != null) sel.add(String(v)); resumen(); },
    configurable: true
  });

  // Si el código vuelve a llenar las opciones: se conservan las marcas que sigan existiendo.
  new MutationObserver(() => {
    const ops = new Set(opciones().map((o) => o.value));
    [...sel].forEach((v) => { if (!ops.has(v)) sel.delete(v); });
    resumen();
    if (caja.classList.contains("abierto")) pintarLista();
  }).observe(select, { childList: true });
  const sincronizarVisible = () => { caja.style.display = (select.style.display === "none" || select.hidden || select.parentElement?.style.display === "none") ? "none" : (cs.display === "block" ? "block" : "inline-block"); };
  new MutationObserver(sincronizarVisible).observe(select, { attributes: true, attributeFilter: ["style", "hidden"] });
  resumen();
}

// Activa el filtro múltiple en todos los <select data-multiple> de la página (también los que se crean después).
export function multiplesAutomaticos() {
  const aplicar = (raiz) => {
    const lista = raiz.matches?.("select[data-multiple]") ? [raiz] : [...(raiz.querySelectorAll?.("select[data-multiple]") || [])];
    lista.forEach((s) => hacerMultiple(s));
  };
  const iniciar = () => {
    aplicar(document.body);
    new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) aplicar(n); })))
      .observe(document.body, { childList: true, subtree: true });
  };
  if (document.body) iniciar(); else document.addEventListener("DOMContentLoaded", iniciar);
}
