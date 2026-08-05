function copiarTexto(texto, boton) {

    navigator.clipboard.writeText(texto);

    const textoOriginal = boton.innerHTML;

    boton.innerHTML = "✅ Copiado";

    boton.disabled = true;

    setTimeout(() => {

        boton.innerHTML = textoOriginal;

        boton.disabled = false;

    }, 2000);

}

// BanCoppel
function copiarBanCoppel() {

    const datos =
`Tarjeta:
4169160609738225

CLABE:
137593105314456900`;

    copiarTexto(datos, event.target);

}

// Mercado Pago
function copiarMercadoPago() {

    const datos =
`Tarjeta:
7229690103212869`;

    copiarTexto(datos, event.target);

}

// Enviar comprobante
document
.getElementById("btnEnviarComprobante")
.addEventListener("click", () => {

    window.open(
        "https://wa.me/524531336012",
        "_blank"
    );

});