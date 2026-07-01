# Gym Reserver API

Esta es una API basada en **Express** y **Playwright** diseñada para automatizar la reserva diaria en el gimnasio del **C.D. Díaz Flor** (Sala Cardio-Fitness) de Ceuta. 

El servicio está estructurado para ejecutarse 24/7 en un servidor (por ejemplo, mediante Docker en EasyPanel) y ser invocado mediante un webhook programado en n8n cada mañana.

---

## 🛠️ Tecnologías y Estructura

- **Core**: Node.js v22
- **Framework**: Express (Servidor API)
- **Automatización**: Playwright (Chromium headless)
- **Despliegue**: Dockerfile multietapa optimizado para Playwright
- **Control**: Git

---

## 🚀 Endpoints de la API

La API requiere autenticación mediante una cabecera `Authorization` utilizando un token Bearer.

### 1. Estado del Servidor
Verifica si el servicio está activo y respondiendo.

- **Método**: `GET`
- **Ruta**: `/health`
- **Autenticación**: Ninguna
- **Respuesta (JSON)**:
  ```json
  {
    "ok": true,
    "service": "gym-reserver-api",
    "status": "online"
  }
  ```

### 2. Ejecutar Reserva
Inicia el proceso automatizado de reserva.

- **Método**: `POST`
- **Ruta**: `/reservar`
- **Autenticación**: `Bearer <API_KEY>`
- **Cuerpo (JSON - Opcional)**:
  ```json
  {
    "dryRun": true
  }
  ```
  *Nota: Si se envía `"dryRun": true`, el script hará todo el flujo de reserva (incluido el inicio de sesión, selección de hora, aplicación de descuento Carnet Joven y marcaje de normativa), pero se detendrá justo antes de confirmar el pago y la reserva final. Esto sirve para validar el flujo de forma segura.*

- **Respuesta Exitosa (JSON)**:
  ```json
  {
    "ok": true,
    "message": "Proceso terminado correctamente",
    "dryRun": true,
    "stdout": "...",
    "stderr": "..."
  }
  ```

---

## ⚙️ Configuración (.env)

Crea un archivo `.env` en la raíz del proyecto con la siguiente configuración:

```env
GYM_URL=https://reservasicd.ceuta.es/a2SportWeb/
GYM_DNI=TU_DNI
GYM_PASSWORD=TU_PASSWORD
TARGET_TIME=09:00 - 10:00
DRY_RUN=true
HEADLESS=true
PORT=3000
API_KEY=pon_una_clave_larga_y_segura
TZ=Europe/Madrid
```

---

## 💻 Desarrollo Local

### 1. Instalar dependencias
```bash
npm install
```

### 2. Instalar navegadores de Playwright (con dependencias)
```bash
npx playwright install --with-deps chromium
```

### 3. Iniciar el servidor API
```bash
npm start
```
*El servidor API escuchará en el puerto configurado en el archivo `.env`.*

### 4. Lanzar script de reserva de manera directa (CLI)
```bash
npm run reserve
```

---

## 🐳 Docker (Despliegue)

El proyecto incluye un `Dockerfile` optimizado para entornos headless.

### Construir Imagen
```bash
docker build -t gym-reserver-api .
```

### Ejecutar Contenedor
```bash
docker run --rm -p 3000:3000 --env-file .env gym-reserver-api
```

---

## 🤖 Integración con EasyPanel y n8n

### Despliegue en EasyPanel
1. Conecta tu repositorio privado de GitHub a EasyPanel.
2. Crea un nuevo servicio tipo **App**.
3. Configura el **Puerto interno** en `3000`.
4. Agrega todas las variables de entorno de tu archivo `.env` en la pestaña **Environment**.

### Automatización con n8n
Crea un flujo de trabajo diario (por ejemplo, a las **05:00** de Madrid) con el siguiente flujo:
1. **Schedule Trigger**: Programado a las `05:00` (Zona horaria `Europe/Madrid`).
2. **HTTP Request**:
   - **Method**: `POST`
   - **URL**: `https://tu-dominio-easypanel.com/reservar`
   - **Headers**:
     - `Authorization`: `Bearer TU_API_KEY`
   - **Body (JSON)**:
     ```json
     {
       "dryRun": false
     }
     ```
3. **Telegram (Opcional)**: Enviar mensaje con el estado (`ok: true` / `ok: false`) devuelto por la API.
