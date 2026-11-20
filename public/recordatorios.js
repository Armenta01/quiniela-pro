let modoSeleccion = false;

let seleccionados = [];

async function cargarRecordatorios(){

    // Obtener jornada
    const j = await fetch('/jornada-actual');
    const jornada = (await j.json()).jornada;

    // Obtener participantes
    const r = await fetch(`/recordatorios?jornada=${jornada}`);
    const usuarios = await r.json();

    document.getElementById("cantidad").innerHTML =
        `Pendientes: <strong>${usuarios.length}</strong>`;

    const lista = document.getElementById("lista");

    lista.innerHTML = "";

    usuarios.forEach(u=>{

        const card = document.createElement("div");

        card.className = "card";

        card.dataset.id = u.id;

        const textoBoton =
            u.recordatorio_enviado
            ? "✅ Enviado"
            : "📲 WhatsApp";

        const color =
            u.recordatorio_enviado
            ? "#64748b"
            : "#22c55e";

        const fecha =
            u.fecha_recordatorio
            ? new Date(u.fecha_recordatorio).toLocaleString("es-MX")
            : "";
            
            card.innerHTML = `

<div class="nombre">
👤 ${u.nombre}
</div>

<div class="telefono">
📱 ${u.telefono}
</div>

<button
id="btn-${u.id}"
style="background:${color}"
${u.recordatorio_enviado ? "disabled" : ""}
>

${textoBoton}

</button>

${
u.recordatorio_enviado
?
`<div class="fecha-recordatorio">
🕒 ${fecha}
</div>`
:
`<div class="estado-pendiente">
🟢 Pendiente
</div>`
}

`;


        // BOTÓN WHATSAPP
        const boton = card.querySelector("button");

        boton.onclick = ()=>{

            enviarWhatsApp(
                u.id,
                u.nombre,
                u.telefono
            );

        };

        // --------- SELECCIÓN ---------

        let timer;

        card.addEventListener("mousedown",()=>{

            timer = setTimeout(()=>{

                modoSeleccion = true;

                seleccionar(card,u.id);

            },500);

        });

        card.addEventListener("mouseup",()=>{

            clearTimeout(timer);

        });

        card.addEventListener("mouseleave",()=>{

            clearTimeout(timer);

        });

        card.addEventListener("touchstart",()=>{

            timer = setTimeout(()=>{

                modoSeleccion = true;

                seleccionar(card,u.id);

            },500);

        });

        card.addEventListener("touchend",()=>{

            clearTimeout(timer);

        });

        card.addEventListener("click",(e)=>{

            if(!modoSeleccion) return;

            if(e.target.tagName==="BUTTON") return;

            seleccionar(card,u.id);

        });

        lista.appendChild(card);


    });



}

