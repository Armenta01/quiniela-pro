const jornadaSelect = document.getElementById("jornadaSelect");
const tabla = document.getElementById("tablaQuinielas");
const buscador = document.getElementById("buscar");

const modal = document.getElementById("modalEstado");
const modalMensaje = document.getElementById("modalMensaje");
const btnConfirmar = document.getElementById("btnConfirmar");
const btnCancelar = document.getElementById("btnCancelar");
let accionPendiente = null;
// ===============================
// CARGAR JORNADAS
// ===============================

async function cargarJornadas() {

    try {

        const resp = await fetch("/admin/jornadas");
        const data = await resp.json();

        jornadaSelect.innerHTML = "";

        data.jornadas.forEach(jornada => {

            const option = document.createElement("option");

            option.value = jornada;
            option.textContent = "Jornada " + jornada;

            jornadaSelect.appendChild(option);

        });

        // Seleccionar automáticamente la jornada más reciente
        if (data.jornadas.length > 0) {

            jornadaSelect.value = data.jornadas[0];

            cargarQuinielas(data.jornadas[0]);

        }

    } catch (error) {

        console.error(error);

    }

}

// ===============================
// CARGAR QUINIELAS
// ===============================

async function cargarQuinielas(jornada){

    try{

        const resp = await fetch(`/admin/estado-quinielas?jornada=${jornada}`);
        const data = await resp.json();

        tabla.innerHTML = "";

        const total = data.quinielas.length;

const pagados = data.quinielas.filter(
    q => q.estado_pago.trim().toLowerCase() === "pagado"
).length;

const pendientes = total - pagados;


const costoQuiniela = 50;

// Evitar sumar varias veces una misma compra.
const comprasContabilizadas = new Set();

let totalRecaudado = 0;

data.quinielas.forEach(q => {

    const estado = String(q.estado_pago || "")
        .trim()
        .toLowerCase();

    if (estado !== "pagado") return;

    if (q.compra_id != null) {

        const compraId = String(q.compra_id);

        if (comprasContabilizadas.has(compraId)) return;

        // Solo contar la compra completa cuando
        // todas sus quinielas estén pagadas.
        const quinielasCompra = data.quinielas.filter(
            item => String(item.compra_id) === compraId
        );

        const cantidadCompra = Number(q.cantidad_compra);

        const compraCompleta =
            quinielasCompra.length === cantidadCompra &&
            quinielasCompra.every(item =>
                String(item.estado_pago || "")
                    .trim()
                    .toLowerCase() === "pagado"
            );

        if (compraCompleta) {
            totalRecaudado += Number(q.precio_final_compra) || 0;
        }

        comprasContabilizadas.add(compraId);

    } else {

        // Quinielas anteriores sin compra vinculada.
        totalRecaudado += costoQuiniela;

    }

});

document.getElementById("totalParticipantes").textContent = total;

document.getElementById("totalPagados").textContent = pagados;

document.getElementById("totalPendientes").textContent = pendientes;

document.getElementById("totalRecaudado").textContent =
    "$" + totalRecaudado.toLocaleString("es-MX", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });


        data.quinielas.forEach(q => {

            const fila = document.createElement("tr");
            

            const fecha = new Date(q.fecha_envio);

            const estado = q.estado_pago.trim().toLowerCase();

            if (estado === "pagado") {

    fila.classList.add("filaPagado");

} else {

    fila.classList.add("filaPendiente");

}


const importeCompra = q.compra_id != null
    ? Number(q.precio_final_compra)
    : 50;

const importeTexto = Number.isFinite(importeCompra)
    ? "$" + importeCompra.toLocaleString("es-MX", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    })
    : "No disponible";

const detalleImporte = q.compra_id != null
    ? `${importeTexto} (compra de ${q.cantidad_compra} quiniela(s))`
    : importeTexto;


            fila.innerHTML = `
    <td>${q.nombre}</td>

    <td>${q.telefono}</td>

    <td>${fecha.toLocaleString("es-MX")}</td>

    <td>${detalleImporte}</td>

    <td>
        <span class="estado ${estado}">
           ${q.estado_pago}
        </span>
    </td>

    <td>

        <button

                class="btnEstado ${estado === "pendiente" ? "btnPagado" : "btnPendiente"}"
                data-envio="${q.envio_id}"
        >

            ${estado === "pendiente"
                ? "✔ Marcar pagado"
                : "↩ Marcar pendiente"}

        </button>

    </td>
`;

            tabla.appendChild(fila);

            const boton = fila.querySelector(".btnEstado");

boton.addEventListener("click", async () => {

    const accion =
    estado === "pendiente"
        ? "marcar como PAGADO"
        : "marcar como PENDIENTE";


const esCompraMultiple =
    q.compra_id != null &&
    Number(q.cantidad_compra) > 1;

if (esCompraMultiple) {

    const importe = Number(q.precio_final_compra);

    const importeFormateado = importe.toLocaleString("es-MX", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });

    modalMensaje.textContent =
        `¿Deseas ${accion} la compra completa de ${q.nombre}?\n\n` +
        `🎟️ Quinielas: ${q.cantidad_compra}\n` +
        `💰 Importe total: $${importeFormateado} MXN\n\n` +
        `Este cambio afectará a todas las quinielas de esta compra.`;

} else {

    modalMensaje.textContent =
        `¿Deseas ${accion} la quiniela de ${q.nombre}?`;

}

modal.style.display = "flex";

accionPendiente = async () => {

    try{

        const resp = await fetch("/admin/cambiar-estado",{

            method:"POST",

            headers:{
                "Content-Type":"application/json"
            },

            body:JSON.stringify({

                envio_id:q.envio_id

            })

        });

        const resultado = await resp.json();

        if(resultado.ok){

            modal.style.display = "none";

            cargarQuinielas(jornada);

        }else{

            alert(resultado.error);

        }

    }catch(error){

        console.error(error);

        alert("Error al cambiar el estado.");

    }

};

return;

});

        });

    }catch(error){

        console.error(error);

    }

}

// ===============================

jornadaSelect.addEventListener("change",()=>{

    cargarQuinielas(jornadaSelect.value);

});

buscador.addEventListener("keyup",()=>{

    const texto = buscador.value.toLowerCase();

    const filas = tabla.querySelectorAll("tr");

    filas.forEach(fila=>{

        const contenido = fila.innerText.toLowerCase();

        fila.style.display =
            contenido.includes(texto)
                ? ""
                : "none";

    });

});

btnCancelar.addEventListener("click", () => {

    modal.style.display = "none";

});

btnConfirmar.addEventListener("click", async () => {

    if (accionPendiente) {

        await accionPendiente();

        accionPendiente = null;

    }

});

cargarJornadas();