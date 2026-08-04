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