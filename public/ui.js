

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
// PASSWORD
// ==============================

function mostrarPassword(titulo,mensaje){

return new Promise((resolve)=>{

const modal=document.getElementById("modalPersonalizado");

const icono=document.getElementById("modalIcono");

const tituloModal=document.getElementById("modalTitulo");

const mensajeModal=document.getElementById("modalMensaje");

const input=document.getElementById("modalInput");

const btnAceptar=document.getElementById("btnAceptar");

const btnCancelar=document.getElementById("btnCancelar");

icono.innerHTML="🔐";

icono.className="modal-icono info";

tituloModal.innerHTML=titulo;

mensajeModal.innerHTML=mensaje;

input.value="";

input.style.display="block";

btnCancelar.style.display="inline-block";

modal.classList.add("activo");

input.focus();

btnAceptar.onclick=()=>{

const valor=input.value;

modal.classList.remove("activo");

input.style.display="none";

resolve(valor);

};

btnCancelar.onclick=()=>{

modal.classList.remove("activo");

input.style.display="none";

resolve(null);

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

    if (!toast || !toastTexto || !toastIcono) {
        console.error("No existe el toast en el HTML.");
        return;
    }

    toastTexto.textContent = texto;
    toastIcono.textContent = icono;

    toast.classList.add("mostrar");

    setTimeout(() => {
        toast.classList.remove("mostrar");
    }, 3000);

}