Perfecto. Ahora tienes que pasar de **script local** a **API desplegada 24/7**. La ruta será:

```text
reserve.js funcionando en local
↓
server.js con Express
↓
Dockerfile con Playwright
↓
GitHub privado
↓
EasyPanel
↓
n8n llamando a la API todos los días
```

EasyPanel puede desplegar apps desde un repositorio de GitHub y, si el repo tiene `Dockerfile`, construye la imagen usando ese Dockerfile. ([Easypanel][1]) Para Playwright, conviene usar Docker porque el navegador Chromium y sus dependencias deben estar disponibles en el servidor. ([Playwright][2])

---

# 1. Instala Express en tu proyecto local

En PowerShell, dentro de la carpeta de tu proyecto:

```powershell
npm install express
```

---

# 2. Crea `server.js`

En la raíz del proyecto crea:

```text
server.js
```

Pega esto:

```js
require('dotenv').config();

const express = require('express');
const { spawn } = require('child_process');

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;

let isRunning = false;

function checkAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!API_KEY) {
    return res.status(500).json({
      ok: false,
      error: 'API_KEY no está configurada en el servidor'
    });
  }

  if (authHeader !== `Bearer ${API_KEY}`) {
    return res.status(401).json({
      ok: false,
      error: 'No autorizado'
    });
  }

  next();
}

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'gym-reserver-api',
    status: 'online'
  });
});

app.post('/reservar', checkAuth, async (req, res) => {
  if (isRunning) {
    return res.status(409).json({
      ok: false,
      error: 'Ya hay una reserva en ejecución'
    });
  }

  isRunning = true;

  const dryRunFromBody = req.body?.dryRun;

  const env = {
    ...process.env,
    DRY_RUN:
      typeof dryRunFromBody === 'boolean'
        ? String(dryRunFromBody)
        : process.env.DRY_RUN || 'true'
  };

  console.log('Iniciando reserva...');
  console.log(`DRY_RUN=${env.DRY_RUN}`);

  const child = spawn(process.execPath, ['reserve.js'], {
    env
  });

  let stdout = '';
  let stderr = '';

  const timeout = setTimeout(() => {
    child.kill('SIGKILL');
  }, 180000);

  child.stdout.on('data', (data) => {
    const text = data.toString();
    stdout += text;
    console.log(text);
  });

  child.stderr.on('data', (data) => {
    const text = data.toString();
    stderr += text;
    console.error(text);
  });

  child.on('close', (code) => {
    clearTimeout(timeout);
    isRunning = false;

    if (code === 0) {
      return res.json({
        ok: true,
        message: 'Proceso terminado correctamente',
        dryRun: env.DRY_RUN === 'true',
        stdout,
        stderr
      });
    }

    return res.status(500).json({
      ok: false,
      message: 'El proceso falló',
      exitCode: code,
      stdout,
      stderr
    });
  });
});

app.listen(PORT, () => {
  console.log(`Gym reserver API escuchando en puerto ${PORT}`);
});
```

---

# 3. Revisa tu `.env` local

De momento déjalo en modo seguro:

```env
GYM_URL=https://reservasicd.ceuta.es/a2SportWeb/
GYM_DNI=TU_DNI
GYM_PASSWORD=TU_PASSWORD
TARGET_TIME=9:00 - 10:00
DRY_RUN=true
HEADLESS=false
PORT=3000
API_KEY=pon_una_clave_larga_y_segura
TZ=Europe/Madrid
```

En local usamos:

```env
HEADLESS=false
DRY_RUN=true
```

En producción usaremos:

```env
HEADLESS=true
DRY_RUN=true
```

Primero se despliega en prueba. Luego se cambia a `DRY_RUN=false`.

---

# 4. Prueba la API en local

Arranca la API:

```powershell
node server.js
```

En otra terminal prueba el estado:

```powershell
curl http://localhost:3000/health
```

Debería responder algo como:

```json
{
  "ok": true,
  "service": "gym-reserver-api",
  "status": "online"
}
```

Ahora prueba la reserva en modo seguro:

