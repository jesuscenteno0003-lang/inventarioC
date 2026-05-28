-- Corregir: Eliminar políticas existentes y recrear
DROP POLICY IF EXISTS "Productos publicos" ON productos;
DROP POLICY IF EXISTS "Movimientos publicos" ON movimientos;

-- Recrear políticas
CREATE POLICY "Productos publicos" ON productos FOR ALL USING (true);
CREATE POLICY "Movimientos publicos" ON movimientos FOR ALL USING (true);
