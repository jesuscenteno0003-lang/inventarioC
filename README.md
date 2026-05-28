# Inventario Cocina - PWA (App Móvil)

## Cómo instalar en tu celular:

### Android (Chrome):
1. Abre Chrome en tu celular
2. Escribe la dirección del servidor donde está la app
3. Toca el menú (3 puntos) → "Instalar app" o "Agregar a pantalla de inicio"
4. ¡Listo! La app aparecerá en tu pantalla de inicio

### iPhone (Safari):
1. Abre Safari en tu iPhone
2. Navega a la app
3. Toca el botón de compartir (cuadro con flecha)
4. Selecciona "Agregar a pantalla de inicio"
5. Ponle nombre y toca "Agregar"
6. ¡Listo! La app aparecerá en tu pantalla

---

## Características:
- ✅ Funciona sin internet (offline)
- ✅ Se instala como app nativa
- ✅ Base de datos SQLite local
- ✅ Alertas de stock bajo
- ✅ Exportar datos a CSV
- ✅ Diseño táctil optimizado

---

## Cómo usar en tu red local:

### Opción 1: Python (recomendado)
```bash
cd C:\Users\steven\inventario-cocina\pwa
python -m http.server 8000
```

Luego en tu celular: `http://[tu-ip]:8000`

### Opción 2: Node.js
```bash
npx serve pwa
```

### Opción 3: Live Server (VS Code)
1. Instala extensión "Live Server"
2. Clic derecho en index.html → "Open with Live Server"

---

## Encontrar tu IP:
```bash
ipconfig
```
Busca "Dirección IPv4" (ej: 192.168.1.100)

---

## Datos precargados:
- 20 productos de congeladora
- Categorías: Carnes, Salsas, Fondos, Preparados, Pastas, Mariscos
- Stock con alertas automáticas
