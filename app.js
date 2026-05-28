// ============================================================
// Inventario Cocina - PWA con Supabase
// ============================================================

const SUPABASE_URL = 'https://nmrquawcyypsjvmiwond.supabase.co';
const SUPABASE_KEY = 'sb_publishable_iTgqTzfSyjkC4g85-UrubA_GGMp3RDy';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================================
// Inicializar
// ============================================================
async function init() {
    try {
        const { error } = await supabase.from('productos').select('id').limit(1);
        if (error && error.code === '42P01') {
            showToast('Ejecuta el SQL en Supabase Dashboard primero', true);
        }

        document.getElementById('splash').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');

        setupEventListeners();
        await actualizarDashboard();
        await cargarProductos();
        await cargarMovimientos();
        await actualizarAlertas();

    } catch (error) {
        console.error('Error initializing:', error);
        showToast('Error: ' + error.message, true);
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

    document.getElementById('search-productos').addEventListener('input', (e) => {
        cargarProductos(e.target.value);
    });

    document.getElementById('search-movimientos').addEventListener('input', (e) => {
        cargarMovimientos(e.target.value);
    });

    document.getElementById('filter-categoria').addEventListener('change', (e) => {
        cargarProductos('', e.target.value);
    });

    document.getElementById('btn-export').addEventListener('click', exportarDatos);
}

// ============================================================
// Dashboard
// ============================================================
async function actualizarDashboard() {
    const { data: productos } = await supabase.from('productos').select('*');
    if (!productos) return;

    const total = productos.length;
    const stockBajo = productos.filter(p => p.stock_actual <= p.stock_minimo).length;
    const totalStock = productos.reduce((sum, p) => sum + (p.stock_actual || 0), 0);
    const stockOk = total - stockBajo;

    document.getElementById('total-productos').textContent = total;
    document.getElementById('stock-bajo').textContent = stockBajo;
    document.getElementById('total-stock').textContent = totalStock.toFixed(1);
    document.getElementById('stock-ok').textContent = stockOk;

    // Categorías
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
            </div>
        `;
    });

    // Stock bajo
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
                </div>
            `;
        });
    } else {
        stockBajoDiv.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✅</div><p>Todos los productos tienen stock suficiente</p></div>';
    }
}

