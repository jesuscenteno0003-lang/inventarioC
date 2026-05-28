// ============================================================
// Inventario Cocina - PWA con persistencia
// ============================================================

let db = null;
let SQL = null;
const DB_NAME = 'inventario_cocina_db';
const DB_STORE = 'database';

// ============================================================
// IndexedDB - Guardar/Cargar base de datos
// ============================================================
function openIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (e) => {
            const idb = e.target.result;
            if (!idb.objectStoreNames.contains(DB_STORE)) {
                idb.createObjectStore(DB_STORE);
            }
        };
    });
}

async function guardarDB() {
    try {
        const data = db.export();
        const idb = await openIndexedDB();
        const tx = idb.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).put(data, 'inventario');
        return new Promise((resolve) => { tx.oncomplete = resolve; });
    } catch (e) {
        console.error('Error guardando DB:', e);
    }
}

async function cargarDB() {
    try {
        const idb = await openIndexedDB();
        const tx = idb.transaction(DB_STORE, 'readonly');
        const request = tx.objectStore(DB_STORE).get('inventario');
        return new Promise((resolve) => {
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => resolve(null);
        });
    } catch (e) {
        return null;
    }
}

// ============================================================
// Inicializar
// ============================================================
async function init() {
    try {
        SQL = await initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
        });
        
        // Intentar cargar base de datos guardada
        const savedData = await cargarDB();
        
        if (savedData) {
            db = new SQL.Database(savedData);
            console.log('Base de datos cargada desde almacenamiento local');
        } else {
            db = new SQL.Database();
            crearTablas();
            cargarDatosIniciales();
            await guardarDB();
            console.log('Base de datos creada con datos iniciales');
        }
        
        document.getElementById('splash').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        
        setupEventListeners();
        actualizarDashboard();
        cargarProductos();
        cargarMovimientos();
        actualizarAlertas();
        
    } catch (error) {
        console.error('Error initializing:', error);
        showToast('Error al inicializar la base de datos', true);
    }
}

function crearTablas() {
    db.run(`
        CREATE TABLE IF NOT EXISTS productos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            unidad TEXT DEFAULT 'UND',
            stock_minimo REAL DEFAULT 5,
            stock_actual REAL DEFAULT 0,
            categoria TEXT DEFAULT 'General'
        )
    `);
    
    db.run(`
        CREATE TABLE IF NOT EXISTS movimientos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            producto_id INTEGER,
            tipo TEXT,
            cantidad REAL,
            fecha TEXT,
            usuario TEXT DEFAULT 'Mobile',
            observaciones TEXT,
            FOREIGN KEY (producto_id) REFERENCES productos(id)
        )
    `);
}

function cargarDatosIniciales() {
    const result = db.exec("SELECT COUNT(*) FROM productos");
    if (result[0].values[0][0] === 0) {
        const productos = [
            ["pure", "UND", 10, 52, "Preparados"],
            ["arroz meloso", "UND", 8, 10, "Preparados"],
            ["arroz de lomo", "UND", 8, 6, "Preparados"],
            ["fettuccini", "UND", 10, 36, "Pastas"],
            ["fondo de cangrejo", "LITROS", 5, 4.6, "Fondos"],
            ["fondo de pato", "LITROS", 8, 22, "Fondos"],
            ["fondo de res", "LITROS", 8, 20.34, "Fondos"],
            ["salsa madrileña", "UND", 5, 10.8, "Salsas"],
            ["salsa fideua", "UND", 10, 32, "Salsas"],
            ["salsa Norteña", "UND", 10, 15, "Salsas"],
            ["salsa chupe", "UND", 5, 10, "Salsas"],
            ["mixtura", "UND", 15, 53, "Preparados"],
            ["langostino limpio", "KG", 2, 0, "Mariscos"],
            ["panceta", "UND", 10, 29, "Carnes"],
            ["garron", "UND", 10, 43, "Carnes"],
            ["carrillera", "UND", 15, 51, "Carnes"],
            ["lomo", "UND", 20, 83, "Carnes"],
            ["Magret de pato", "UND", 10, 1, "Carnes"],
            ["Panceta entera", "KG", 5, 0, "Carnes"],
            ["rabo de toro", "UND", 10, 58, "Carnes"]
        ];
        
        const stmt = db.prepare("INSERT INTO productos (nombre, unidad, stock_minimo, stock_actual, categoria) VALUES (?, ?, ?, ?, ?)");
        productos.forEach(p => {
            stmt.run(p);
        });
        stmt.free();
    }
}

