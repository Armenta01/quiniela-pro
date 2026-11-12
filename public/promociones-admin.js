
/* ==========================================
   🎁 ADMINISTRADOR DE PROMOCIONES
   QUINIELAS EL INGE
========================================== */

document.addEventListener("DOMContentLoaded", () => {
  const formulario = document.getElementById("formPromocion");
  const tipo = document.getElementById("promoTipo");
  const camposPorcentaje = document.getElementById("camposPorcentaje");
  const camposPaquete = document.getElementById("camposPaquete");
  const tabla = document.getElementById("tablaPromociones");
  const mensaje = document.getElementById("mensajePromocion");
  const botonGuardar = document.getElementById("btnGuardarPromocion");

  if (!formulario || !tipo || !tabla) return;

  const moneda = valor =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN"
    }).format(Number(valor));

  const mostrarMensaje = (texto, error = false) => {
    mensaje.textContent = texto;
    mensaje.style.color = error ? "#ff6b6b" : "#4ade80";
  };

  // Las fechas del formulario se interpretan
  // como horario de Ciudad de México (UTC-6
  // en noviembre; esta función contempla cambios
  // de zona mediante Intl).
  function fechaMexicoAISO(valor) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)) {
      throw new Error("Selecciona una fecha y hora válidas.");
    }

    const [fecha, hora] = valor.split("T");
    const [anio, mes, dia] = fecha.split("-").map(Number);
    const [horas, minutos] = hora.split(":").map(Number);

    const objetivo = Date.UTC(
      anio, mes - 1, dia, horas, minutos
    );

    if (
      new Date(objetivo).getUTCFullYear() !== anio ||
      new Date(objetivo).getUTCMonth() !== mes - 1 ||
      new Date(objetivo).getUTCDate() !== dia ||
      horas > 23 || minutos > 59
    ) {
      throw new Error("La fecha indicada no es válida.");
    }

    const formato = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Mexico_City",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    });

    let instante = objetivo;

    for (let i = 0; i < 3; i++) {
      const partes = Object.fromEntries(
        formato.formatToParts(new Date(instante))
          .filter(p => p.type !== "literal")
          .map(p => [p.type, Number(p.value)])
      );

      const mostrado = Date.UTC(
        partes.year,
        partes.month - 1,
        partes.day,
        partes.hour,
        partes.minute
      );

      instante += objetivo - mostrado;
    }

    return new Date(instante).toISOString();
  }

  function actualizarCampos() {
    const esPorcentaje = tipo.value === "porcentaje";

    camposPorcentaje.hidden = !esPorcentaje;
    camposPaquete.hidden = esPorcentaje;

    document.getElementById("promoDescuento").required = esPorcentaje;
    document.getElementById("promoCantidadMin").required = esPorcentaje;
    document.getElementById("promoCantidadPaquete").required = !esPorcentaje;
    document.getElementById("promoPrecioPaquete").required = !esPorcentaje;
  }

  tipo.addEventListener("change", actualizarCampos);
  actualizarCampos();

  async function solicitar(url, opciones = {}) {
    const respuesta = await fetch(url, {
      credentials: "same-origin",
      ...opciones,
      headers: {
        ...(opciones.body ? {
          "Content-Type": "application/json"
        } : {}),
        ...(opciones.headers || {})
      }
    });

    let datos;

    try {
      datos = await respuesta.json();
    } catch {
      throw new Error("El servidor devolvió una respuesta no válida.");
    }

    if (!respuesta.ok) {
      throw new Error(datos.error || "Ocurrió un error en el servidor.");
    }

    return datos;
  }

  async function cargarPromociones() {
    tabla.replaceChildren();

    const filaCarga = document.createElement("tr");
    const celdaCarga = document.createElement("td");
    celdaCarga.colSpan = 5;
    celdaCarga.textContent = "Cargando promociones...";
    filaCarga.appendChild(celdaCarga);
    tabla.appendChild(filaCarga);

    try {
      const promociones = await solicitar("/admin/promociones");

      tabla.replaceChildren();

      if (!Array.isArray(promociones) || promociones.length === 0) {
        const fila = document.createElement("tr");
        const celda = document.createElement("td");
        celda.colSpan = 5;
        celda.textContent = "Todavía no hay promociones registradas.";
        fila.appendChild(celda);
        tabla.appendChild(fila);
        return;
      }

      for (const promo of promociones) {
        const fila = document.createElement("tr");

        const nombre = document.createElement("td");
        nombre.textContent = promo.nombre;

        const detalle = document.createElement("td");

        if (promo.tipo === "porcentaje") {
          detalle.textContent =
            `${promo.descuento}% desde ${promo.cantidad_min} quinielas`;
        } else {
          detalle.textContent =
            `${promo.cantidad_paquete} quinielas por ${moneda(promo.precio_paquete)}`;
        }

        const vigencia = document.createElement("td");
        const formatearFecha = fecha =>
          new Intl.DateTimeFormat("es-MX", {
            timeZone: "America/Mexico_City",
            dateStyle: "short",
            timeStyle: "short"
          }).format(new Date(fecha));

        vigencia.textContent =
          `${formatearFecha(promo.inicio)} — ${formatearFecha(promo.fin)}`;

        const estado = document.createElement("td");
        const ahora = Date.now();
        const inicio = new Date(promo.inicio).getTime();
        const fin = new Date(promo.fin).getTime();

        if (!promo.habilitada) {
          estado.textContent = "Desactivada";
        } else if (ahora < inicio) {
          estado.textContent = "Programada";
        } else if (ahora >= fin) {
          estado.textContent = "Finalizada";
        } else {
          estado.textContent = "Activa";
        }

        const acciones = document.createElement("td");
        const boton = document.createElement("button");

        boton.type = "button";
        boton.textContent = promo.habilitada
          ? "Desactivar"
          : "Activar";

        boton.style.background = promo.habilitada
          ? "#dc3545"
          : "#28a745";
        boton.style.color = "#fff";
        boton.style.padding = "8px 12px";
        boton.style.border = "none";
        boton.style.borderRadius = "7px";
        boton.style.cursor = "pointer";

        boton.addEventListener("click", async () => {
          const nuevoEstado = !promo.habilitada;

          const confirmar = confirm(
            `¿Deseas ${nuevoEstado ? "activar" : "desactivar"} ` +
            `la promoción "${promo.nombre}"?`
          );

          if (!confirmar) return;

          boton.disabled = true;

          try {
            await solicitar(
              `/admin/promociones/${promo.id}/estado`,
              {
                method: "PATCH",
                body: JSON.stringify({
                  habilitada: nuevoEstado
                })
              }
            );

            mostrarMensaje("Estado actualizado correctamente.");
            await cargarPromociones();
          } catch (error) {
            mostrarMensaje(error.message, true);
            boton.disabled = false;
          }
        });

        acciones.appendChild(boton);

        fila.append(
          nombre, detalle, vigencia, estado, acciones
        );

        tabla.appendChild(fila);
      }
    } catch (error) {
      tabla.replaceChildren();
      mostrarMensaje(error.message, true);
    }
  }

  formulario.addEventListener("submit", async evento => {
    evento.preventDefault();

    botonGuardar.disabled = true;
    mostrarMensaje("Guardando promoción...");

    try {
      const datos = {
        nombre: document.getElementById("promoNombre").value.trim(),
        tipo: tipo.value,
        inicio: fechaMexicoAISO(
          document.getElementById("promoInicio").value
        ),
        fin: fechaMexicoAISO(
          document.getElementById("promoFin").value
        )
      };

      if (datos.tipo === "porcentaje") {
        datos.descuento =
          Number(document.getElementById("promoDescuento").value);

        datos.cantidad_min =
          Number(document.getElementById("promoCantidadMin").value);
      } else {
        datos.cantidad_paquete =
          Number(document.getElementById("promoCantidadPaquete").value);

        datos.precio_paquete =
          Number(document.getElementById("promoPrecioPaquete").value);
      }

      if (new Date(datos.fin) <= new Date(datos.inicio)) {
        throw new Error(
          "La fecha de finalización debe ser posterior al inicio."
        );
      }

      await solicitar("/admin/promociones", {
        method: "POST",
        body: JSON.stringify(datos)
      });

      formulario.reset();
      actualizarCampos();
      mostrarMensaje("🎉 Promoción guardada correctamente.");
      await cargarPromociones();

    } catch (error) {
      mostrarMensaje(error.message, true);
    } finally {
      botonGuardar.disabled = false;
    }
  });

  cargarPromociones();
});
