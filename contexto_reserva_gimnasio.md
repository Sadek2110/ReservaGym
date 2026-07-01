# Contexto de la conversación — Automatización reserva gimnasio ICD Ceuta

## Objetivo

Automatizar la reserva diaria de una plaza de gimnasio en el sistema de reservas del ICD Ceuta.

La reserva debe hacerse todos los días a primera hora, aproximadamente a las **05:00**, para reservar plaza para el **día siguiente** en:

- **Instalación/servicio:** C.D. DIAZ FLOR
- **Actividad:** SALA CARDIO-FITNESS
- **Horario objetivo:** 09:00 - 10:00
- **Forma de pago:** Bono
- **Descuento:** (-90 %) CARNET JOVEN

La automatización debe hacer una reserva normal con la cuenta del usuario, sin saltarse captchas, límites, normas ni validaciones del sistema.

---

## Herramientas disponibles del usuario

El usuario dispone de las siguientes herramientas:

| Herramienta | Uso dentro del proyecto |
|---|---|
| **Windows + PowerShell** | Entorno principal para probar la automatización localmente. |
| **Node.js** | Runtime recomendado para crear el script de automatización. |
| **Playwright** | Automatizar el navegador como si el usuario hiciera la reserva manualmente. |
| **n8n self-hosted** | Orquestador para ejecutar el flujo todos los días a las 05:00. |
| **EasyPanel + VPS** | Desplegar el microservicio o script en producción. |
| **Telegram Bot** | Enviar avisos de éxito, error o intervención manual. |
| **Google Sheets** | Guardar logs de reservas, errores y resultados. |
| **GitHub privado** | Guardar el código del proyecto sin exponer credenciales. |
| **Claude Code** | Ayuda para programar y depurar el script. |
| **Codex / ChatGPT** | Ayuda para análisis, documentación y mejora del flujo. |
| **OpenCode Go API** | Posible uso futuro, aunque no es necesario para esta automatización. |
| **Gemini / Google AI Pro** | No es necesario para esta automatización. |

---

## Decisión técnica

Se compararon dos opciones:

### Opción sencilla

**n8n puro** con:

```text
Schedule Trigger
↓
HTTP Request
↓
IF éxito/error
↓
Telegram
↓
Google Sheets
```

Ventaja: más rápido de montar.

Desventaja: la web parece estar hecha con páginas `.aspx` y probablemente usa sesión, cookies, redirecciones y formularios internos. Esto puede hacer que una automatización solo con HTTP Request sea frágil.

### Opción recomendada

**n8n + Node.js + Playwright + Telegram + Google Sheets**

Arquitectura recomendada:

```text
n8n
  ↓
Schedule Trigger diario 05:00
  ↓
HTTP Request a microservicio propio
  ↓
Node.js + Playwright
  ↓
Automatiza navegador real
  ↓
Devuelve resultado a n8n
  ↓
Telegram + logs en Google Sheets
```

Esta opción da más control, permite capturas de pantalla, reintentos, logs y depuración visual.

---

## URL inicial actualizada

La URL inicial confirmada para iniciar sesión es:

```text
https://reservasicd.ceuta.es/a2SportWeb/
```

---

## Flujo funcional documentado

El flujo manual a automatizar es:

1. Entrar en:

```text
https://reservasicd.ceuta.es/a2SportWeb/
```

2. Rellenar el formulario de identificación:

```text
Carnet / DNI: guardar en .env como GYM_DNI
Contraseña: guardar en .env como GYM_PASSWORD
```

> Por privacidad, el DNI y la contraseña no se incluyen en este archivo. Deben guardarse únicamente en `.env`.

3. Pulsar:

```text
IDENTIFICARSE
```

4. En el navbar, pulsar:

```text
RESERVA INSTALACIONES
```

5. Comprobar que redirige a:

```text
https://reservasicd.ceuta.es/Reserva2/BusquedaReservas.aspx
```

6. En esa página:

```text
Servicio → C.D. DIAZ FLOR
```

7. Pulsar:

```text
SALA CARDIO-FITNESS
```

8. Comprobar que redirige a:

```text
https://reservasicd.ceuta.es/Reserva2/reservasCalendario.aspx
```

9. Pulsar en la fecha del **día siguiente al día actual**.