// ============================================================
// Event Listeners
// ============================================================
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
        });
    });
    
    // Modals
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById(btn.dataset.close).classList.add('hidden');
        });
    });
    
    // Add buttons
    document.getElementById('btn-add-producto').addEventListener('click', () => {
        document.getElementById('modal-producto-title').textContent = 'Nuevo Producto';
        document.getElementById('form-producto').reset();
        document.getElementById('producto-id').value = '';
        document.getElementById('modal-producto').classList.remove('hidden');
    });
    
    document.getElementById('btn-add-movimiento').addEventListener('click', () => {
        document.getElementById('form-movimiento').reset();
        populateProductosSelect();
        document.getElementById('modal-movimiento').classList.remove('hidden');
    });
    
    // Forms
    document.getElementById('form-producto').addEventListener('submit', guardarProducto);
    document.getElementById('form-movimiento').addEventListener('submit', guardarMovimiento);
    
    // Search
    document.getElementById('search-productos').addEventListener('input', (e) => {
        cargarProductos(e.target.value);
    });
    
    document.getElementById('search-movimientos').addEventListener('input', (e) => {
        cargarMovimientos(e.target.value);
    });
    
    // Filter
    document.getElementById('filter-categoria').addEventListener('change', (e) => {
        cargarProductos('', e.target.value);
    });
    
    // Export
    document.getElementById('btn-export').addEventListener('click', exportarDatos);
}

