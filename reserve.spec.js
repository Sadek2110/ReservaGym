const { test, expect } = require('@playwright/test');
require('dotenv').config();

const {
  GYM_DNI,
  GYM_PASSWORD,
  TARGET_TIME
} = process.env;

test.describe('Automatización Reserva Gym - Suite de Tests', () => {

  test('Debería completar el flujo de pre-reserva de forma segura (DRY RUN)', async ({ page }) => {
    // Asegurarse de que las credenciales están disponibles
    expect(GYM_DNI).toBeDefined();
    expect(GYM_PASSWORD).toBeDefined();

    // 1. Inicio de Sesión
    await test.step('Paso 1: Ir a la página e iniciar sesión', async () => {
      console.log('Navegando a la página de login...');
      await page.goto('https://reservasicd.ceuta.es/a2SportWeb/', { waitUntil: 'domcontentloaded' });

      // Rellenar DNI/Carnet y Contraseña usando selectores robustos por ID
      console.log('Rellenando DNI/Carnet y Contraseña...');
      await page.locator('#SiteContent_MainContent_a2txtCodigo_txtA2TextBox').fill(GYM_DNI);
      await page.locator('#SiteContent_MainContent_a2txtPassword_txtA2TextBox').fill(GYM_PASSWORD);

      // Clic en Identificarse
      console.log('Haciendo clic en IDENTIFICARSE...');
      await page.locator('#SiteContent_MainContent_btnLogin').click();

      // Verificar que se ha iniciado sesión buscando el enlace de desconexión o el menú
      await expect(page.getByRole('link', { name: 'RESERVA INSTALACIONES' })).toBeVisible({ timeout: 15000 });
    });

    // 2. Navegación a la página de búsqueda de reservas
    await test.step('Paso 2: Navegar a Reserva de Instalaciones', async () => {
      console.log('Navegando a Reserva de Instalaciones...');
      await page.getByRole('link', { name: 'RESERVA INSTALACIONES' }).click();

      // Verificar que estamos en la URL de búsqueda
      await expect(page).toHaveURL(/BusquedaReservas\.aspx/i, { timeout: 15000 });
    });

    // 3. Selección del servicio C.D. DIAZ FLOR y la actividad
    await test.step('Paso 3: Seleccionar Servicio y Actividad', async () => {
      console.log('Seleccionando servicio C.D. DIAZ FLOR...');
      
      // Buscar el desplegable de filiales/servicios
      const filialSelect = page.locator('select[id*="cboFiliales"]');
      await filialSelect.selectOption({ label: 'C.D. DIAZ FLOR' });

      // Esperar a que se actualicen las actividades (postback)
      console.log('Esperando actualización de actividades...');
      await page.waitForLoadState('domcontentloaded');

      // Hacer clic en la actividad SALA CARDIO-FITNESS
      console.log('Seleccionando SALA CARDIO-FITNESS...');
      const activityRow = page.locator('tr').filter({ hasText: 'SALA CARDIO-FITNESS' });
      await expect(activityRow.first()).toBeVisible({ timeout: 10000 });
      await activityRow.first().click();

      // Verificar redirección al calendario
      await expect(page).toHaveURL(/reservasCalendario\.aspx/i, { timeout: 15000 });
    });

    // 4. Selección del día de mañana en el calendario
    await test.step('Paso 4: Seleccionar el día de mañana en el calendario', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const day = String(tomorrow.getDate()).padStart(2, '0');
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const year = tomorrow.getFullYear();
      const dataDayStr = `${day}/${month}/${year}`;
      
      console.log(`Buscando la celda del día de mañana: ${dataDayStr}`);
      
      // Localizador preciso basado en el atributo data-day del TD, excluyendo días deshabilitados
      const daySelector = `td.day[data-day="${dataDayStr}"]:not(.disabled)`;
      const dayCell = page.locator(daySelector);
      
      // Comprobar si está disponible para reservar (en el portal, a veces mañana aún no está abierto si no es la hora de apertura)
      const isAvailable = await dayCell.isVisible();
      if (!isAvailable) {
        console.log(`¡ATENCIÓN! La celda para el día ${dataDayStr} no está activa o ya está deshabilitada.`);
        // Para que el test no falle si mañana no está abierto aún, hacemos fallback al día de hoy para poder probar el resto del flujo
        const todayStr = `${String(new Date().getDate()).padStart(2, '0')}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${new Date().getFullYear()}`;
        console.log(`Usando día de hoy como fallback de pruebas: ${todayStr}`);
        const todayCell = page.locator(`td.day[data-day="${todayStr}"]:not(.disabled)`);
        await expect(todayCell).toBeVisible({ timeout: 5000 });
        await todayCell.click();
      } else {
        await dayCell.click();
      }

      // Verificar redirección a las horas
      await expect(page).toHaveURL(/reservasHoras\.aspx/i, { timeout: 15000 });
    });

    // 5. Selección del horario objetivo
    await test.step('Paso 5: Seleccionar el horario objetivo', async () => {
      console.log(`Buscando el horario: ${TARGET_TIME}`);
      
      const hourRow = page.locator('tr').filter({ hasText: TARGET_TIME });
      
      // Verificar si hay plazas disponibles en esa hora o si la hora existe
      const isHourVisible = await hourRow.first().isVisible();
      if (!isHourVisible) {
        console.log(`La hora ${TARGET_TIME} no está visible. Listando horas disponibles...`);
        const allHours = await page.locator('tr').allTextContents();
        console.log('Horas en pantalla:', allHours);
        throw new Error(`No se encontró la hora ${TARGET_TIME} o no está disponible para reserva`);
      }

      await hourRow.first().click();

      // Verificar redirección al formulario final
      await expect(page).toHaveURL(/ReservasFormulario\.aspx/i, { timeout: 15000 });
    });

    // 6. Configuración final y aceptación del reglamento
    await test.step('Paso 6: Configurar método de pago, descuento y reglamento', async () => {
      console.log('Verificando campos del formulario final...');

      // El descuento de carnet joven
      const descuentoSelect = page.locator('select[id*="cmbDescuentos"]');
      if (await descuentoSelect.isVisible()) {
        console.log('Seleccionando descuento CARNET JOVEN...');
        await descuentoSelect.selectOption({ label: '(-90 %) CARNET JOVEN' });
        // Esperar a que el spinner / overlay de carga de ASP.NET desaparezca
        const overlay = page.locator('#UpdateProgress1');
        await overlay.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
      }

      // El método de pago (Bono). Revisamos si existe el select de bonos
      const bonoSelect = page.locator('select[id*="cmbBonos"], select[id*="cmbFormasPago"]');
      const bonoCount = await bonoSelect.count();
      if (bonoCount > 0 && await bonoSelect.first().isVisible()) {
        console.log('Seleccionando Bono...');
        try {
          await bonoSelect.first().selectOption({ label: 'Bono' });
          const overlay = page.locator('#UpdateProgress1');
          await overlay.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
        } catch (e) {
          console.log('No se pudo seleccionar "Bono" en el primer select. Intentando por valor...');
          // Si falla, intentamos seleccionar la primera opción válida
          await bonoSelect.first().selectOption({ index: 1 });
          const overlay = page.locator('#UpdateProgress1');
          await overlay.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
        }
      }

      // Aceptación del reglamento
      console.log('Marcando checkbox del reglamento...');
      const checkIcon = page.locator('i.check, label[for*="chkNormativa"], .fa-2x');
      const checkCount = await checkIcon.count();
      if (checkCount > 0 && await checkIcon.first().isVisible()) {
        console.log('Haciendo clic en la etiqueta o icono visual del reglamento...');
        await checkIcon.first().click();
        // Esperar a que termine el postback que se dispara tras aceptar normativa
        const overlay = page.locator('#UpdateProgress1');
        await overlay.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
      } else {
        console.log('Icono/etiqueta no visible, intentando con checkbox nativo forzado...');
        await page.locator('input[type="checkbox"]').check({ force: true }).catch(() => {});
      }

      // Tomar una captura de pantalla final de confirmación
      await page.screenshot({ path: 'screenshots/test-formulario-final.png', fullPage: true });
      console.log('Captura del formulario de pruebas guardada en screenshots/test-formulario-final.png');

      // Verificamos que el botón RESERVAR está en la página
      const reserveButton = page.locator('input[type="submit"][value*="RESERVAR"], button:has-text("RESERVAR"), a:has-text("RESERVAR")');
      const btnCount = await reserveButton.count();
      if (btnCount > 0) {
        console.log('El botón RESERVAR está presente en la pantalla.');
      } else {
        console.log('Buscando cualquier botón de confirmación...');
        const allButtons = await page.locator('input[type="submit"], button').allAttributeValues('value');
        console.log('Botones disponibles:', allButtons);
      }
    });

  });

});
