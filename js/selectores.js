// Hace que un desplegable de elección (profesor, programa, sede...) arranque en
// "Selecciona..." en vez de dejar elegida la primera opción. Se mantiene solo:
// cada vez que el código vuelve a llenar la lista, se vuelve a poner.
export function seleccionarPorDefecto(select, texto = "Selecciona...") {
  if (!select) return;
  const aplicar = () => {
    if (!select.options.length) return;
    if ([...select.options].some((o) => o.value === "")) return; // ya tiene una opción vacía
    const eraPrimera = select.selectedIndex <= 0;
    const opt = document.createElement("option");
    opt.value = ""; opt.textContent = texto;
    select.insertBefore(opt, select.firstChild);
    if (eraPrimera) select.selectedIndex = 0;
  };
  new MutationObserver(aplicar).observe(select, { childList: true });
  aplicar();
}