// ============================================================
// Dashboard
// ============================================================
function actualizarDashboard() {
    const total = db.exec("SELECT COUNT(*) FROM productos")[0].values[0][0];
    const stockBajo = db.exec("SELECT COUNT(*) FROM productos WHERE stock_actual <= stock_minimo")[0].values[0][0];
    const totalStock = db.exec("SELECT COALESCE(SUM(stock_actual), 0) FROM productos")[0].values[0][0];
    const stockOk = total - stockBajo;
    
    document.getElementById('total-productos').textContent = total;
    document.getElementById('stock-bajo').textContent = stockBajo;
    document.getElementById('total-stock').textContent = totalStock.toFixed(1);
    document.getElementById('stock-ok').textContent = stockOk;
    
    // Categorías
    const cats = db.exec("SELECT categoria, COUNT(*), SUM(CASE WHEN stock_actual <= stock_minimo THEN 1 ELSE 0 END) FROM productos GROUP BY categoria");
    const catsGrid = document.getElementById('categorias-grid');
    catsGrid.innerHTML = '';
    
    if (cats.length > 0) {
        cats[0].values.forEach(([cat, count, bajo]) => {
            catsGrid.innerHTML += `
                <div class="categoria-card">
                    <div>
                        <div class="categoria-name">${cat}</div>
                        <div class="categoria-count">${count} productos</div>
                    </div>
                    ${bajo > 0 ? `<span class="categoria-badge danger">⚠ ${bajo}</span>` : ''}
                </div>
            `;
        });
    }
    
    // Stock bajo
    const stockBajoList = db.exec("SELECT * FROM productos WHERE stock_actual <= stock_minimo ORDER BY (stock_actual - stock_minimo)");
    const stockBajoDiv = document.getElementById('stock-bajo-list');
    stockBajoDiv.innerHTML = '';
    
    if (stockBajoList.length > 0 && stockBajoList[0].values.length > 0) {
        stockBajoList[0].values.forEach(([id, nombre, unidad, stockMin, stockAct, cat]) => {
            stockBajoDiv.innerHTML += `
                <div class="stock-item">
                    <div class="stock-item-info">
                        <div class="stock-item-name">${nombre}</div>
                        <div class="stock-item-detail">${cat} | Mínimo: ${stockMin} ${unidad}</div>
                    </div>
                    <span class="stock-item-badge">${stockAct} ${unidad}</span>
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
function cargarProductos(search = '', categoria = '') {
    let query = "SELECT * FROM productos WHERE 1=1";
    const params = [];
    
    if (search) {
        query += " AND nombre LIKE ?";
        params.push(`%${search}%`);
    }
    
    if (categoria) {
        query += " AND categoria = ?";
        params.push(categoria);
    }
    
    query += " ORDER BY categoria, nombre";
    
    const result = db.exec(query, params);
    const list = document.getElementById('productos-list');
    list.innerHTML = '';
    
    if (result.length > 0 && result[0].values.length > 0) {
        result[0].values.forEach(([id, nombre, unidad, stockMin, stockAct, cat]) => {
            const esBajo = stockAct <= stockMin;
            list.innerHTML += `
                <div class="producto-card ${esBajo ? 'stock-bajo' : 'stock-ok'}">
                    <div class="producto-info">
                        <div class="producto-name">${nombre}</div>
                        <div class="producto-detail">${cat} | ${unidad} | Mín: ${stockMin}</div>
                    </div>
                    <div class="producto-stock">
                        <div class="producto-stock-value" style="color: ${esBajo ? 'var(--red)' : 'var(--green)'}">${stockAct}</div>
                        <div class="producto-stock-min">${unidad}</div>
                    </div>
                    <div class="producto-actions">
                        <button class="btn-edit" onclick="editarProducto(${id})">✏️</button>
                        <button class="btn-delete" onclick="eliminarProducto(${id}, '${nombre}')">🗑️</button>
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
        db.run("UPDATE productos SET nombre=?, unidad=?, stock_minimo=?, categoria=? WHERE id=?", 
               [nombre, unidad, stockMin, categoria, parseInt(id)]);
        showToast('Producto actualizado');
    } else {
        db.run("INSERT INTO productos (nombre, unidad, stock_minimo, stock_actual, categoria) VALUES (?, ?, ?, ?, ?)",
               [nombre, unidad, stockMin, stockAct, categoria]);
        showToast('Producto agregado');
    }
    
    await guardarDB();
    document.getElementById('modal-producto').classList.add('hidden');
    cargarProductos();
    actualizarDashboard();
    actualizarAlertas();
}

function editarProducto(id) {
    const result = db.exec("SELECT * FROM productos WHERE id=?", [id]);
    if (result.length > 0 && result[0].values.length > 0) {
        const [_, nombre, unidad, stockMin, stockAct, cat] = result[0].values[0];
        
        document.getElementById('modal-producto-title').textContent = 'Editar Producto';
        document.getElementById('producto-id').value = id;
        document.getElementById('producto-nombre').value = nombre;
        document.getElementById('producto-unidad').value = unidad;
        document.getElementById('producto-categoria').value = cat;
        document.getElementById('producto-stock-min').value = stockMin;
        document.getElementById('producto-stock-act').value = stockAct;
        
        document.getElementById('modal-producto').classList.remove('hidden');
    }
}

async function eliminarProducto(id, nombre) {
    if (confirm(`¿Eliminar "${nombre}"?`)) {
        db.run("DELETE FROM productos WHERE id=?", [id]);
        db.run("DELETE FROM movimientos WHERE producto_id=?", [id]);
        await guardarDB();
        cargarProductos();
        actualizarDashboard();
        actualizarAlertas();
        showToast('Producto eliminado');
    }
}

// ============================================================
// Movimientos
// ============================================================
function populateProductosSelect() {
    const select = document.getElementById('movimiento-producto');
    select.innerHTML = '';
    
    const result = db.exec("SELECT id, nombre, unidad, stock_actual FROM productos ORDER BY nombre");
    if (result.length > 0) {
        result[0].values.forEach(([id, nombre, unidad, stock]) => {
            select.innerHTML += `<option value="${id}">${nombre} (${stock} ${unidad})</option>`;
        });
    }
}

function cargarMovimientos(search = '') {
    let query = `
        SELECT m.id, p.nombre, p.unidad, m.tipo, m.cantidad, m.fecha, m.observaciones 
        FROM movimientos m 
        JOIN productos p ON m.producto_id = p.id
    `;
    const params = [];
    
    if (search) {
        query += " WHERE p.nombre LIKE ?";
        params.push(`%${search}%`);
    }
    
    query += " ORDER BY m.id DESC LIMIT 50";
    
    const result = db.exec(query, params);
    const list = document.getElementById('movimientos-list');
    list.innerHTML = '';
    
    if (result.length > 0 && result[0].values.length > 0) {
        result[0].values.forEach(([id, nombre, unidad, tipo, cantidad, fecha, obs]) => {
            const esEntrada = tipo === 'Entrada';
            list.innerHTML += `
                <div class="movimiento-card">
                    <div class="movimiento-icon ${esEntrada ? 'entrada' : 'salida'}">
                        ${esEntrada ? '📥' : '📤'}
                    </div>
                    <div class="movimiento-info">
                        <div class="movimiento-producto">${nombre}</div>
                        <div class="movimiento-detail">${fecha} ${obs ? '- ' + obs : ''}</div>
                    </div>
                    <div class="movimiento-cantidad ${esEntrada ? 'entrada' : 'salida'}">
                        ${esEntrada ? '+' : '-'}${cantidad} ${unidad}
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
    
    // Verificar stock para salidas
    if (tipo === 'Salida') {
        const result = db.exec("SELECT stock_actual FROM productos WHERE id=?", [productoId]);
        const stockActual = result[0].values[0][0];
        
        if (cantidad > stockActual) {
            showToast(`Stock insuficiente. Actual: ${stockActual}`, true);
            return;
        }
    }
    
    // Registrar movimiento
    const fecha = new Date().toLocaleString('es-CL');
    db.run("INSERT INTO movimientos (producto_id, tipo, cantidad, fecha, observaciones) VALUES (?, ?, ?, ?, ?)",
           [productoId, tipo, cantidad, fecha, obs]);
    
    // Actualizar stock
    if (tipo === 'Entrada') {
        db.run("UPDATE productos SET stock_actual = stock_actual + ? WHERE id=?", [cantidad, productoId]);
    } else {
        db.run("UPDATE productos SET stock_actual = stock_actual - ? WHERE id=?", [cantidad, productoId]);
    }
    
    await guardarDB();
    document.getElementById('modal-movimiento').classList.add('hidden');
    cargarMovimientos();
    cargarProductos();
    actualizarDashboard();
    actualizarAlertas();
    showToast(`Movimiento registrado: ${tipo} de ${cantidad}`);
}

// ============================================================
// Alertas
// ============================================================
function actualizarAlertas() {
    const result = db.exec("SELECT * FROM productos WHERE stock_actual <= stock_minimo ORDER BY (stock_actual - stock_minimo)");
    const list = document.getElementById('alertas-list');
    const badge = document.getElementById('badge-alertas');
    
    const count = result.length > 0 ? result[0].values.length : 0;
    
    if (count > 0) {
        badge.textContent = count;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
    
    list.innerHTML = '';
    
    if (count > 0) {
        result[0].values.forEach(([id, nombre, unidad, stockMin, stockAct, cat]) => {
            const diferencia = stockMin - stockAct;
            list.innerHTML += `
                <div class="alerta-item">
                    <div class="stock-item-info">
                        <div class="stock-item-name">${nombre}</div>
                        <div class="stock-item-detail">${cat} | Actual: ${stockAct} ${unidad} | Mínimo: ${stockMin} ${unidad}</div>
                        <div class="stock-item-detail" style="color: var(--red)">Necesita: ${diferencia.toFixed(1)} ${unidad}</div>
                    </div>
                    <button class="btn-primary" onclick="agregarEntradaRapida(${id})">+ Agregar</button>
                </div>
            `;
        });
    } else {
        list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✅</div><p>No hay alertas de stock bajo</p></div>';
    }
}

function agregarEntradaRapida(productoId) {
    populateProductosSelect();
    
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
function exportarDatos() {
    const productos = db.exec("SELECT * FROM productos ORDER BY categoria, nombre");
    const movimientos = db.exec("SELECT * FROM movimientos ORDER BY id DESC");
    
    let csv = 'INVENTARIO CONGELADORA - Exportado: ' + new Date().toLocaleString('es-CL') + '\n\n';
    csv += 'PRODUCTOS:\n';
    csv += 'ID,Nombre,Unidad,Stock Mínimo,Stock Actual,Categoría\n';
    
    if (productos.length > 0) {
        productos[0].values.forEach(row => {
            csv += row.join(',') + '\n';
        });
    }
    
    csv += '\nMOVIMIENTOS:\n';
    csv += 'ID,Producto ID,Tipo,Cantidad,Fecha,Observaciones\n';
    
    if (movimientos.length > 0) {
        movimientos[0].values.forEach(row => {
            csv += row.join(',') + '\n';
        });
    }
    
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
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
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
