# Puzzle Adventure

Juego de rompecabezas móvil construido con Phaser 3, TypeScript y Vite.

## Demo (GitHub Pages)

- **URL**: `https://jsborjaa.github.io/PuzzleAdventure/`

## Estructura del Proyecto

- `src/core`: Configuración del juego.
- `src/scenes`: Escenas (Boot, Menu, Game, UI).
- `src/objects`: Entidades de juego (Piece).
- `src/services`: Lógica de negocio (ImageSplitter, AudioService).
- `src/ui`: Elementos HTML/CSS.

## Instalación y Ejecución

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Ejecutar en modo desarrollo:
   ```bash
   npm run dev
   ```

3. Abrir el navegador en la URL mostrada (generalmente http://localhost:5173).

## Controles

- **Arrastrar**: Mover piezas.
- **Click Derecho**: Rotar pieza.
- **Rueda del Ratón**: Zoom en el tablero.
- **Arrastrar Fondo**: Mover cámara.

## Arquitectura

El juego utiliza una arquitectura híbrida:
- **Phaser (Canvas/WebGL)**: Renderizado de alto rendimiento para las piezas y el tablero.
- **DOM (HTML/CSS)**: Interfaz de usuario (HUD) superpuesta para mayor nitidez y accesibilidad.
- **Servicios**: `ImageSplitter` (generación de piezas) y `AudioService` (sonido procedural) desacoplados de las escenas.

## Próximos Pasos (Mobile)

Para exportar a Android/iOS:
1. Instalar Capacitor: `npm install @capacitor/core @capacitor/cli`
2. Inicializar: `npx cap init`
3. Build: `npm run build`
4. Sync: `npx cap add android`