10. Comprobar que redirige a:

```text
https://reservasicd.ceuta.es/Reserva2/reservasHoras.aspx
```

11. Pulsar en la hora:

```text
09:00 - 10:00
```

12. Comprobar que redirige a:

```text
https://reservasicd.ceuta.es/Reserva2/ReservasFormulario.aspx
```

13. En el formulario final:

```text
Forma de Pago → Bono
Descuentos → (-90 %) CARNET JOVEN
```

14. Marcar el checkbox:

```text
He leído y acepto el Reglamento de los Usuarios del ICD y el reglamento de la piscina
```

15. Último paso real:

```text
RESERVAR
```

Durante las pruebas iniciales, **NO se debe pulsar RESERVAR**. Hay que usar modo seguro `DRY_RUN=true`.

---

## Estado actual de la prueba

Ya se hizo una grabación con Playwright Codegen.

El usuario llegó correctamente hasta la pantalla final:

```text
https://reservasicd.ceuta.es/Reserva2/ReservasFormulario.aspx
```

En la captura se ve:

- Servicio: C.D. DIAZ FLOR (SALA CARDIO-FITNESS - SALA CARDIO FITNESS)
- Fecha: 02/07/2026
- Horario: 09:00 - 10:00
- Forma de pago: Bono
- Bono seleccionado con usos restantes
- Descuento: (-90 %) CARNET JOVEN
- Importe total: 0,00 €
- Checkbox del reglamento marcado
- Botón final: RESERVAR

Esto confirma que la automatización es viable con Playwright.

---

## Código generado por Playwright Codegen

Código grabado por el usuario, con la contraseña ocultada:

```js
import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://reservasicd.ceuta.es/a2SportWeb/');
  await page.getByRole('textbox', { name: 'Carnet / DNI' }).click();
  await page.getByRole('textbox', { name: 'Carnet / DNI' }).fill('GYM_DNI');
  await page.getByRole('textbox', { name: 'Contraseña' }).click();
  await page.getByRole('textbox', { name: 'Contraseña' }).fill('GYM_PASSWORD');
  await page.getByRole('button', { name: 'IDENTIFICARSE' }).click();
  await page.getByRole('link', { name: 'RESERVA INSTALACIONES' }).click();
  await page.getByLabel('Servicio').selectOption('3');
  await page.getByRole('cell', { name: 'SALA CARDIO-FITNESS' }).click();
  await page.getByRole('cell', { name: '2' }).nth(1).click();
  await page.getByRole('cell', { name: '9:00 - 10:00' }).click();
  await page.locator('#MainContent_MainContent_cmbDescuentos').selectOption('2');
  await page.locator('.fa.fa-2x').click();
});
```

### Observaciones sobre el código grabado

Hay partes que funcionan, pero deben mejorarse antes de producción:

1. El día está grabado como:

```js
await page.getByRole('cell', { name: '2' }).nth(1).click();
```

Esto solo sirve para el día 2. Hay que cambiarlo por lógica dinámica para seleccionar **mañana**.

2. El servicio está grabado como:

```js
await page.getByLabel('Servicio').selectOption('3');
```

Funciona ahora, pero sería mejor validar que la opción corresponde a **C.D. DIAZ FLOR**.

3. El descuento está grabado como:

```js
await page.locator('#MainContent_MainContent_cmbDescuentos').selectOption('2');
```

Funciona si el valor 2 sigue siendo CARNET JOVEN. Mejor comprobar el texto después de seleccionar.

4. El checkbox está grabado como:

```js
await page.locator('.fa.fa-2x').click();
```

Esto parece ser un icono visual, no un checkbox real. Puede funcionar, pero sería mejor buscar el input real o un selector más estable.

5. Falta el último botón **RESERVAR**, de forma intencionada porque la prueba era segura.

---

## Estructura local recomendada

Carpeta del proyecto:

```text
ReservaGym/
├── .env
├── .gitignore
├── package.json
├── recorded-test.spec.js
├── reserve.js
├── screenshots/
└── README.md
```

---

## `.env` recomendado

```env
GYM_URL=https://reservasicd.ceuta.es/a2SportWeb/
GYM_DNI=TU_DNI
GYM_PASSWORD=TU_PASSWORD
TARGET_TIME=09:00 - 10:00
DRY_RUN=true
```

