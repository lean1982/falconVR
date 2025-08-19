# WebXR Falcon — Mobile Fix

**Qué cambia respecto a la versión anterior**
- Joysticks táctiles ahora están **por encima del canvas** (z-index alto).
- Detección de mobile más robusta (touch, maxTouchPoints, pointer:coarse).
- Añadí **"swipe para mirar"** en toda la pantalla cuando no tocás un joystick.
- `touch-action: none` global y listeners `passive:false` donde corresponde.
- Panel/HUD minimizados y reubicados para no tapar los joysticks.

**Cómo usar**
1. Poné tu modelo en `assets/falcon.glb`.
2. `http-server -p 8080`
3. Abrí la IP desde tu **teléfono**: `http://<IP-de-tu-PC>:8080`
4. Probá mover con joystick izquierdo y mirar con el derecho o con **swipe** en pantalla.

Si aún no ves movimiento en mobile, probá **actualizar con hard refresh** (limpiar cache) y confirmame modelo de teléfono/navegador para afinar detección.
