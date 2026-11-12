
/* ==========================================
   🎁 POPUP DE PROMOCIONES
   QUINIELAS EL INGE
========================================== */

document.addEventListener("DOMContentLoaded", () => {

  const popup = document.getElementById("popupPromocion");
  const cerrar = document.getElementById("cerrarPopupPromo");
  const nombre = document.getElementById("popupPromoNombre");
  const detalle = document.getElementById("popupPromoDetalle");

  if (!popup || !cerrar || !nombre || !detalle) return;

  const modal = popup.querySelector(".promo-modal");
  const etiqueta = popup.querySelector(".promo-etiqueta");
  const titulo = popup.querySelector(".promo-titulo");
  const mensaje = popup.querySelector(".promo-mensaje");

  let cerrado = false;

  function cerrarPromocion() {
    cerrado = true;
    popup.hidden = true;
  }

  cerrar.addEventListener("click", cerrarPromocion);

  function dinero(valor) {
    return Number(valor).toLocaleString("es-MX", {
      maximumFractionDigits: 2
    });
  }

  function configurarPromocion(promo) {

    // Limpiar diseños anteriores
    modal.classList.remove(
      "promo-tipo-porcentaje",
      "promo-tipo-paquete"
    );

    nombre.textContent = promo.nombre || "Promoción especial";

    if (promo.tipo === "porcentaje") {

      modal.classList.add("promo-tipo-porcentaje");

      if (etiqueta) {
        etiqueta.textContent = "🎁 DESCUENTO ESPECIAL";
      }

      if (titulo) {
        titulo.textContent = "¡APROVECHA ESTA OFERTA!";
      }

      const porcentaje = Number(promo.descuento);
      const minimo = Number(promo.cantidad_min);

      detalle.replaceChildren();

      const cantidad = document.createElement("div");
      cantidad.className = "promo-valor";
      cantidad.textContent = `${porcentaje}% OFF`;

      const descripcion = document.createElement("p");
      descripcion.className = "promo-condicion";
      descripcion.textContent =
        `En la compra de ${minimo} quinielas o más`;

      detalle.append(cantidad, descripcion);

      if (mensaje) {
        mensaje.textContent =
          "⚽ ¡Entre más juegas, más ahorras!";
      }

    } else if (promo.tipo === "paquete") {

      modal.classList.add("promo-tipo-paquete");

      if (etiqueta) {
        etiqueta.textContent = "🎟️ PAQUETE ESPECIAL";
      }

      if (titulo) {
        titulo.textContent = "¡MÁS QUINIELAS POR MENOS!";
      }

      const cantidadQuinielas =
        Number(promo.cantidad_paquete);

      const precioPaquete =
        Number(promo.precio_paquete);

      // Precio normal de cada quiniela
      const precioNormal = 50;

      const totalNormal =
        cantidadQuinielas * precioNormal;

      const ahorro =
        totalNormal - precioPaquete;

      detalle.replaceChildren();

      const cantidad = document.createElement("div");
      cantidad.className = "promo-cantidad";
      cantidad.textContent =
        `${cantidadQuinielas} QUINIELAS`;

      const precio = document.createElement("div");
      precio.className = "promo-precio";
      precio.textContent =
        `$${dinero(precioPaquete)} MXN`;

      detalle.append(cantidad, precio);

      if (ahorro > 0) {
        const ahorroTexto = document.createElement("p");
        ahorroTexto.className = "promo-ahorro";
        ahorroTexto.textContent =
          `🎉 ¡AHORRA $${dinero(ahorro)}!`;

        detalle.appendChild(ahorroTexto);
      }

      if (mensaje) {
        mensaje.textContent =
          "⚽ ¡Más oportunidades de ganar por menos!";
      }

    } else {
      // No mostrar tipos desconocidos
      return false;
    }

    return true;
  }

  async function cargarPopupPromociones() {

    try {

      const respuesta = await fetch("/promociones/activas", {
        credentials: "same-origin",
        cache: "no-store"
      });

      if (!respuesta.ok) {
        throw new Error(
          "No se pudieron cargar las promociones"
        );
      }

      const promociones = await respuesta.json();

      if (
        !Array.isArray(promociones) ||
        promociones.length === 0
      ) {
        return;
      }

      // Mostrar la promoción vigente más reciente
      const promocion = promociones[0];

      if (!configurarPromocion(promocion)) return;

      const esperarSplash = setInterval(() => {

        if (cerrado) {
          clearInterval(esperarSplash);
          return;
        }

        const splash = document.getElementById("splash");

        if (!splash) {
          clearInterval(esperarSplash);
          popup.hidden = false;
          return;
        }

        const estilos = window.getComputedStyle(splash);

        const splashOculto =
          estilos.display === "none" ||
          estilos.visibility === "hidden" ||
          estilos.opacity === "0" ||
          !splash.isConnected;

        if (splashOculto) {
          clearInterval(esperarSplash);

          if (!cerrado) {
            popup.hidden = false;
          }
        }

      }, 250);

      setTimeout(() => {
        clearInterval(esperarSplash);
      }, 15000);

    } catch (error) {
      console.error(
        "Error cargando anuncio de promoción:",
        error
      );
    }

  }

  cargarPopupPromociones();

});
