const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const SB_URL = process.env.SUPABASE_URL || 'https://nmrquawcyypsjvmiwond.supabase.co';
const SB_KEY = process.env.SUPABASE_KEY || 'sb_publishable_iTgqTzfSyjkC4g85-UrubA_GGMp3RDy';
const BOT_NAME = 'El Zerrano';
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT || './data';

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: DATA_DIR + '/session' }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }
});

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    console.log('📱 Escanea este QR con WhatsApp para activar ' + BOT_NAME);
});

client.on('ready', () => {
    console.log('✅ ' + BOT_NAME + ' conectado');
    programarVerificacion();
});

async function sb(query) {
    try {
        const res = await fetch(SB_URL + '/rest/v1/' + query, {
            headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY }
        });
        if (!res.ok) { const t = await res.text(); console.error('SB error:', t); return null; }
        return await res.json();
    } catch (e) {
        console.error('Error Supabase:', e.message);
        return null;
    }
}

async function verificarHoy() {
    const hoy = new Date();
    const inicio = hoy.toISOString().split('T')[0] + 'T00:00:00';

    const movs = await sb('movimientos?select=id&fecha=gte.' + encodeURIComponent(inicio) + '&limit=1');
    const sinMovimientos = !movs || movs.length === 0;

    if (!sinMovimientos) {
        console.log('✅ Ya hay movimientos hoy, no se envía recordatorio');
        return;
    }

    console.log('❌ Sin movimientos hoy, enviando recordatorios...');
    const usuarios = await sb('usuarios?select=nombre,telefono&activo=eq.true&telefono=not.is.null');
    if (!usuarios || usuarios.length === 0) {
        console.log('No hay usuarios con teléfono');
        return;
    }

    for (const u of usuarios) {
        let tel = u.telefono.replace(/[^0-9]/g, '');
        if (!tel.startsWith('51')) tel = '51' + tel;
        try {
            await client.sendMessage(tel + '@c.us',
                '¡Hola! Soy *' + BOT_NAME + '*, tu ayudante del inventario 🍳\n\n' +
                'Hoy no se registraron movimientos en el inventario.\n' +
                'Recuerda siempre mantener actualizado tus productos para mejorar cada día.\n\n' +
                '¡Gracias por tu compromiso! 🙌'
            );
            console.log('📨 Mensaje enviado a ' + u.nombre + ' (' + tel + ')');
        } catch (e) {
            console.error('✗ Error enviando a ' + u.nombre + ': ' + e.message);
        }
    }
}

function programarVerificacion() {
    const ahora = new Date();
    const hora = 18 + Math.floor(Math.random() * 4);
    const min = Math.floor(Math.random() * 60);
    const target = new Date(ahora);
    target.setHours(hora, min, 0, 0);
    if (target <= ahora) target.setDate(target.getDate() + 1);
    const ms = target - ahora;
    console.log('⏰ Próxima verificación: ' + target.toLocaleString('es-CL', { hour: '2-digit', minute: '2-digit' }));
    setTimeout(async () => {
        await verificarHoy();
        programarVerificacion();
    }, ms);
}

client.initialize();
