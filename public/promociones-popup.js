
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

  let cerrado = false;

  function cerrarPromocion() {
    cerrado = true;
    popup.hidden = true;
  }

  cerrar.addEventListener("click", cerrarPromocion);

  function obtenerDescripcion(promo) {

    if (promo.tipo === "porcentaje") {
      return `${Number(promo.descuento)}% de descuento al agregar ${Number(promo.cantidad_min)} quinielas o más.`;
    }

    if (promo.tipo === "paquete") {
      return `¡Llévate ${Number(promo.cantidad_paquete)} quinielas por $${Number(promo.precio_paquete).toLocaleString("es-MX")} MXN!`;
    }

    return "¡Aprovecha esta promoción especial!";
  }

  async function cargarPopupPromociones() {

    try {

      const respuesta = await fetch("/promociones/activas", {
        credentials: "same-origin",
        cache: "no-store"
      });

      if (!respuesta.ok) {
        throw new Error("No se pudieron cargar las promociones");
      }

      const promociones = await respuesta.json();

      if (!Array.isArray(promociones) || promociones.length === 0) {
        return;
      }

      // Mostrar la promoción más reciente
      const promocion = promociones[0];

      nombre.textContent = promocion.nombre;
      detalle.textContent = obtenerDescripcion(promocion);

      // Esperar a que desaparezca el splash
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
          !splash.isConnected;

        if (splashOculto) {
          clearInterval(esperarSplash);

          if (!cerrado) {
            popup.hidden = false;
          }
        }

      }, 250);

      // Evitar que el intervalo permanezca indefinidamente
      setTimeout(() => clearInterval(esperarSplash), 15000);

    } catch (error) {
      console.error("Error cargando anuncio de promoción:", error);
    }

  }

  cargarPopupPromociones();

});
