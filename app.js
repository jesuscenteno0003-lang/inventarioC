// ============================================================
// Inventario Cocina - PWA con Supabase REST API directa
// ============================================================

const SB_URL = 'https://nmrquawcyypsjvmiwond.supabase.co';
const SB_KEY = 'sb_publishable_iTgqTzfSyjkC4g85-UrubA_GGMp3RDy';

let chartConsumo = null;
let areaActual = localStorage.getItem('areaActual') || 'Calientes';

// Helper: fetch Supabase REST API
async function sb(table, method = 'GET', body = null, params = '') {
    const url = `${SB_URL}/rest/v1/${table}${params}`;
    const headers = {
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`
    };
    const opts = { method, headers };

    if (body) {
        headers['Content-Type'] = 'application/json';
        headers['Prefer'] = 'return=representation';
        opts.body = JSON.stringify(body);
    }

    try {
        const res = await fetch(url, opts);
        const text = await res.text();
        if (!res.ok) {
            console.error('Supabase error:', res.status, text);
            throw new Error(JSON.parse(text).message || JSON.parse(text).hint || `Error ${res.status}`);
        }
        return text ? JSON.parse(text) : null;
    } catch (err) {
        console.error('Fetch error:', err);
        throw err;
    }
}

// ============================================================
// Gráfico de Consumo
// ============================================================
function initChart() {
    const ctx = document.getElementById('chart-consumo');
    if (!ctx) return;

    const labels = [];
    const hoy = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(hoy);
        d.setDate(d.getDate() - i);
        labels.push(d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric' }));
    }

    chartConsumo = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Entradas',
                    data: [0, 0, 0, 0, 0, 0, 0],
                    backgroundColor: 'rgba(232, 168, 56, 0.7)',
                    borderColor: '#e8a838',
                    borderWidth: 2,
                    borderRadius: 4
                },
                {
                    label: 'Salidas',
                    data: [0, 0, 0, 0, 0, 0, 0],
                    backgroundColor: 'rgba(231, 76, 60, 0.7)',
                    borderColor: '#e74c3c',
                    borderWidth: 2,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#8888aa', font: { size: 10 } }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#8888aa', font: { size: 10 } }
                }
            }
        }
    });
}

async function actualizarChart() {
    if (!chartConsumo) return;

    const movimientos = await sb('movimientos', 'GET', null, `?select=tipo,cantidad,fecha&productos.area=eq.${areaActual}`);
    if (!movimientos || movimientos.length === 0) return;

    const hoy = new Date();
    const dias = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(hoy);
        d.setDate(d.getDate() - i);
        dias.push(d.toLocaleDateString('es-CL'));
    }

    const entradas = [0, 0, 0, 0, 0, 0, 0];
    const salidas = [0, 0, 0, 0, 0, 0, 0];

    movimientos.forEach(m => {
        const fechaStr = (m.fecha || '').split(',')[0].split(' ')[0].trim();
        const idx = dias.indexOf(fechaStr);
        if (idx !== -1) {
            if (m.tipo === 'Entrada') {
                entradas[idx] += parseFloat(m.cantidad) || 0;
            } else {
                salidas[idx] += parseFloat(m.cantidad) || 0;
            }
        }
    });

    chartConsumo.data.datasets[0].data = entradas;
    chartConsumo.data.datasets[1].data = salidas;
    chartConsumo.update('none');
}

// ============================================================
// Notificaciones
// ============================================================
async function pedirPermisoNotificacion() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;

    const permiso = await Notification.requestPermission();
    return permiso === 'granted';
}

function enviarNotificacion(titulo, cuerpo, icono = null) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    try {
        const opciones = { body: cuerpo, tag: 'inventario-stock' };
        if (icono) opciones.icon = icono;
        new Notification(titulo, opciones);
    } catch (e) {
        // fallback silencioso
    }
}

async function verificarStockBajoNotificar() {
    const productos = await sb('productos');
    if (!productos) return;

    const stockBajo = productos.filter(p => p.stock_actual <= p.stock_minimo);
    const yaNotificados = JSON.parse(localStorage.getItem('notificados') || '{}');
    const ahora = Date.now();
    const nuevos = [];

    stockBajo.forEach(p => {
        const ultimaNotif = yaNotificados[p.id] || 0;
        if (ahora - ultimaNotif > 3600000) {
            nuevos.push(p);
            yaNotificados[p.id] = ahora;
        }
    });

    if (nuevos.length > 0) {
        const nombres = nuevos.map(p => `${p.nombre} (${p.stock_actual} ${p.unidad})`).join(', ');
        enviarNotificacion(
            `⚠️ ${nuevos.length} producto(s) con stock bajo`,
            nombres
        );
        localStorage.setItem('notificados', JSON.stringify(yaNotificados));
    }
}

// ============================================================
// Cambiar Área
// ============================================================
async function setArea(area) {
    areaActual = area;
    localStorage.setItem('areaActual', area);
    document.querySelectorAll('.area-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.area === area);
    });
    await actualizarDashboard();
    await cargarProductos();
    await cargarMovimientos();
    await actualizarAlertas();
    await actualizarChart();
}

// ============================================================
// Inicializar
// ============================================================
async function init() {
    try {
        const test = await sb('productos', 'GET', null, '?select=id&limit=1');
        console.log('Conexión OK, productos:', test);

        document.getElementById('splash').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');

        document.querySelectorAll('.area-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.area === areaActual);
        });

        setupEventListeners();
        initChart();
        await actualizarDashboard();
        await cargarProductos();
        await cargarMovimientos();
        await actualizarAlertas();
        await actualizarChart();

        // Notificaciones periódicas cada 5 min
        await pedirPermisoNotificacion();
        await verificarStockBajoNotificar();
        setInterval(verificarStockBajoNotificar, 300000);

    } catch (error) {
        console.error('Error init:', error);
        document.getElementById('splash').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        showToast('Error conexión: ' + error.message, true);
    }
}

// ============================================================
// Event Listeners
// ============================================================
function setupEventListeners() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
        });
    });

    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById(btn.dataset.close).classList.add('hidden');
        });
    });

    document.querySelectorAll('.area-btn').forEach(btn => {
        btn.addEventListener('click', () => setArea(btn.dataset.area));
    });

    document.getElementById('btn-add-producto').addEventListener('click', () => {
        document.getElementById('modal-producto-title').textContent = 'Nuevo Producto';
        document.getElementById('form-producto').reset();
        document.getElementById('producto-id').value = '';
        document.getElementById('modal-producto').classList.remove('hidden');
    });

    document.getElementById('btn-add-movimiento').addEventListener('click', async () => {
        document.getElementById('form-movimiento').reset();
        await populateProductosSelect();
        document.getElementById('modal-movimiento').classList.remove('hidden');
    });

    document.getElementById('form-producto').addEventListener('submit', guardarProducto);
    document.getElementById('form-movimiento').addEventListener('submit', guardarMovimiento);
    document.getElementById('search-productos').addEventListener('input', (e) => cargarProductos(e.target.value));
    document.getElementById('search-movimientos').addEventListener('input', (e) => cargarMovimientos(e.target.value));
    document.getElementById('filter-categoria').addEventListener('change', (e) => cargarProductos('', e.target.value));
    document.getElementById('btn-sync').addEventListener('click', async () => {
        await actualizarDashboard();
        await cargarProductos();
        await cargarMovimientos();
        await actualizarAlertas();
        await actualizarChart();
        showToast('Datos sincronizados 🔄');
    });
    document.getElementById('btn-export').addEventListener('click', exportarDatos);
    document.getElementById('btn-notify').addEventListener('click', async () => {
        const ok = await pedirPermisoNotificacion();
        if (ok) {
            await verificarStockBajoNotificar();
            showToast('Notificaciones activadas ✅');
        } else {
            showToast('Permiso denegado', true);
        }
    });
}

// ============================================================
// Dashboard
// ============================================================
async function actualizarDashboard() {
    const productos = await sb('productos', 'GET', null, `?select=*&area=eq.${areaActual}`);
    if (!productos) return;

    const total = productos.length;
    const stockBajo = productos.filter(p => p.stock_actual <= p.stock_minimo).length;
    const totalStock = productos.reduce((sum, p) => sum + (p.stock_actual || 0), 0);

    document.getElementById('total-productos').textContent = total;
    document.getElementById('stock-bajo').textContent = stockBajo;
    document.getElementById('total-stock').textContent = totalStock.toFixed(1);
    document.getElementById('stock-ok').textContent = total - stockBajo;

    const cats = {};
    productos.forEach(p => {
        if (!cats[p.categoria]) cats[p.categoria] = { total: 0, bajo: 0 };
        cats[p.categoria].total++;
        if (p.stock_actual <= p.stock_minimo) cats[p.categoria].bajo++;
    });

    const catsGrid = document.getElementById('categorias-grid');
    catsGrid.innerHTML = '';
    Object.entries(cats).forEach(([cat, data]) => {
        catsGrid.innerHTML += `
            <div class="categoria-card">
                <div>
                    <div class="categoria-name">${cat}</div>
                    <div class="categoria-count">${data.total} productos</div>
                </div>
                ${data.bajo > 0 ? `<span class="categoria-badge danger">⚠ ${data.bajo}</span>` : ''}
            </div>`;
    });

    const stockBajoList = productos
        .filter(p => p.stock_actual <= p.stock_minimo)
        .sort((a, b) => (a.stock_actual - a.stock_minimo) - (b.stock_actual - b.stock_minimo));

    const stockBajoDiv = document.getElementById('stock-bajo-list');
    stockBajoDiv.innerHTML = '';

    if (stockBajoList.length > 0) {
        stockBajoList.forEach(p => {
            stockBajoDiv.innerHTML += `
                <div class="stock-item">
                    <div class="stock-item-info">
                        <div class="stock-item-name">${p.nombre}</div>
                        <div class="stock-item-detail">${p.categoria} | Mínimo: ${p.stock_minimo} ${p.unidad}</div>
                    </div>
                    <span class="stock-item-badge">${p.stock_actual} ${p.unidad}</span>
                </div>`;
        });
    } else {
        stockBajoDiv.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✅</div><p>Todos los productos tienen stock suficiente</p></div>';
    }
}

// ============================================================
// Productos
// ============================================================
async function cargarProductos(search = '', categoria = '') {
    let params = `?select=*&area=eq.${areaActual}&order=categoria,nombre`;
    if (search) params += `&nombre=ilike.*${search}*`;
    if (categoria) params += `&categoria=eq.${categoria}`;

    const productos = await sb('productos', 'GET', null, params);
    const list = document.getElementById('productos-list');
    list.innerHTML = '';

    if (productos && productos.length > 0) {
        productos.forEach(p => {
            const esBajo = p.stock_actual <= p.stock_minimo;
            list.innerHTML += `
                <div class="producto-card ${esBajo ? 'stock-bajo' : 'stock-ok'}">
                    <div class="producto-info">
                        <div class="producto-name">${p.nombre}</div>
                        <div class="producto-detail">${p.categoria} | ${p.unidad} | Mín: ${p.stock_minimo}</div>
                    </div>
                    <div class="producto-stock">
                        <div class="producto-stock-value" style="color: ${esBajo ? 'var(--red)' : 'var(--green)'}">${p.stock_actual}</div>
                        <div class="producto-stock-min">${p.unidad}</div>
                    </div>
                    <div class="producto-actions">
                        <button class="btn-edit" onclick="editarProducto(${p.id})">✏️</button>
                        <button class="btn-delete" onclick="eliminarProducto(${p.id}, '${p.nombre}')">🗑️</button>
                    </div>
                </div>`;
        });
    } else {
        list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📦</div><p>No se encontraron productos</p></div>';
    }
}

async function guardarProducto(e) {
    e.preventDefault();

    const id = document.getElementById('producto-id').value;
    const nombre = document.getElementById('producto-nombre').value;
    const unidad = document.getElementById('producto-unidad').value;
    const categoria = document.getElementById('producto-categoria').value;
    const stockMin = parseFloat(document.getElementById('producto-stock-min').value) || 0;
    const stockAct = parseFloat(document.getElementById('producto-stock-act').value) || 0;

    if (!nombre) { showToast('Ingrese el nombre', true); return; }

    try {
        if (id) {
            await sb('productos', 'PATCH', { nombre, unidad, stock_minimo: stockMin, categoria, area: areaActual }, `?id=eq.${id}`);
            showToast('Producto actualizado');
        } else {
            await sb('productos', 'POST', { nombre, unidad, stock_minimo: stockMin, stock_actual: stockAct, categoria, area: areaActual });
            showToast('Producto agregado');
        }
        document.getElementById('modal-producto').classList.add('hidden');
        await cargarProductos();
        await actualizarDashboard();
        await actualizarAlertas();
        await actualizarChart();
    } catch (err) {
        showToast('Error: ' + err.message, true);
    }
}


async function editarProducto(id) {
    const data = await sb('productos', 'GET', null, `?id=eq.${id}&select=*`);
    if (!data || !data.length) return;
    const p = data[0];

    document.getElementById('modal-producto-title').textContent = 'Editar Producto';
    document.getElementById('producto-id').value = p.id;
    document.getElementById('producto-nombre').value = p.nombre;
    document.getElementById('producto-unidad').value = p.unidad;
    document.getElementById('producto-categoria').value = p.categoria;
    document.getElementById('producto-stock-min').value = p.stock_minimo;
    document.getElementById('producto-stock-act').value = p.stock_actual;
    document.getElementById('modal-producto').classList.remove('hidden');
}

async function eliminarProducto(id, nombre) {
    if (!confirm(`¿Eliminar "${nombre}"?`)) return;
    await sb('movimientos', 'DELETE', null, `?producto_id=eq.${id}`);
    await sb('productos', 'DELETE', null, `?id=eq.${id}`);
    await cargarProductos();
    await actualizarDashboard();
    await actualizarAlertas();
    await actualizarChart();
    showToast('Producto eliminado');
}

// ============================================================
// Movimientos
// ============================================================
async function populateProductosSelect() {
    const productos = await sb('productos', 'GET', null, `?select=id,nombre,unidad,stock_actual&area=eq.${areaActual}&order=nombre`);
    const select = document.getElementById('movimiento-producto');
    select.innerHTML = '';
    if (productos) {
        productos.forEach(p => {
            select.innerHTML += `<option value="${p.id}">${p.nombre} (${p.stock_actual} ${p.unidad})</option>`;
        });
    }
}

async function cargarMovimientos(search = '') {
    let params = `?select=*,productos(nombre,unidad)&order=id.desc&limit=50&productos.area=eq.${areaActual}`;
    if (search) params += `&productos.nombre=ilike.*${search}*`;

    const movimientos = await sb('movimientos', 'GET', null, params);
    const list = document.getElementById('movimientos-list');
    list.innerHTML = '';

    if (movimientos && movimientos.length > 0) {
        movimientos.forEach(m => {
            const esEntrada = m.tipo === 'Entrada';
            const nombre = m.productos ? m.productos.nombre : 'N/A';
            const unidad = m.productos ? m.productos.unidad : '';
            list.innerHTML += `
                <div class="movimiento-card">
                    <div class="movimiento-icon ${esEntrada ? 'entrada' : 'salida'}">${esEntrada ? '📥' : '📤'}</div>
                    <div class="movimiento-info">
                        <div class="movimiento-producto">${nombre}</div>
                        <div class="movimiento-detail">${m.fecha} ${m.observaciones ? '- ' + m.observaciones : ''}</div>
                    </div>
                    <div class="movimiento-cantidad ${esEntrada ? 'entrada' : 'salida'}">${esEntrada ? '+' : '-'}${m.cantidad} ${unidad}</div>
                </div>`;
        });
    } else {
        list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔄</div><p>No hay movimientos registrados</p></div>';
    }
}

async function guardarMovimiento(e) {
    e.preventDefault();

    const productoId = parseInt(document.getElementById('movimiento-producto').value);
    const tipo = document.getElementById('movimiento-tipo').value;
    const cantidad = parseFloat(document.getElementById('movimiento-cantidad').value);
    const obs = document.getElementById('movimiento-obs').value;

    if (!cantidad || cantidad <= 0) { showToast('Ingrese una cantidad válida', true); return; }

    try {
        if (tipo === 'Salida') {
            const prod = await sb('productos', 'GET', null, `?id=eq.${productoId}&select=stock_actual`);
            if (prod && prod.length && cantidad > prod[0].stock_actual) {
                showToast(`Stock insuficiente. Actual: ${prod[0].stock_actual}`, true);
                return;
            }
        }

        const fecha = new Date().toLocaleString('es-CL');
        await sb('movimientos', 'POST', { producto_id: productoId, tipo, cantidad, fecha, usuario: 'Mobile', observaciones: obs });

        const prod = await sb('productos', 'GET', null, `?id=eq.${productoId}&select=stock_actual`);
        const nuevoStock = tipo === 'Entrada' ? prod[0].stock_actual + cantidad : prod[0].stock_actual - cantidad;
        await sb('productos', 'PATCH', { stock_actual: nuevoStock }, `?id=eq.${productoId}`);

        document.getElementById('modal-movimiento').classList.add('hidden');
        await cargarMovimientos();
        await cargarProductos();
        await actualizarDashboard();
        await actualizarAlertas();
        await actualizarChart();
        showToast(`Movimiento registrado: ${tipo} de ${cantidad}`);
    } catch (err) {
        showToast('Error: ' + err.message, true);
    }
}

// ============================================================
// Alertas
// ============================================================
async function actualizarAlertas() {
    const todos = await sb('productos', 'GET', null, `?select=*&area=eq.${areaActual}`);
    if (!todos) return;

    const stockBajo = todos.filter(p => p.stock_actual <= p.stock_minimo).sort((a, b) => (a.stock_actual - a.stock_minimo) - (b.stock_actual - b.stock_minimo));
    const list = document.getElementById('alertas-list');
    const badge = document.getElementById('badge-alertas');

    if (stockBajo.length > 0) {
        badge.textContent = stockBajo.length;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }

    list.innerHTML = '';
    if (stockBajo.length > 0) {
        stockBajo.forEach(p => {
            const diferencia = p.stock_minimo - p.stock_actual;
            list.innerHTML += `
                <div class="alerta-item">
                    <div class="stock-item-info">
                        <div class="stock-item-name">${p.nombre}</div>
                        <div class="stock-item-detail">${p.categoria} | Actual: ${p.stock_actual} ${p.unidad} | Mínimo: ${p.stock_minimo} ${p.unidad}</div>
                        <div class="stock-item-detail" style="color: var(--red)">Necesita: ${diferencia.toFixed(1)} ${p.unidad}</div>
                    </div>
                    <button class="btn-primary" onclick="agregarEntradaRapida(${p.id})">+ Agregar</button>
                </div>`;
        });
    } else {
        list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✅</div><p>No hay alertas de stock bajo</p></div>';
    }
}

async function agregarEntradaRapida(productoId) {
    await populateProductosSelect();
    document.getElementById('movimiento-tipo').value = 'Entrada';
    document.getElementById('movimiento-cantidad').value = '';
    document.getElementById('movimiento-obs').value = '';
    const select = document.getElementById('movimiento-producto');
    for (let i = 0; i < select.options.length; i++) {
        if (select.options[i].value == productoId) { select.selectedIndex = i; break; }
    }
    document.getElementById('modal-movimiento').classList.remove('hidden');
}

// ============================================================
// Exportar
// ============================================================
async function exportarDatos() {
    const productos = await sb('productos', 'GET', null, `?select=*&area=eq.${areaActual}&order=categoria,nombre`);
    const movimientos = await sb('movimientos', 'GET', null, `?select=*&order=id.desc&productos.area=eq.${areaActual}`);

    let csv = 'INVENTARIO CONGELADORA - Exportado: ' + new Date().toLocaleString('es-CL') + '\n\n';
    csv += 'PRODUCTOS:\nID,Nombre,Unidad,Stock Mínimo,Stock Actual,Categoría\n';
    if (productos) productos.forEach(p => { csv += `${p.id},${p.nombre},${p.unidad},${p.stock_minimo},${p.stock_actual},${p.categoria}\n`; });
    csv += '\nMOVIMIENTOS:\nID,Producto ID,Tipo,Cantidad,Fecha,Usuario,Observaciones\n';
    if (movimientos) movimientos.forEach(m => { csv += `${m.id},${m.producto_id},${m.tipo},${m.cantidad},${m.fecha},${m.usuario},${m.observaciones || ''}\n`; });

    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `inventario_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    showToast('Datos exportados');
}

// ============================================================
// Toast
// ============================================================
function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = isError ? 'toast error' : 'toast';
    setTimeout(() => { toast.classList.add('hidden'); }, 3000);
}

// ============================================================
// Service Worker
// ============================================================
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ============================================================
// Init
// ============================================================
window.addEventListener('DOMContentLoaded', init);
