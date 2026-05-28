-- Crear tabla usuarios compartida
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nombre TEXT UNIQUE NOT NULL,
    ultimo_acceso TIMESTAMPTZ DEFAULT NOW(),
    activo BOOLEAN DEFAULT TRUE
);

-- Políticas RLS: permitir todo desde anon key (sin auth)
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all" ON usuarios;
CREATE POLICY "anon_all" ON usuarios
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Insertar usuarios existentes desde movimientos (los que ya han hecho cambios)
INSERT INTO usuarios (nombre, ultimo_acceso, activo)
SELECT DISTINCT usuario, NOW(), TRUE FROM movimientos WHERE usuario IS NOT NULL AND usuario != 'Anónimo' AND usuario != 'Mobile'
ON CONFLICT (nombre) DO NOTHING;
