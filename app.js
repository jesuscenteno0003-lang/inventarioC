// ============================================================
// Inventario Cocina - PWA con Supabase REST API directa
// ============================================================

const SB_URL = 'https://nmrquawcyypsjvmiwond.supabase.co';
const SB_KEY = 'sb_publishable_iTgqTzfSyjkC4g85-UrubA_GGMp3RDy';

let chartConsumo = null;
let areaActual = localStorage.getItem('areaActual') || 'Calientes';
let usuarioActual = localStorage.getItem('usuarioActual') || '';

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

    const idsArea = (await sb('productos', 'GET', null, `?select=id&area=eq.${areaActual}`) || []).map(p => p.id);
    const todosMov = await sb('movimientos', 'GET', null, '?select=tipo,cantidad,fecha,producto_id&limit=500');
    const movimientos = todosMov ? todosMov.filter(m => idsArea.includes(m.producto_id)) : [];
    if (movimientos.length === 0) return;

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
    document.getElementById('header-area').textContent = area;
    document.querySelector('.splash h1').textContent = `Inventario · ${area}`;
    document.title = `Inv ${area}`;
    await actualizarDashboard();
    await cargarProductos();
    await cargarMovimientos();
    await actualizarAlertas();
    await actualizarChart();
    await actualizarProduccion();
}

// ============================================================
// Usuarios (compartidos vía Supabase)
// ============================================================
async function getUsuarios() {
    try {
        return await sb('usuarios', 'GET', null, '?select=id,nombre,ultimo_acceso&activo=eq.true&order=ultimo_acceso.desc&limit=30');
    } catch { return []; }
}

async function upsertUsuario(nombre) {
    const existing = await sb('usuarios', 'GET', null, `?nombre=eq.${encodeURIComponent(nombre)}&select=id`);
    if (existing && existing.length) {
        await sb('usuarios', 'PATCH', { ultimo_acceso: new Date().toISOString() }, `?id=eq.${existing[0].id}`);
    } else {
        await sb('usuarios', 'POST', { nombre, ultimo_acceso: new Date().toISOString(), activo: true });
    }
}

async function setUsuario(nombre) {
    usuarioActual = nombre;
    localStorage.setItem('usuarioActual', nombre);
    await upsertUsuario(nombre);
    document.getElementById('user-name-display').textContent = nombre || 'Seleccionar usuario';
}

async function mostrarSelectorUsuario() {
    const modal = document.getElementById('modal-usuario');
    const input = document.getElementById('input-usuario');
    const recientes = document.getElementById('usuarios-recientes');
    const confirmar = document.getElementById('btn-confirmar-usuario');

    input.value = '';
    recientes.innerHTML = '';

    const usuarios = await getUsuarios();
    if (usuarios && usuarios.length) {
        usuarios.forEach(u => {
            const btn = document.createElement('button');
            btn.textContent = u.nombre;
            btn.style.cssText = 'background:var(--accent-dim);color:var(--accent);border:none;border-radius:6px;padding:6px 14px;font-size:13px;font-weight:700;cursor:pointer;transition:transform 0.2s';
            btn.onclick = () => { setUsuario(u.nombre); modal.classList.add('hidden'); };
            recientes.appendChild(btn);
        });
    }

    const handleOk = async () => {
        const val = input.value.trim();
        if (val) { await setUsuario(val); modal.classList.add('hidden'); }
    };

    confirmar.onclick = handleOk;
    input.onkeydown = (e) => { if (e.key === 'Enter') handleOk(); };
    modal.classList.remove('hidden');
    setTimeout(() => input.focus(), 300);
}

// ============================================================
// Admin Usuarios
// ============================================================
let usuariosEditando = [];

async function mostrarAdminUsuarios() {
    const modal = document.getElementById('modal-admin-usuarios');
    const list = document.getElementById('admin-usuarios-list');
    list.innerHTML = '<div style="text-align:center;padding:20px">Cargando...</div>';
    modal.classList.remove('hidden');

    const usuarios = await getUsuarios();
    usuariosEditando = usuarios.map(u => ({ ...u }));
    renderAdminUsuarios();
}