// ============================================================
// Productos
// ============================================================
async function cargarProductos(search = '', categoria = '') {
    let query = supabase.from('productos').select('*').order('categoria').order('nombre');

    if (search) {
        query = query.ilike('nombre', `%${search}%`);
    }
    if (categoria) {
        query = query.eq('categoria', categoria);
    }

    const { data: productos, error } = await query;
    if (error) { console.error(error); return; }

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
                </div>
            `;
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

    if (!nombre) {
        showToast('Ingrese el nombre del producto', true);
        return;
    }

    if (id) {
        const { error } = await supabase.from('productos').update({
            nombre, unidad, stock_minimo: stockMin, categoria
        }).eq('id', parseInt(id));
        if (error) { showToast('Error: ' + error.message, true); return; }
        showToast('Producto actualizado');
    } else {
        const { error } = await supabase.from('productos').insert({
            nombre, unidad, stock_minimo: stockMin, stock_actual: stockAct, categoria
        });
        if (error) { showToast('Error: ' + error.message, true); return; }
        showToast('Producto agregado');
    }

    document.getElementById('modal-producto').classList.add('hidden');
    await cargarProductos();
    await actualizarDashboard();
    await actualizarAlertas();
}

async function editarProducto(id) {
    const { data } = await supabase.from('productos').select('*').eq('id', id).single();
    if (!data) return;

    document.getElementById('modal-producto-title').textContent = 'Editar Producto';
    document.getElementById('producto-id').value = data.id;
    document.getElementById('producto-nombre').value = data.nombre;
    document.getElementById('producto-unidad').value = data.unidad;
    document.getElementById('producto-categoria').value = data.categoria;
    document.getElementById('producto-stock-min').value = data.stock_minimo;
    document.getElementById('producto-stock-act').value = data.stock_actual;

    document.getElementById('modal-producto').classList.remove('hidden');
}

async function eliminarProducto(id, nombre) {
    if (confirm(`¿Eliminar "${nombre}"?`)) {
        await supabase.from('movimientos').delete().eq('producto_id', id);
        await supabase.from('productos').delete().eq('id', id);
        await cargarProductos();
        await actualizarDashboard();
        await actualizarAlertas();
        showToast('Producto eliminado');
    }
}

// ============================================================
// Movimientos
// ============================================================
async function populateProductosSelect() {
    const { data: productos } = await supabase.from('productos').select('id, nombre, unidad, stock_actual').order('nombre');
    const select = document.getElementById('movimiento-producto');
    select.innerHTML = '';

    if (productos) {
        productos.forEach(p => {
            select.innerHTML += `<option value="${p.id}">${p.nombre} (${p.stock_actual} ${p.unidad})</option>`;
        });
    }
}

async function cargarMovimientos(search = '') {
    let query = supabase.from('movimientos').select('*, productos(nombre, unidad)').order('id', { ascending: false }).limit(50);

    if (search) {
        query = query.ilike('productos.nombre', `%${search}%`);
    }

    const { data: movimientos, error } = await query;
    if (error) { console.error(error); return; }

    const list = document.getElementById('movimientos-list');
    list.innerHTML = '';

    if (movimientos && movimientos.length > 0) {
        movimientos.forEach(m => {
            const esEntrada = m.tipo === 'Entrada';
            const nombre = m.productos ? m.productos.nombre : 'N/A';
            const unidad = m.productos ? m.productos.unidad : '';
            list.innerHTML += `
                <div class="movimiento-card">
                    <div class="movimiento-icon ${esEntrada ? 'entrada' : 'salida'}">
                        ${esEntrada ? '📥' : '📤'}
                    </div>
                    <div class="movimiento-info">
                        <div class="movimiento-producto">${nombre}</div>
                        <div class="movimiento-detail">${m.fecha} ${m.observaciones ? '- ' + m.observaciones : ''}</div>
                    </div>
                    <div class="movimiento-cantidad ${esEntrada ? 'entrada' : 'salida'}">
                        ${esEntrada ? '+' : '-'}${m.cantidad} ${unidad}
                    </div>
                </div>
            `;
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

    if (!cantidad || cantidad <= 0) {
        showToast('Ingrese una cantidad válida', true);
        return;
    }

    if (tipo === 'Salida') {
        const { data: prod } = await supabase.from('productos').select('stock_actual').eq('id', productoId).single();
        if (prod && cantidad > prod.stock_actual) {
            showToast(`Stock insuficiente. Actual: ${prod.stock_actual}`, true);
            return;
        }
    }

    const fecha = new Date().toLocaleString('es-CL');

    const { error: movError } = await supabase.from('movimientos').insert({
        producto_id: productoId, tipo, cantidad, fecha, usuario: 'Mobile', observaciones: obs
    });
    if (movError) { showToast('Error: ' + movError.message, true); return; }

    const { data: prod } = await supabase.from('productos').select('stock_actual').eq('id', productoId).single();
    const nuevoStock = tipo === 'Entrada' ? prod.stock_actual + cantidad : prod.stock_actual - cantidad;

    await supabase.from('productos').update({ stock_actual: nuevoStock }).eq('id', productoId);

    document.getElementById('modal-movimiento').classList.add('hidden');
    await cargarMovimientos();
    await cargarProductos();
    await actualizarDashboard();
    await actualizarAlertas();
    showToast(`Movimiento registrado: ${tipo} de ${cantidad}`);
}

// ============================================================
// Alertas
// ============================================================
async function actualizarAlertas() {
    const { data: productos } = await supabase.from('productos').select('*').lte('stock_actual', 0);
    
    const { data: todos } = await supabase.from('productos').select('*');
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
                </div>
            `;
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
        if (select.options[i].value == productoId) {
            select.selectedIndex = i;
            break;
        }
    }

    document.getElementById('modal-movimiento').classList.remove('hidden');
}

// ============================================================
// Exportar
// ============================================================
async function exportarDatos() {
    const { data: productos } = await supabase.from('productos').select('*').order('categoria').order('nombre');
    const { data: movimientos } = await supabase.from('movimientos').select('*').order('id', { ascending: false });

    let csv = 'INVENTARIO CONGELADORA - Exportado: ' + new Date().toLocaleString('es-CL') + '\n\n';
    csv += 'PRODUCTOS:\n';
    csv += 'ID,Nombre,Unidad,Stock Mínimo,Stock Actual,Categoría\n';
    if (productos) productos.forEach(p => {
        csv += `${p.id},${p.nombre},${p.unidad},${p.stock_minimo},${p.stock_actual},${p.categoria}\n`;
    });

    csv += '\nMOVIMIENTOS:\n';
    csv += 'ID,Producto ID,Tipo,Cantidad,Fecha,Usuario,Observaciones\n';
    if (movimientos) movimientos.forEach(m => {
        csv += `${m.id},${m.producto_id},${m.tipo},${m.cantidad},${m.fecha},${m.usuario},${m.observaciones || ''}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventario_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    showToast('Datos exportados correctamente');
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
    navigator.serviceWorker.register('sw.js')
        .then(reg => console.log('SW registered'))
        .catch(err => console.log('SW error:', err));
}

// ============================================================
// Init
// ============================================================
window.addEventListener('DOMContentLoaded', init);