async function enviarWhatsApp(id, nombre, telefono) {
    // ⏰ OBTENER HORA DE CIERRE AUTOMÁTICAMENTE
    let textoCierre = "⏰ *Recuerda enviar tu quiniela a tiempo*";

    try {

        const respuestaJornada = await fetch("/jornada-actual");

        if (!respuestaJornada.ok) {
            throw new Error("Error consultando jornada");
        }

        const datosJornada = await respuestaJornada.json();

        const respuestaLimite = await fetch(
            `/limite?jornada=${encodeURIComponent(datosJornada.jornada)}`,
            { cache: "no-store" }
        );

        if (!respuestaLimite.ok) {
            throw new Error("Error consultando cierre");
        }

        const datosLimite = await respuestaLimite.json();

        if (datosLimite.limite) {

            const cierre = new Date(datosLimite.limite);

            if (!Number.isNaN(cierre.getTime())) {

                const opcionesHora = {
                    timeZone: "America/Mexico_City",
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true
                };

                const hora = cierre.toLocaleTimeString(
                    "es-MX",
                    opcionesHora
                );

                const fechaCierre = cierre.toLocaleDateString(
                    "en-CA",
                    { timeZone: "America/Mexico_City" }
                );

                const fechaHoy = new Date().toLocaleDateString(
                    "en-CA",
                    { timeZone: "America/Mexico_City" }
                );

                const fechaTexto = cierre.toLocaleDateString(
                    "es-MX",
                    {
                        timeZone: "America/Mexico_City",
                        day: "numeric",
                        month: "long"
                    }
                );

                if (datosLimite.bloqueada) {

                    textoCierre =
                        "⏰ *El registro de esta jornada ya cerró*";

                } else if (fechaCierre === fechaHoy) {

                    textoCierre =
                        `⏰ *Recuerda que cierra hoy a las ${hora}*`;

                } else {

                    textoCierre =
                        `⏰ *Recuerda que cierra el ${fechaTexto} a las ${hora}*`;

                }
            }
        }

    } catch (error) {

        console.error("Error obteniendo hora de cierre:", error);

    }

    const mensajeNormal =
`👋 Hola *${nombre}*.

🏆 Ya está disponible una nueva jornada de *Quinielas El Inge*.

${textoCierre}

💰 ¡No te quedes fuera de la oportunidad de ganar!

📲 *Registra tus pronósticos aquí:*

https://quinielasinge.com

🍀 *¡Mucho éxito!*`;

    let mensaje = mensajeNormal;

    try {

        const respuesta = await fetch("/promociones/activas", {
            cache: "no-store"
        });

        if (!respuesta.ok) {
            throw new Error("No se pudieron consultar las promociones");
        }

        const promociones = await respuesta.json();

        if (Array.isArray(promociones) && promociones.length > 0) {

            const moneda = valor =>
                Number(valor).toLocaleString("es-MX", {
                    style: "currency",
                    currency: "MXN",
                    maximumFractionDigits: 2
                });

            const detalles = [];

            for (const promo of promociones) {

                let detalle = "";

                if (
                    promo.tipo === "paquete" &&
                    Number(promo.cantidad_paquete) > 0 &&
                    Number.isFinite(Number(promo.precio_paquete))
                ) {

                    detalle =
`🎟️ *${promo.cantidad_paquete} quinielas por ${moneda(promo.precio_paquete)}*`;

                } else if (
                    promo.tipo === "porcentaje" &&
                    Number(promo.descuento) > 0
                ) {

                    detalle =
`💸 *${promo.descuento}% de descuento*` +
                    (Number(promo.cantidad_min) > 1
                        ? ` al comprar ${promo.cantidad_min} quinielas o más`
                        : "");

                }

                if (detalle) {

                    detalles.push(
`🎁 *${promo.nombre}*
${detalle}`
                    );

                }
            }

            if (detalles.length > 0) {

                const bloquePromociones =
`🔥 *¡PROMOCIÓN ESPECIAL ACTIVA!* 🔥

${detalles.join("\n\n")}

⚡ ¡Aprovecha antes de que termine!`;

                mensaje = mensajeNormal.replace(
                    "💰 ¡No te quedes fuera de la oportunidad de ganar!",
                    bloquePromociones +
                    "\n\n💰 ¡No te quedes fuera de la oportunidad de ganar!"
                );
            }
        }

    } catch (error) {

        console.error("Error consultando promociones:", error);

        // Si falla la consulta, utilizar el mensaje normal.
    }

    const url =
        `https://wa.me/52${telefono}?text=${encodeURIComponent(mensaje)}`;

    const ventana = window.open(url, "_blank");

    if (!ventana) {
        mostrarMensaje(
            "WhatsApp",
            "No se pudo abrir WhatsApp. Permite las ventanas emergentes.",
            "⚠️"
        );
        return;
    }

    try {

        const respuesta = await fetch("/recordatorio/enviado", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({ id })

        });

        if (!respuesta.ok) {
            throw new Error("No se pudo actualizar el recordatorio");
        }

        const boton = document.getElementById(`btn-${id}`);

        if (boton) {
            boton.innerHTML = "✅ Enviado";
            boton.style.background = "#64748b";
            boton.disabled = true;
        }

    } catch (error) {

        console.error("Error marcando recordatorio:", error);

        mostrarToast(
            "WhatsApp abierto, pero no se pudo actualizar el estado.",
            "⚠️"
        );
    }
}