function renderAdminUsuarios() {
    const list = document.getElementById('admin-usuarios-list');
    list.innerHTML = '';
    if (!usuariosEditando.length) {
        list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-secondary)">No hay usuarios</div>';
        return;
    }
    usuariosEditando.forEach(u => {
        const card = document.createElement('div');
        card.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05)';
        card.innerHTML = `
            <span style="flex:1;font-size:14px">👤 ${u.nombre}</span>
            <button class="btn-edit-usuario" data-id="${u.id}" style="background:var(--accent-dim);color:var(--accent);border:none;border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer">✏️</button>
            <button class="btn-del-usuario" data-id="${u.id}" style="background:rgba(231,76,60,0.2);color:#e74c3c;border:none;border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer">🗑️</button>
        `;
        list.appendChild(card);
    });

    list.querySelectorAll('.btn-edit-usuario').forEach(btn => {
        btn.onclick = () => editarUsuario(parseInt(btn.dataset.id));
    });
    list.querySelectorAll('.btn-del-usuario').forEach(btn => {
        btn.onclick = () => eliminarUsuario(parseInt(btn.dataset.id));
    });
}

function editarUsuario(id) {
    const u = usuariosEditando.find(x => x.id === id);
    if (!u) return;
    const nuevo = prompt('Nuevo nombre:', u.nombre);
    if (nuevo && nuevo.trim() && nuevo.trim() !== u.nombre) {
        u.nombre = nuevo.trim();
        sb('usuarios', 'PATCH', { nombre: u.nombre }, `?id=eq.${id}`).then(() => {
            renderAdminUsuarios();
            showToast('Usuario actualizado');
        });
    }
}

