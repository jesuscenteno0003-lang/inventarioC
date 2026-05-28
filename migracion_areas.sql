-- ============================================
-- MIGRACIÓN: Agregar áreas a Inventario
-- Pega esto en SQL Editor de Supabase
-- ============================================

-- Agregar columna area a productos
ALTER TABLE productos ADD COLUMN IF NOT EXISTS area TEXT DEFAULT 'Calientes';

-- Actualizar productos existentes (los que ya tienes)
UPDATE productos SET area = 'Calientes' WHERE area IS NULL;

-- Insertar productos para Área Parrillas
INSERT INTO productos (nombre, unidad, stock_minimo, stock_actual, categoria, area) VALUES
('Lomo fino', 'KG', 5, 10, 'Carnes', 'Parrillas'),
('Pechuga de pollo', 'KG', 8, 15, 'Carnes', 'Parrillas'),
('Chorizo', 'UND', 20, 40, 'Carnes', 'Parrillas'),
('Entraña', 'KG', 5, 8, 'Carnes', 'Parrillas'),
('Picana', 'KG', 3, 6, 'Carnes', 'Parrillas'),
('Papas nativas', 'KG', 10, 20, 'Verduras', 'Parrillas'),
('Choclo', 'UND', 15, 30, 'Verduras', 'Parrillas'),
('Salchicha', 'UND', 30, 50, 'Carnes', 'Parrillas');

-- Insertar productos para Área Fríos
INSERT INTO productos (nombre, unidad, stock_minimo, stock_actual, categoria, area) VALUES
('Lechuga', 'UND', 10, 20, 'Verduras', 'Fríos'),
('Tomate', 'KG', 5, 12, 'Verduras', 'Fríos'),
('Cebolla', 'KG', 10, 25, 'Verduras', 'Fríos'),
('Queso fresco', 'KG', 3, 5, 'Lácteos', 'Fríos'),
('Crema de leche', 'LITROS', 5, 10, 'Lácteos', 'Fríos'),
('Mantequilla', 'KG', 2, 4, 'Lácteos', 'Fríos'),
('Huevos', 'UND', 30, 60, 'Lácteos', 'Fríos'),
('Pechuga de pavo', 'KG', 3, 5, 'Carnes', 'Fríos'),
('Jamón', 'KG', 3, 6, 'Carnes', 'Fríos'),
('Yogurt', 'LITROS', 3, 8, 'Lácteos', 'Fríos');

-- Actualizar productos existentes a sus áreas según categoría
UPDATE productos SET area = 'Parrillas' WHERE categoria = 'Carnes' AND area = 'Calientes' AND nombre IN ('lomo', 'panceta', 'garron');
UPDATE productos SET area = 'Fríos' WHERE categoria IN ('Lácteos', 'Verduras') AND area = 'Calientes';