cargarRecordatorios();

function actualizarSeleccion(){

    document.getElementById("contadorSeleccion").innerHTML =
        `${seleccionados.length} seleccionados`;

    document.getElementById("barraSeleccion").style.display =
        seleccionados.length
        ? "flex"
        : "none";

}

function filtrarParticipantes(){

    const texto =
        document.getElementById("buscar")
        .value
        .toLowerCase();

    const tarjetas =
        document.querySelectorAll(".card");

    tarjetas.forEach(card=>{

        const nombre =
            card.querySelector(".nombre")
            .innerText
            .toLowerCase();

        if(nombre.includes(texto)){

            card.style.display="block";

        }else{

            card.style.display="none";

        }

    });

}

async function reiniciarRecordatorios(){

    const confirmar = await mostrarConfirmacion(
        "Reiniciar recordatorios",
        "¿Deseas reiniciar todos los recordatorios para una nueva jornada?"
    );

    if(!confirmar) return;

    try{

        const r = await fetch('/recordatorios/reiniciar',{

            method:'POST'

        });

        const data = await r.json();

        if(data.ok){

            mostrarToast("Recordatorios reiniciados correctamente", "✅");

            cargarRecordatorios();

        }else{

            mostrarMensaje(
                "Error",
                "No fue posible reiniciar los recordatorios.",
                "❌"
            );

        }

    }catch(err){

        console.error(err);

        mostrarMensaje(
            "Error de conexión",
            "No fue posible comunicarse con el servidor.",
            "📡"
        );

    }

}

function seleccionar(card,id){

    if(seleccionados.includes(id)){

        seleccionados =
            seleccionados.filter(x=>x!==id);

        card.style.border="none";

    }else{

        seleccionados.push(id);

        card.style.border="4px solid #22c55e";

    }

    actualizarSeleccion();

}

function cancelarSeleccion(){

    modoSeleccion = false;

    seleccionados = [];

    document
        .querySelectorAll(".card")
        .forEach(card=>{

            card.style.border = "none";

        });

    actualizarSeleccion();

}

document.getElementById("btnQuitarSeleccion")
.addEventListener("click", async ()=>{

    if(seleccionados.length===0) return;

    const ok = await mostrarConfirmacion(
        "Quitar participantes",
        `¿Deseas quitar ${seleccionados.length} participante(s) de Recordatorios?`
    );

    if(!ok) return;

    const r = await fetch("/recordatorios/quitar",{

        method:"POST",

        headers:{
            "Content-Type":"application/json"
        },

        body:JSON.stringify({

            ids: seleccionados

        })

    });

    const data = await r.json();

    if(data.ok){

        mostrarToast(
            "Participantes quitados.",
            "✅"
        );

        cancelarSeleccion();

        cargarRecordatorios();

    }else{

        mostrarMensaje(
            "Error",
            data.error,
            "❌"
        );

    }

});

document.getElementById("btnEliminarSeleccion")
.addEventListener("click", async ()=>{

    if(seleccionados.length === 0) return;

    const ok = await mostrarConfirmacion(
        "Eliminar participantes",
        `¿Eliminar definitivamente ${seleccionados.length} participante(s)?\n\nTambién se eliminarán sus quinielas si existen.\n\nEsta acción no se puede deshacer.`
    );

    if(!ok) return;

    try{

        const r = await fetch("/recordatorios/eliminar",{

            method:"POST",

            headers:{
                "Content-Type":"application/json"
            },

            body:JSON.stringify({

                ids: seleccionados

            })

        });

        const data = await r.json();

        if(data.ok){

            mostrarToast(
                "Participantes eliminados.",
                "🗑"
            );

            cancelarSeleccion();

            cargarRecordatorios();

        }else{

            mostrarMensaje(
                "Error",
                data.error,
                "❌"
            );

        }

    }catch(err){

        console.error(err);

        mostrarMensaje(
            "Error",
            "No fue posible eliminar.",
            "❌"
        );

    }

});