---

## `.gitignore` recomendado

```gitignore
.env
node_modules
screenshots
recorded-test.spec.js
```

---

## Próximo paso recomendado

Crear un script limpio llamado:

```text
reserve.js
```

Ese script debe:

1. Leer credenciales desde `.env`.
2. Abrir Chromium con Playwright.
3. Iniciar sesión.
4. Ir a reserva de instalaciones.
5. Seleccionar C.D. DIAZ FLOR.
6. Seleccionar SALA CARDIO-FITNESS.
7. Calcular dinámicamente el día siguiente.
8. Seleccionar la hora 09:00 - 10:00.
9. Confirmar Bono y CARNET JOVEN.
10. Marcar el reglamento.
11. Hacer captura de pantalla.
12. Si `DRY_RUN=true`, parar antes de reservar.
13. Si `DRY_RUN=false`, pulsar **RESERVAR**.
14. Guardar captura del resultado.
15. Devolver éxito/error.

---

## Script objetivo aproximado

El futuro `reserve.js` debería tener esta lógica:

```text
inicio
↓
cargar variables .env
↓
abrir navegador
↓
login
↓
navegar a reserva instalaciones
↓
seleccionar servicio
↓
seleccionar sala
↓
calcular mañana
↓
seleccionar día mañana
↓
seleccionar hora objetivo
↓
verificar plazas
↓
seleccionar bono/descuento
↓
aceptar reglamento
↓
captura
↓
si DRY_RUN=true:
    parar antes de reservar
si DRY_RUN=false:
    pulsar RESERVAR
↓
captura resultado
↓
cerrar navegador
```

---

## Comandos usados o recomendados

Instalación inicial:

```powershell
cd Desktop
mkdir ReservaGym
cd ReservaGym
npm init -y
npm install playwright dotenv
npx playwright install chromium
```

Grabación con Playwright Codegen:

```powershell
npx playwright codegen "https://reservasicd.ceuta.es/a2SportWeb/"
```

Ejecución futura del script:

```powershell
node reserve.js
```

---

## Decisiones pendientes

Antes de activar la reserva real, hay que decidir:

### 1. Qué hacer si no hay plazas en 09:00 - 10:00

Opciones:

```text
A) No reservar y avisar por Telegram.
B) Intentar 08:00 - 09:00.
C) Intentar 10:00 - 11:00.
D) Reservar la primera hora disponible.
```

Recomendación inicial:

```text
Si 09:00 - 10:00 no tiene plazas, no reservar y avisar por Telegram.
```

### 2. Qué días ejecutar

Opciones:

```text
Todos los días.
Solo lunes a viernes.
Lunes a sábado.
Otro patrón.
```

### 3. Hora exacta de ejecución

Recomendación:

```text
04:59:55 Europe/Madrid
```

Así el script ya está preparado justo cuando abre la reserva.

### 4. Reintentos

Recomendación:

```text
3 reintentos entre 05:00 y 05:02
```

### 5. Avisos

Recomendación:

```text
Telegram si reserva OK.
Telegram si falla.
Telegram si no hay plazas.
Telegram si aparece pantalla inesperada.
```

---

## Futuro despliegue

Cuando funcione en local:

1. Crear endpoint con Express:

```text
POST /reservar
```

2. Subir proyecto a GitHub privado.

3. Desplegar en EasyPanel como app Node.js.

4. Guardar variables en EasyPanel:

```text
GYM_URL
GYM_DNI
GYM_PASSWORD
TARGET_TIME
DRY_RUN
```

5. Crear flujo n8n:

```text
Schedule Trigger 04:59:55
↓
HTTP Request POST /reservar
↓
IF resultado OK/error
↓
Telegram
↓
Google Sheets
```

---

## Resumen final

El proyecto está en fase de prueba local.

Ya se confirmó que:

- La URL inicial correcta es `https://reservasicd.ceuta.es/a2SportWeb/`.
- Playwright puede iniciar sesión y llegar hasta la pantalla final.
- La pantalla final contiene los datos correctos de reserva.
- El flujo es viable.
- Falta convertir la grabación en un script limpio, seguro y dinámico.
- La automatización final recomendada es **Playwright + n8n + EasyPanel + Telegram + Google Sheets**.
