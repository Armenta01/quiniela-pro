// ==============================
// MODAL DE CONFIRMACIÓN
// ==============================

function mostrarConfirmacion(titulo, mensaje){

    return new Promise((resolve)=>{

        const modal = document.getElementById("modalPersonalizado");

        const icono = document.getElementById("modalIcono");

        const tituloModal = document.getElementById("modalTitulo");

        const mensajeModal = document.getElementById("modalMensaje");

        const btnAceptar = document.getElementById("btnAceptar");

        const btnCancelar = document.getElementById("btnCancelar");

        icono.innerHTML = "🗑️";

        tituloModal.innerHTML = titulo;

        mensajeModal.innerHTML = mensaje;

        modal.classList.add("activo");

        btnAceptar.onclick = () => {

            modal.classList.remove("activo");

            resolve(true);

        };

        btnCancelar.onclick = () => {

            modal.classList.remove("activo");

            resolve(false);

        };

    });

}

// ==============================
// MODAL DE MENSAJE
// ==============================

function mostrarMensaje(titulo, mensaje, icono = "⚠️") {

    const modal = document.getElementById("modalPersonalizado");

    const modalIcono = document.getElementById("modalIcono");

    const modalTitulo = document.getElementById("modalTitulo");

    const modalMensaje = document.getElementById("modalMensaje");

    const btnAceptar = document.getElementById("btnAceptar");

    const btnCancelar = document.getElementById("btnCancelar");

    modalIcono.innerHTML = icono;

    modalIcono.className = "modal-icono";

    if (icono === "❌" || icono === "🚫") {

        modalIcono.classList.add("error");

    } else if (icono === "⚠️") {

        modalIcono.classList.add("warning");

    } else if (icono === "✅") {

        modalIcono.classList.add("success");

    } else {

        modalIcono.classList.add("info");

    }

    modalTitulo.innerHTML = titulo;

    modalMensaje.innerHTML = mensaje;

    btnCancelar.style.display = "none";

    modal.classList.add("activo");

    btnAceptar.onclick = () => {

        modal.classList.remove("activo");

        btnCancelar.style.display = "inline-block";

    };

}

// ==============================
// TOAST
// ==============================

function mostrarToast(texto, icono = "✅") {

    const toast = document.getElementById("toast");

    const toastTexto = document.getElementById("toastTexto");

    const toastIcono = document.getElementById("toastIcono");

    toastTexto.innerHTML = texto;

    toastIcono.innerHTML = icono;

    toast.classList.add("mostrar");

    setTimeout(() => {

        toast.classList.remove("mostrar");

    }, 3000);

}