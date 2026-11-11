# 🌱 AgroSahagún

> Sistema de monitoreo, analítica y decisiones agrícolas para la Vereda Salguerito (Sahagún, Córdoba, Colombia) con persistencia en tiempo real en **Firebase Realtime Database** y arquitectura **Offline-First**.

---

## 📋 Resumen del Proyecto

AgroSahagún es una solución web moderna e interactiva diseñada para asistir a agricultores y técnicos agrícolas en la gestión eficiente del recurso hídrico, bitácora de campo en tiempo real y cálculo de requerimientos de riego mediante la metodología estándar **FAO-56**.

El sistema está optimizado para operar en condiciones de conectividad intermitente o nula en zonas rurales, manteniendo una caché local resiliente y una cola de mutaciones atómicas que se sincronizan con la nube de Google Firebase de forma transparente al recuperar cobertura.

---

## 🚀 Arquitectura y Modularización

El código ha sido completamente refactorizado y desacoplado en módulos especializados bajo el estándar **ES6 Modules**:

```
index.html                       # Punto de entrada
css.styles.css                   # Estilos
core.app.js                      # Controlador principal
config.firebase-config.js        # Configuración de Firebase
data.crop-catalog.js             # Catálogo de cultivos
modules.export-service.js        # Exportación de reportes
modules.sensors-simulator.js     # Simulador de sensores
services.agronomy-service.js     # Cálculos agronómicos
services.auth-service.js         # Login, roles y usuarios
services.firebase-service.js     # Sincronización con Firebase
services.storage-service.js      # Caché local y cola offline
ui.auth-ui.js                    # Login y panel de usuarios
ui.ui-manager.js                 # Interfaz
tests.agronomy-and-sync.test.js  # Pruebas
database.rules.json              # Reglas de seguridad de Firebase
setup-admin.mjs                  # Crea el primer administrador
```
Todos los archivos están en la misma carpeta; el prefijo antes del primer punto indica el grupo.

---

## ⚡ Refactorización de la Persistencia en Firebase

### 1. Operaciones Granulares vs. Sobrescritura Masiva
* **Antes:** Cada registro o modificación ejecutaba `database.ref('agrosahagun_db').set({ crops, logs })`, sobrescribiendo toda la base de datos, transmitiendo arreglos enteros y arriesgando pérdida de datos ante accesos concurrentes.
* **Ahora:** Cada operación utiliza rutas atómicas y granulares:
  * Guardado de cultivo: `agrosahagun_db/crops/{cropId}`
  * Eliminación de cultivo: `agrosahagun_db/crops/{cropId}.remove()`
  * Registro de campo: `agrosahagun_db/logs/{logId}`
  * Sincronización en lote: `database.ref().update(updates)` (actualización multi-ruta atómica).

### 2. Normalización Bidireccional
La aplicación es compatible tanto con estructuras de datos en formato arreglo (legadas) como en formato mapa/objeto llave-valor:
```javascript
normalizeCollection(data)
```
Convierte de forma segura cualquier respuesta de Firebase a arreglos enriquecidos con su `id` unívoco.

### 3. Fusión Anti-Sobrescritura (*Conflict-Free Merge*)
Al recibir un snapshot remoto en vivo (`on('value')`), el servicio combina inteligentemente los datos de la nube con cualquier registro local no sincronizado (`synced: false`), evitando que una respuesta remota borre registros tomados fuera de línea.

### 4. Detección Nativa de Conectividad y Simulador
* Escucha reactiva de `.info/connected` provista por Firebase Realtime Database.
* Soporte a eventos del navegador (`window.ononline` y `window.onoffline`).
* **Simulador de señal celular integrado:** permite desconectar la red deliberadamente (`database.goOffline()`) para validar el comportamiento en campo y reanudarla (`database.goOnline()`) con sincronización automática de la cola.

---

## 🌾 Motor Analítico Agronómico (FAO-56)

El sistema calcula dinámicamente la **Evapotranspiración del Cultivo ($ET_c$)**:

$$ET_c = K_c \times ET_0$$

* **$ET_0$ de referencia:** $5.2\text{ mm/día}$ (Promedio histórico representativo de Sahagún, Córdoba).
* **Coeficiente $K_c$ dinámico:** Ajustado según la fase fenológica:
  * *Preparación / Siembra:* Factor $0.50$
  * *Desarrollo vegetativo:* Factor $0.80$
  * *Floración / Fructificación:* Factor $1.10$
  * *Cosecha:* Factor $0.70$
* **Lámina y volumen de reposición hídrica:**
  $$\text{Volumen por Hectárea } (m^3/\text{ha/día}) = ET_c \times 10$$
  $$\text{Volumen Total del Lote } (m^3/\text{día}) = \text{Volumen por Hectárea} \times \text{Área Sembrada (ha)}$$

---

## 🔐 Acceso y usuarios

La app exige iniciar sesión (Firebase Authentication, correo + contraseña). Roles:

| Rol | Puede |
|---|---|
| **Administrador** | Todo, más crear usuarios, cambiar rol, desactivar y reiniciar contraseñas (pestaña *Usuarios*) |
| **Operario** | Gestionar cultivos y registros de campo |

### Puesta en marcha (una sola vez)
1. Firebase Console → **Authentication → Sign-in method** → habilita *Correo/contraseña*.
2. **Authentication → Users → Add user**: crea tu cuenta de administrador y copia su **UID**.
3. **Realtime Database → Data**: crea el nodo `agrosahagun_db/users/<UID>` con
   `{ "name": "Tu nombre", "email": "tu@correo.com", "role": "admin", "active": true }`.
4. **Realtime Database → Rules**: pega el contenido de [`database.rules.json`](database.rules.json) y publica.
5. **Authentication → Settings → Authorized domains**: agrega tu dominio de GitHub Pages (`usuario.github.io`).

Desde ahí, el administrador crea al resto de usuarios dentro de la app.

### Seguridad
* La configuración web de Firebase (`firebase-config.js`) es pública por diseño; **lo que protege los datos son las reglas**. Publícalas antes de compartir el repo.
* Recomendado: restringe la API key por referrer HTTP (Google Cloud Console → Credenciales).
* Un usuario desactivado pierde el acceso a los datos de inmediato (lo exigen las reglas, no solo la interfaz).
* Las cuentas se crean con una app secundaria de Firebase para no cerrar la sesión del administrador.

---

## 🛠️ Ejecución Local y Pruebas

### Requisitos
* Navegador web moderno (Chrome, Edge, Firefox, Safari).
* Node.js v20+ o Python 3 (para servir localmente vía HTTP).

### Iniciar el servidor local
Debido a que el proyecto utiliza módulos estándar ECMAScript (`type="module"`), debe ser servido bajo un protocolo HTTP (para evitar restricciones CORS de `file://`):

```bash
# Con npm (utiliza Python 3):
npm start

# O directamente con Python:
python3 -m http.server 8080

# O con npx serve:
npx serve .
```
Abre en tu navegador: [http://localhost:8080](http://localhost:8080)

### Ejecutar pruebas unitarias
```bash
npm test
```

---

## 📄 Licencia
Este proyecto está bajo la Licencia MIT.
