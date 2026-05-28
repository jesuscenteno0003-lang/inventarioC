-- ============================================
-- INVENTARIO CONGELADORA - Supabase
-- Copia y pega todo esto en SQL Editor de Supabase
-- ============================================

-- Tabla de productos
CREATE TABLE IF NOT EXISTS productos (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  unidad TEXT DEFAULT 'UND',
  stock_minimo REAL DEFAULT 5,
  stock_actual REAL DEFAULT 0,
  categoria TEXT DEFAULT 'General',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de movimientos
CREATE TABLE IF NOT EXISTS movimientos (
  id BIGSERIAL PRIMARY KEY,
  producto_id BIGINT REFERENCES productos(id) ON DELETE CASCADE,
  tipo TEXT,
  cantidad REAL,
  fecha TEXT,
  usuario TEXT DEFAULT 'Mobile',
  observaciones TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Habilitar acceso público (RLS)
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos ENABLE ROW LEVEL SECURITY;

-- Políticas públicas (para PWA sin auth)
CREATE POLICY "Productos públicos" ON productos FOR ALL USING (true);
CREATE POLICY "Movimientos públicos" ON movimientos FOR ALL USING (true);

-- Datos iniciales
INSERT INTO productos (nombre, unidad, stock_minimo, stock_actual, categoria) VALUES
('pure', 'UND', 10, 52, 'Preparados'),
('arroz meloso', 'UND', 8, 10, 'Preparados'),
('arroz de lomo', 'UND', 8, 6, 'Preparados'),
('fettuccini', 'UND', 10, 36, 'Pastas'),
('fondo de cangrejo', 'LITROS', 5, 4.6, 'Fondos'),
('fondo de pato', 'LITROS', 8, 22, 'Fondos'),
('fondo de res', 'LITROS', 8, 20.34, 'Fondos'),
('salsa madrileña', 'UND', 5, 10.8, 'Salsas'),
('salsa fideua', 'UND', 10, 32, 'Salsas'),
('salsa Norteña', 'UND', 10, 15, 'Salsas'),
('salsa chupe', 'UND', 5, 10, 'Salsas'),
('mixtura', 'UND', 15, 53, 'Preparados'),
('langostino limpio', 'KG', 2, 0, 'Mariscos'),
('panceta', 'UND', 10, 29, 'Carnes'),
('garron', 'UND', 10, 43, 'Carnes'),
('carrillera', 'UND', 15, 51, 'Carnes'),
('lomo', 'UND', 20, 83, 'Carnes'),
('Magret de pato', 'UND', 10, 1, 'Carnes'),
('Panceta entera', 'KG', 5, 0, 'Carnes'),
('rabo de toro', 'UND', 10, 58, 'Carnes');