```powershell
curl -X POST http://localhost:3000/reservar `
  -H "Authorization: Bearer pon_una_clave_larga_y_segura" `
  -H "Content-Type: application/json" `
  -d "{\"dryRun\": true}"
```

Esto debería abrir Playwright y llegar hasta el formulario final sin reservar. Tu flujo ya sabemos que corresponde con la reserva de **C.D. DIAZ FLOR**, **SALA CARDIO-FITNESS**, hora **9:00 - 10:00**, bono y descuento de Carnet Joven. 

---

# 5. Prepara `package.json`

Abre tu `package.json` y asegúrate de tener algo parecido:

```json
{
  "name": "gym-reserver-api",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "reserve": "node reserve.js"
  },
  "dependencies": {
    "dotenv": "^16.4.7",
    "express": "^4.18.3",
    "playwright": "^1.54.0"
  }
}
```

No pasa nada si las versiones son distintas. Lo importante es que tengas:

```json
"start": "node server.js"
```

---

# 6. Crea `.dockerignore`

Crea un archivo:

```text
.dockerignore
```

Con esto:

```gitignore
node_modules
.env
screenshots
.git
recorded-test.spec.js
```

---

# 7. Crea `Dockerfile`

Crea un archivo llamado:

```text
Dockerfile
```

Pega esto:

```dockerfile
FROM node:22-bookworm

WORKDIR /app

COPY package*.json ./

RUN npm ci || npm install

RUN npx playwright install --with-deps chromium

COPY . .

ENV NODE_ENV=production
ENV HEADLESS=true
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
```

Este Dockerfile instala Node, tus dependencias y Chromium con las dependencias necesarias para que Playwright funcione dentro del contenedor.

---

# 8. Prueba Docker en local

Desde la carpeta del proyecto:

```powershell
docker build -t gym-reserver-api .
```

Luego ejecútalo:

```powershell
docker run --rm -p 3000:3000 `
  -e GYM_URL="https://reservasicd.ceuta.es/a2SportWeb/" `
  -e GYM_DNI="TU_DNI" `
  -e GYM_PASSWORD="TU_PASSWORD" `
  -e TARGET_TIME="9:00 - 10:00" `
  -e DRY_RUN="true" `
  -e HEADLESS="true" `
  -e API_KEY="pon_una_clave_larga_y_segura" `
  -e TZ="Europe/Madrid" `
  gym-reserver-api
```

Prueba:

```powershell
curl -X POST http://localhost:3000/reservar `
  -H "Authorization: Bearer pon_una_clave_larga_y_segura" `
  -H "Content-Type: application/json" `
  -d "{\"dryRun\": true}"
```

Si esto funciona, ya está listo para EasyPanel.

---

# 9. Sube el proyecto a GitHub privado

Asegúrate de que `.env` **no** se sube.

```powershell
git init
git add .
git commit -m "API reserva gimnasio con Playwright"
git branch -M main
git remote add origin URL_DE_TU_REPO_PRIVADO
git push -u origin main
```

Antes de hacer push, comprueba:

```powershell
git status
```

No debe aparecer `.env`.

---

# 10. Crear app en EasyPanel

En EasyPanel:

1. Entra en tu panel.
2. Crea un nuevo **Project** o usa uno existente.
3. Añade un nuevo servicio tipo **App**.
4. Source: **GitHub repository**.
5. Selecciona tu repo privado.
6. Branch: `main`.
7. EasyPanel detectará el `Dockerfile` y construirá la imagen desde tu código. ([Easypanel][1])
8. Puerto interno:

```text
3000
```

9. Start command: no hace falta si usa el Dockerfile, pero si te lo pide:

```text
npm start
```

---

# 11. Variables de entorno en EasyPanel

En la sección de Environment / Variables añade:

```env
GYM_URL=https://reservasicd.ceuta.es/a2SportWeb/
GYM_DNI=TU_DNI
GYM_PASSWORD=TU_PASSWORD
TARGET_TIME=9:00 - 10:00
DRY_RUN=true
HEADLESS=true
PORT=3000
API_KEY=pon_una_clave_larga_y_segura
TZ=Europe/Madrid
```

Primero deja:

```env
DRY_RUN=true
```

No pongas todavía `false`.

---

# 12. Añade dominio o subdominio

Ejemplo:

```text
gym-api.tudominio.com
```

En EasyPanel, asigna ese dominio al servicio.

Cuando esté desplegado, prueba en navegador:

```text
https://gym-api.tudominio.com/health
```

Deberías ver:

```json
{
  "ok": true,
  "service": "gym-reserver-api",
  "status": "online"
}
```

---

# 13. Prueba la API desplegada

Desde tu PC:

```powershell
curl -X POST https://gym-api.tudominio.com/reservar `
  -H "Authorization: Bearer pon_una_clave_larga_y_segura" `
  -H "Content-Type: application/json" `
  -d "{\"dryRun\": true}"
