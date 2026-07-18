const jornadaSelect = document.getElementById("jornadaSelect");
const tabla = document.getElementById("tablaQuinielas");
const buscador = document.getElementById("buscar");

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

const costoQuiniela = 50; // cambia este valor si el costo cambia

document.getElementById("totalParticipantes").textContent = total;

document.getElementById("totalPagados").textContent = pagados;

document.getElementById("totalPendientes").textContent = pendientes;

document.getElementById("totalRecaudado").textContent =
"$" + (pagados * costoQuiniela).toLocaleString("es-MX");

        data.quinielas.forEach(q => {

            const fila = document.createElement("tr");

            const fecha = new Date(q.fecha_envio);

            const estado = q.estado_pago.trim().toLowerCase();

            fila.innerHTML = `
    <td>${q.nombre}</td>

    <td>${q.telefono}</td>

    <td>${fecha.toLocaleString("es-MX")}</td>

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

    if (!confirm(`¿Deseas ${accion} la quiniela de ${q.nombre}?`)) {
        return;
    }

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

            cargarQuinielas(jornada);

        }else{

            alert(resultado.error);

        }

    }catch(error){

        console.error(error);

        alert("Error al cambiar el estado.");

    }

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

cargarJornadas();