function eliminarUsuario(id) {
    if (!confirm('¿Eliminar este usuario?')) return;
    sb('usuarios', 'PATCH', { activo: false }, `?id=eq.${id}`).then(() => {
        usuariosEditando = usuariosEditando.filter(x => x.id !== id);
        renderAdminUsuarios();
        showToast('Usuario eliminado');
    });
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
        document.getElementById('header-area').textContent = areaActual;
        document.title = `Inv ${areaActual}`;

        if (usuarioActual) {
            document.getElementById('user-name-display').textContent = usuarioActual;
        } else {
            setTimeout(() => mostrarSelectorUsuario(), 500);
        }

        setupEventListeners();
        initChart();
        await actualizarDashboard();
        await cargarProductos();
        await cargarMovimientos();
        await actualizarAlertas();
        await actualizarChart();
        await actualizarProduccion();

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

    document.getElementById('productos-list').addEventListener('click', (e) => {
        const edit = e.target.closest('.btn-edit');
        if (edit) editarProducto(parseInt(edit.dataset.id));
        const del = e.target.closest('.btn-delete');
        if (del) eliminarProducto(parseInt(del.dataset.id), del.dataset.nombre);
    });

    document.getElementById('btn-export-produccion').addEventListener('click', exportarProduccion);
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
        await actualizarProduccion();
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
                        ${p.notas ? `<div class="producto-notas">${p.notas.replace(/Creado por:/g, '👤')}</div>` : ''}
                    </div>
                    <div class="producto-stock">
                        <div class="producto-stock-value" style="color: ${esBajo ? 'var(--red)' : 'var(--green)'}">${p.stock_actual}</div>
                        <div class="producto-stock-min">${p.unidad}</div>
                    </div>
                    <div class="producto-actions">
                        <button class="btn-edit" data-id="${p.id}">✏️</button>
                        <button class="btn-delete" data-id="${p.id}" data-nombre="${p.nombre.replace(/'/g, '')}">🗑️</button>
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
            const prev = await sb('productos', 'GET', null, `?id=eq.${id}&select=notas`);
            const prevNotas = prev?.[0]?.notas || '';
            const editLine = `Editado por: ${usuarioActual || 'Anónimo'} - ${new Date().toLocaleDateString('es-CL')}`;
            const nuevasNotas = prevNotas ? `${prevNotas} | ${editLine}` : editLine;
            await sb('productos', 'PATCH', { nombre, unidad, stock_minimo: stockMin, categoria, area: areaActual, notas: nuevasNotas }, `?id=eq.${id}`);
            showToast('Producto actualizado');
        } else {
            const notas = `Creado por: ${usuarioActual || 'Anónimo'} - ${new Date().toLocaleDateString('es-CL')}`;
            await sb('productos', 'POST', { nombre, unidad, stock_minimo: stockMin, stock_actual: stockAct, categoria, area: areaActual, notas });
            showToast('Producto agregado');
        }
        document.getElementById('modal-producto').classList.add('hidden');
        await cargarProductos();
        await actualizarDashboard();
        await actualizarAlertas();
        await actualizarChart();
        await actualizarProduccion();
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
    await actualizarProduccion();
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
    const todosMov = await sb('movimientos', 'GET', null, '?select=*,productos(nombre,unidad)&order=id.desc&limit=100');

    let movimientos = [];
    if (todosMov) {
        const idsArea = (await sb('productos', 'GET', null, `?select=id&area=eq.${areaActual}`) || []).map(p => p.id);
        movimientos = todosMov.filter(m => idsArea.includes(m.producto_id));
        if (search) movimientos = movimientos.filter(m => (m.productos?.nombre || '').toLowerCase().includes(search.toLowerCase()));
    }
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
                        <div class="movimiento-detail">${m.fecha} · 👤 ${m.usuario || 'Anónimo'} ${m.observaciones ? '· ' + m.observaciones : ''}</div>
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
        await sb('movimientos', 'POST', { producto_id: productoId, tipo, cantidad, fecha, usuario: usuarioActual || 'Anónimo', observaciones: obs });

        const prod = await sb('productos', 'GET', null, `?id=eq.${productoId}&select=stock_actual`);
        const nuevoStock = tipo === 'Entrada' ? prod[0].stock_actual + cantidad : prod[0].stock_actual - cantidad;
        await sb('productos', 'PATCH', { stock_actual: nuevoStock }, `?id=eq.${productoId}`);

        document.getElementById('modal-movimiento').classList.add('hidden');
        await cargarMovimientos();
        await cargarProductos();
        await actualizarDashboard();
        await actualizarAlertas();
        await actualizarChart();
        await actualizarProduccion();
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
// Plan de Producción
// ============================================================
async function actualizarProduccion() {
    const container = document.getElementById('produccion-list');
    if (!container) return;

    const productos = await sb('productos', 'GET', null, `?select=*&area=eq.${areaActual}`);
    if (!productos || productos.length === 0) {
        container.innerHTML = '<div class="produccion-empty">📋 Selecciona un área para ver el plan de producción</div>';
        return;
    }

    const productIds = productos.map(p => p.id);
    const todosMov = await sb('movimientos', 'GET', null, '?select=producto_id,tipo,cantidad,fecha&limit=500&order=fecha.desc');
    const movimientos = todosMov ? todosMov.filter(m => productIds.includes(m.producto_id)) : [];

    const consumo = {};
    if (movimientos) {
        const hace7dias = new Date();
        hace7dias.setDate(hace7dias.getDate() - 7);
        const hace14dias = new Date();
        hace14dias.setDate(hace14dias.getDate() - 14);

        movimientos.forEach(m => {
            if (m.tipo === 'Salida' && m.producto_id) {
                if (!consumo[m.producto_id]) consumo[m.producto_id] = { semana: 0, quincena: 0 };
                const fecha = new Date(m.fecha);
                if (fecha >= hace14dias) consumo[m.producto_id].quincena += parseFloat(m.cantidad) || 0;
                if (fecha >= hace7dias) consumo[m.producto_id].semana += parseFloat(m.cantidad) || 0;
            }
        });
    }

    const plan = productos.map(p => {
        const c = consumo[p.id] || { semana: 0, quincena: 0 };
        const consumoDiario = c.quincena > 0 ? c.quincena / 14 : 0.5;
        const stock = parseFloat(p.stock_actual) || 0;
        const min = parseFloat(p.stock_minimo) || 0;
        const diasRestantes = consumoDiario > 0 ? stock / consumoDiario : 99;
        const porcentajeStock = min > 0 ? (stock / min) * 100 : 100;

        let prioridad, prioridadLabel, diaSugerido;
        if (stock <= min || diasRestantes <= 3) {
            prioridad = 'alta';
            prioridadLabel = '🔴 Alta';
            diaSugerido = stock <= 0 ? '¡URGENTE - HOY!' : 'Lunes';
        } else if (porcentajeStock < 150 || diasRestantes <= 7) {
            prioridad = 'media';
            prioridadLabel = '🟡 Media';
            diaSugerido = 'Miércoles';
        } else if (c.semana > 0 && porcentajeStock < 250) {
            prioridad = 'baja';
            prioridadLabel = '🟢 Baja';
            diaSugerido = 'Viernes';
        } else {
            prioridad = 'ninguna';
            prioridadLabel = '';
            diaSugerido = '';
        }

        const sugerido = prioridad !== 'ninguna' ? Math.max(min * 2 - stock, consumoDiario * 7) : 0;

        return { ...p, consumo: c, consumoDiario, diasRestantes, prioridad, prioridadLabel, diaSugerido, sugerido: Math.ceil(sugerido) };
    });

    const filtrados = plan.filter(p => p.prioridad !== 'ninguna')
        .sort((a, b) => {
            const ordem = { alta: 0, media: 1, baja: 2 };
            return (ordem[a.prioridad] || 99) - (ordem[b.prioridad] || 99);
        });

    container.innerHTML = '';

    if (filtrados.length === 0) {
        container.innerHTML = '<div class="produccion-empty">✅ No hay productos que requieran producción esta semana</div>';
        return;
    }

    const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const agrupado = {};
    filtrados.forEach(p => {
        const d = p.diaSugerido === '¡URGENTE - HOY!' ? 'URGENTE' : p.diaSugerido;
        if (!agrupado[d]) agrupado[d] = [];
        agrupado[d].push(p);
    });

    ['URGENTE', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'].forEach(dia => {
        if (!agrupado[dia]) return;
        const esUrgente = dia === 'URGENTE';
        const header = esUrgente ? '🔥 URGENTE - Producir Hoy' : `📅 ${dia}`;

        container.innerHTML += `<div style="margin-bottom:16px"><h3 style="font-size:14px;margin-bottom:10px;color:${esUrgente ? 'var(--red)' : 'var(--accent)'}">${header}</h3>`;

        agrupado[dia].forEach(p => {
            container.innerHTML += `
                <div class="produccion-card priority-${p.prioridad}">
                    <div class="produccion-header">
                        <span class="produccion-nombre">${p.nombre}</span>
                        <span class="produccion-priority">${p.prioridadLabel}</span>
                    </div>
                    <div class="produccion-details">
                        <div class="produccion-detail-item">Stock Actual<strong>${p.stock_actual} ${p.unidad}</strong></div>
                        <div class="produccion-detail-item">Stock Mínimo<strong>${p.stock_minimo} ${p.unidad}</strong></div>
                        <div class="produccion-detail-item">Producir<strong style="color:var(--accent)">${p.sugerido} ${p.unidad}</strong></div>
                    </div>
                    <div class="produccion-dia">📊 Consumo semanal: ${p.consumo.semana.toFixed(1)} ${p.unidad} · Stock para ${p.diasRestantes < 99 ? p.diasRestantes.toFixed(1) : '∞'} días</div>
                </div>`;
        });

        container.innerHTML += '</div>';
    });
}

