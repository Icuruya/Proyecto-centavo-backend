const express = require('express');
const app = express();
app.use(express.json()); // Middleware para entender JSON

// Ruta principal para verificar que el servidor está vivo
app.get('/', (req, res) => {
  res.send('Servidor del Proyecto Centavo está activo y listo para trabajar!');
});

// Ruta que llamará Make.com para calcular el plan de pago
app.post('/plan-pago', (req, res) => {
    // Obtenemos los datos que envía Make.com
    const { cuentas, deudas, monto_disponible_usuario, sobrante_deseado_usuario } = req.body;

    // --- INICIO DE LA LÓGICA DEL PLAN DE PAGO ---

    // 1. CALCULAR DINERO DISPONIBLE
    let totalLiquido = 0;
    for (const cuenta of cuentas) {
        totalLiquido += parseFloat(cuenta['Saldo (B)']);
    }

    const montoDisponible = parseFloat(monto_disponible_usuario) || totalLiquido;
    const sobranteDeseado = parseFloat(sobrante_deseado_usuario) || 0;
    let dineroParaPagos = montoDisponible - sobranteDeseado;

    // 2. PREPARAR DATOS DE TARJETAS Y CALCULAR INTERESES
    const hoy = new Date();
    let interesesCalculados = 0;
    const tarjetas = deudas.map(d => {
        const tarjeta = {
            nombre: d['Nombre_Tarjeta (A)'],
            deuda: parseFloat(d['Deuda_Total (B)']),
            fechaLimite: new Date(d['Fecha_Pago_Limite (C)']),
            tasaAnual: parseFloat(d['Tasa_Interes_Anual_Porcentaje (D)']),
            pagoMinimo: parseFloat(d['Pago_Minimo_Estimado (E)']),
            conIntereses: d['Deuda_Con_Intereses (F)'] === 'TRUE'
        };

        if (tarjeta.fechaLimite < hoy && !tarjeta.conIntereses) {
            const interesMensual = tarjeta.deuda * (tarjeta.tasaAnual / 100 / 12);
            tarjeta.deuda += interesMensual;
            interesesCalculados += interesMensual;
        }
        return tarjeta;
    }).filter(t => t.deuda > 0);

    // 3. GENERAR PLAN DE PAGO (MÉTODO AVALANCHA)
    tarjetas.sort((a, b) => b.tasaAnual - a.tasaAnual);

    const planDePago = {};
    
    // Pagar mínimos primero
    for (const tarjeta of tarjetas) {
        const pago = Math.min(tarjeta.deuda, tarjeta.pagoMinimo);
        if (dineroParaPagos >= pago) {
            planDePago[tarjeta.nombre] = (planDePago[tarjeta.nombre] || 0) + pago;
            dineroParaPagos -= pago;
            tarjeta.deuda -= pago;
        }
    }

    // Pagar extra a la de mayor tasa
    for (const tarjeta of tarjetas) {
        if (dineroParaPagos > 0 && tarjeta.deuda > 0) {
            const pagoExtra = Math.min(dineroParaPagos, tarjeta.deuda);
            planDePago[tarjeta.nombre] = (planDePago[tarjeta.nombre] || 0) + pagoExtra;
            dineroParaPagos -= pagoExtra;
            tarjeta.deuda -= pagoExtra;
        }
    }

    // 4. CONSTRUIR EL MENSAJE DE RESPUESTA
    let mensaje = `💡 *PLAN DE PAGO INTELIGENTE*\n\n`;
    mensaje += `*Dinero disponible para pagos:* $${(montoDisponible - sobranteDeseado).toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}\n\n`;

    if (interesesCalculados > 0) {
        mensaje += `⚠️ *Se calcularon intereses por mora por un total de: $${interesesCalculados.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}*\n\n`;
    }

    mensaje += `*Plan recomendado:*\n`;
    for (const nombre in planDePago) {
        mensaje += `*💳 ${nombre}:* Pagar *$${planDePago[nombre].toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}*\n`;
    }

    if (Object.keys(planDePago).length === 0) {
        mensaje += `¡Felicidades! No tienes deudas que pagar.\n`;
    }
    
    if (dineroParaPagos > 0) {
        mensaje += `\n*Sobrante después de pagos:* $${dineroParaPagos.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    }

    // --- FIN DE LA LÓGICA DEL PLAN DE PAGO ---

    // Devolvemos la respuesta a Make.com
    res.json({ textoRespuesta: mensaje });
});

// Iniciar el servidor
app.listen(3000, () => {
  console.log('Servidor escuchando en el puerto 3000');
});
