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

        lista.innerHTML += `

        <div class="card">

            <div class="nombre">
                👤 ${u.nombre}
            </div>

            <div class="telefono">
                📱 ${u.telefono}
            </div>

            <button
                onclick="enviarWhatsApp('${u.nombre}','${u.telefono}')">

                📲 WhatsApp

            </button>

        </div>

        `;

    });

}

function enviarWhatsApp(nombre, telefono){

    const mensaje =
`Hola ${nombre} 👋

🏆 Ya está disponible la nueva jornada de Quinielas El Inge.

⏰ Recuerda enviar tu quiniela antes del cierre.

👉 https://quinielasinge.com`;

    const url =
`https://wa.me/52${telefono}?text=${encodeURIComponent(mensaje)}`;

    window.open(url,'_blank');

}

cargarRecordatorios();