```

Si responde `ok: true`, revisa los logs de EasyPanel para confirmar que llegó hasta el final.

---

# 14. Conectar con n8n

En n8n, crea un flujo:

```text
Manual Trigger
↓
HTTP Request
↓
Telegram
```

El nodo **HTTP Request** sirve para llamar endpoints HTTP desde flujos de n8n. ([n8n Docs][3])

Configura el HTTP Request:

```text
Method: POST
URL: https://gym-api.tudominio.com/reservar
Authentication: None
Send Headers: true
Header:
  Authorization: Bearer TU_API_KEY
Send Body: true
Body Content Type: JSON
Body:
  {
    "dryRun": true
  }
```

Primero ejecútalo manualmente con `dryRun: true`.

---

# 15. Activar reserva real

Cuando el test desde n8n funcione, cambia el body del HTTP Request a:

```json
{
  "dryRun": false
}
```

O cambia en EasyPanel:

```env
DRY_RUN=false
```

Yo prefiero controlar esto desde n8n:

```json
{
  "dryRun": false
}
```

Así puedes hacer pruebas seguras cuando quieras.

---

# 16. Programarlo todos los días

Cambia el **Manual Trigger** por **Schedule Trigger**. El Schedule Trigger de n8n permite ejecutar flujos en horarios concretos. ([n8n Docs][4])

Configúralo así:

```text
Trigger interval: Days
Hour: 05
Minute: 00
Timezone: Europe/Madrid
```

Si tu n8n permite poner 04:59, puedes usar:

```text
04:59
```

Pero si la reserva abre exactamente a las 05:00, deja:

```text
05:00
```

---

# 17. Reintentos recomendados en n8n

Flujo final recomendado:

```text
Schedule Trigger 05:00
↓
HTTP Request /reservar
↓
IF ok = true
  ├── Telegram: ✅ Reserva hecha
  └── Google Sheets: guardar OK
↓
IF ok = false
  ├── Wait 30 segundos
  ├── HTTP Request intento 2
  ├── Wait 30 segundos
  ├── HTTP Request intento 3
  └── Telegram: ❌ Error al reservar
```

---

## Orden exacto que seguiría ahora

```text
1. Crear server.js
2. Probar node server.js en local
3. Crear Dockerfile
4. Probar docker build y docker run
5. Subir repo privado a GitHub
6. Crear App en EasyPanel
7. Añadir variables de entorno
8. Probar /health
9. Probar /reservar con dryRun true
10. Conectar n8n manualmente
11. Probar n8n con dryRun true
12. Cambiar a dryRun false
13. Programar Schedule Trigger diario
```

No actives `DRY_RUN=false` en EasyPanel hasta que `/reservar` funcione correctamente con `dryRun: true` desde n8n.

[1]: https://easypanel.io/docs/services/app?utm_source=chatgpt.com "App Service"
[2]: https://playwright.dev/docs/docker?utm_source=chatgpt.com "Docker"
[3]: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/?utm_source=chatgpt.com "HTTP Request node documentation"
[4]: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.scheduletrigger/?utm_source=chatgpt.com "Schedule Trigger node documentation"
