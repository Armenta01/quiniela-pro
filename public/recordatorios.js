async function cargarRecordatorios(){

    // Obtener la jornada actual
    const j = await fetch('/jornada-actual');
    const jornada = (await j.json()).jornada;

    // Obtener pendientes
    const r = await fetch(`/recordatorios?jornada=${jornada}`);
    const usuarios = await r.json();

    document.getElementById("cantidad").innerHTML =
        `Pendientes: <strong>${usuarios.length}</strong>`;

    const lista = document.getElementById("lista");

    lista.innerHTML = "";

    usuarios.forEach(u=>{

    const textoBoton =
        u.recordatorio_enviado
        ? "✅ Enviado"
        : "📲 WhatsApp";

    const fechaEnvio =
        u.fecha_recordatorio
        ? new Date(u.fecha_recordatorio).toLocaleString('es-MX')
        : "";

    const deshabilitado =
        u.recordatorio_enviado
        ? "disabled"
        : "";

    const color =
        u.recordatorio_enviado
        ? "#64748b"
        : "#22c55e";

    lista.innerHTML += `

<div class="card">

    <div class="nombre">
        👤 ${u.nombre}
    </div>

    <div class="telefono">
        📱 ${u.telefono}
    </div>

    <button
        id="btn-${u.id}"
        style="background:${color}"
        ${deshabilitado}
        onclick="enviarWhatsApp(${u.id},'${u.nombre}','${u.telefono}')">

        ${textoBoton}

    </button>

    ${
        u.recordatorio_enviado
        ? `<div class="fecha-recordatorio">
             🕒 ${fechaEnvio}
           </div>`
        : `<div class="estado-pendiente">
             🟢 Pendiente
           </div>`
    }

</div>

`;
});

}

function enviarWhatsApp(id, nombre, telefono){

    const mensaje =
`👋 Hola *${nombre}*.

🏆 Ya está disponible una nueva jornada de *Quinielas El Inge*.

⏰ *Recuerda que cierra hoy*

💰 ¡No te quedes fuera de la oportunidad de ganar!

📲 *Registra tus pronósticos aquí:*

https://quinielasinge.com 

🍀 *¡Mucho éxito!*`;

    const url =
`https://wa.me/52${telefono}?text=${encodeURIComponent(mensaje)}`;

fetch('/recordatorio/enviado', {

    method: 'POST',

    headers:{
        'Content-Type':'application/json'
    },

    body: JSON.stringify({
        id:id
    })

});

    window.open(url,'_blank');

    const boton = document.getElementById(`btn-${id}`);

    boton.innerHTML = "✅ Enviado";

    boton.style.background = "#64748b";

    boton.disabled = true;

}

cargarRecordatorios();

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