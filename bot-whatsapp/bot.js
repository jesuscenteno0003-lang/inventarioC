const https = require('https');

const SB_URL = process.env.SUPABASE_URL || 'https://nmrquawcyypsjvmiwond.supabase.co';
const SB_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tcnF1YXdjeXlwc2p2bWl3b25kIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTkzMTQxMCwiZXhwIjoyMDk1NTA3NDEwfQ.9Iq25JA9dJe2So8SPEqE8Pdztx8b-FrTQJoZnXcWHKA';
const WA_PHONE_ID = process.env.WA_PHONE_ID || '1172448289281830';
const WA_TOKEN = process.env.WA_TOKEN || 'EAAd5rLfwwrABRoAu4ujJbeb7oDIu9ZALK9hn96MGKAPhx8txMJagD7uIOZBNZACZCTpoSbOSxdHkzzWBPKm4ceqCKrZAMT1suLdaXPgexEu17hEZArhs5eZCI1ZClRZBKedUGME5Ri4YZBZBGEoPM14hHgQiG9wMMvFZCmZCPh8oh0jqMeXShtiL43nC9T8Xtw71kcR474VfTsimCHL3AisuTpl5XwhX3hZAGGeZCeZC14zImRZBSJp3svMm34oI0NpvE0EoukOr8dt3WbHNeumhKwbak9q2odgZDZD';
const BOT_NAME = 'El Zerrano';

function sb(query) {
  return new Promise((resolve) => {
    const opts = {
      hostname: SB_URL.replace('https://', ''),
      path: '/rest/v1/' + query,
      headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY }
    };
    https.get(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d ? JSON.parse(d) : null));
    }).on('error', e => { console.error('SB error:', e.message); resolve(null); });
  });
}

function enviarWhatsApp(telefono, mensaje) {
  return new Promise((resolve) => {
    const data = JSON.stringify({
      messaging_product: 'whatsapp',
      to: telefono,
      type: 'text',
      text: { body: mensaje }
    });
    const opts = {
      hostname: 'graph.facebook.com',
      path: '/v22.0/' + WA_PHONE_ID + '/messages',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + WA_TOKEN,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log('✓ WhatsApp enviado a', telefono);
        } else {
          console.error('✗ Error WhatsApp:', res.statusCode, d);
        }
        resolve();
      });
    });
    req.on('error', e => { console.error('✗ Error conexión WhatsApp:', e.message); resolve(); });
    req.write(data);
    req.end();
  });
}

async function verificarHoy() {
  console.log('🔍 Verificando movimientos del día...');
  const hoy = new Date();
  const inicio = hoy.toISOString().split('T')[0] + 'T00:00:00';
  const movs = await sb('movimientos?select=id&fecha=gte.' + encodeURIComponent(inicio) + '&limit=1');
  const hayMovimientos = movs && movs.length > 0;

  if (hayMovimientos) {
    console.log('✅ Hay movimientos hoy, no se envía recordatorio');
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
    await enviarWhatsApp(tel,
      '¡Hola! Soy *' + BOT_NAME + '*, tu ayudante del inventario 🍳\n\n' +
      'Hoy no se registraron movimientos en el inventario.\n' +
      'Recuerda siempre mantener actualizado tus productos para mejorar cada día.\n\n' +
      '¡Gracias por tu compromiso! 🙌'
    );
    // Esperar 2 segundos entre mensajes para evitar rate limiting
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log('✅ Recordatorios enviados');
}

function programarVerificacion() {
  const ahora = new Date();
  const hora = 18 + Math.floor(Math.random() * 4);
  const min = Math.floor(Math.random() * 60);
  const target = new Date(ahora);
  target.setHours(hora, min, 0, 0);
  if (target <= ahora) target.setDate(target.getDate() + 1);
  const ms = target - ahora;
  console.log('⏰ Próxima verificación: ' + target.toLocaleString('es-CL'));
  setTimeout(async () => {
    await verificarHoy();
    programarVerificacion();
  }, ms);
}

console.log('🤖 ' + BOT_NAME + ' iniciado');
programarVerificacion();