async function exportarProduccion() {
    const container = document.getElementById('produccion-list');
    if (!container) return;

    const productos = await sb('productos', 'GET', null, `?select=*&area=eq.${areaActual}`);
    if (!productos) return;

    const productIds = productos.map(p => p.id);
    const todosMov = await sb('movimientos', 'GET', null, '?select=producto_id,tipo,cantidad,fecha&limit=500&order=fecha.desc');
    const movimientos = todosMov ? todosMov.filter(m => productIds.includes(m.producto_id)) : [];

    const consumo = {};
    if (movimientos) {
        const hace14dias = new Date();
        hace14dias.setDate(hace14dias.getDate() - 14);
        movimientos.forEach(m => {
            if (m.tipo === 'Salida' && m.producto_id && new Date(m.fecha) >= hace14dias) {
                if (!consumo[m.producto_id]) consumo[m.producto_id] = 0;
                consumo[m.producto_id] += parseFloat(m.cantidad) || 0;
            }
        });
    }

    const plan = productos.map(p => {
        const c = consumo[p.id] || 0;
        const consumoDiario = c / 14 || 0.5;
        const stock = parseFloat(p.stock_actual) || 0;
        const min = parseFloat(p.stock_minimo) || 0;
        const diasRestantes = consumoDiario > 0 ? stock / consumoDiario : 99;
        const sugerido = stock <= min || diasRestantes <= 7 ? Math.ceil(Math.max(min * 2 - stock, consumoDiario * 7)) : 0;
        return { nombre: p.nombre, stock, min, unidad: p.unidad, sugerido, consumoDiario: consumoDiario.toFixed(1), diasRestantes: diasRestantes < 99 ? diasRestantes.toFixed(1) : '∞' };
    }).filter(p => p.sugerido > 0);

    const hoy = new Date().toLocaleDateString('es-CL');
    let csv = `PLAN DE PRODUCCIÓN SEMANAL - ${areaActual}\n`;
    csv += `Generado: ${hoy}\n\n`;
    csv += `Producto,Stock Actual,Stock Mínimo,Unidad,Consumo Diario,Días Restantes,Producir\n`;
    plan.forEach(p => {
        csv += `${p.nombre},${p.stock},${p.min},${p.unidad},${p.consumoDiario},${p.diasRestantes},${p.sugerido}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `produccion_${areaActual.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    showToast('Plan de producción exportado 📋');
}

// ============================================================
// Exportar
// ============================================================
async function exportarDatos() {
    const productos = await sb('productos', 'GET', null, `?select=*&area=eq.${areaActual}&order=categoria,nombre`);
    const todosMov = await sb('movimientos', 'GET', null, '?select=*,productos(nombre,unidad)&order=id.desc');
    const idsArea = productos ? productos.map(p => p.id) : [];
    const movimientos = todosMov ? todosMov.filter(m => idsArea.includes(m.producto_id)) : [];

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
