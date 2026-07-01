require('dotenv').config();
const { chromium } = require('playwright');
const fs = require('fs');

const {
  GYM_URL,
  GYM_DNI,
  GYM_PASSWORD,
  TARGET_TIME,
  DRY_RUN,
  HEADLESS
} = process.env;

async function main() {
  if (!GYM_URL || !GYM_DNI || !GYM_PASSWORD) {
    throw new Error('Faltan variables en el archivo .env');
  }

  fs.mkdirSync('screenshots', { recursive: true });

  const isHeadless = HEADLESS === 'true';
  const browser = await chromium.launch({
    headless: isHeadless,
    slowMo: isHeadless ? 0 : 300
  });

  const page = await browser.newPage();

  try {
    console.log('Abriendo web...');
    await page.goto(GYM_URL, { waitUntil: 'domcontentloaded' });

    console.log('Rellenando login...');
    // DNI y Contraseña usando selectores robustos por ID
    await page.locator('#SiteContent_MainContent_a2txtCodigo_txtA2TextBox').fill(GYM_DNI);
    await page.locator('#SiteContent_MainContent_a2txtPassword_txtA2TextBox').fill(GYM_PASSWORD);

    console.log('Haciendo clic en IDENTIFICARSE...');
    await page.locator('#SiteContent_MainContent_btnLogin').click();

    console.log('Entrando en reserva instalaciones...');
    await page.getByRole('link', { name: 'RESERVA INSTALACIONES' }).click();

    console.log('Esperando página de búsqueda de reservas...');
    await page.waitForURL(/BusquedaReservas/i, { timeout: 15000 });

    console.log('Seleccionando servicio C.D. DIAZ FLOR...');
    const filialSelect = page.locator('select[id*="cboFiliales"]');
    await filialSelect.selectOption({ label: 'C.D. DIAZ FLOR' });

    console.log('Esperando actualización de actividades...');
    await page.waitForLoadState('domcontentloaded');

    console.log('Pulsando SALA CARDIO-FITNESS...');
    const activityRow = page.locator('tr').filter({ hasText: 'SALA CARDIO-FITNESS' });
    await activityRow.first().click();

    console.log('Esperando calendario...');
    await page.waitForURL(/reservasCalendario/i, { timeout: 15000 });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const day = String(tomorrow.getDate()).padStart(2, '0');
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const year = tomorrow.getFullYear();
    const dataDayStr = `${day}/${month}/${year}`;

    console.log(`Seleccionando día siguiente: ${dataDayStr}`);
    const daySelector = `td.day[data-day="${dataDayStr}"]:not(.disabled)`;
    const dayCell = page.locator(daySelector);
    
    if (await dayCell.isVisible()) {
      await dayCell.click();
    } else {
      const todayStr = `${String(new Date().getDate()).padStart(2, '0')}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${new Date().getFullYear()}`;
      console.log(`Día de mañana deshabilitado o no visible. Usando día de hoy como fallback de pruebas: ${todayStr}`);
      const todayCell = page.locator(`td.day[data-day="${todayStr}"]:not(.disabled)`);
      await todayCell.click();
    }

    console.log('Esperando pantalla de horas...');
    await page.waitForURL(/reservasHoras/i, { timeout: 15000 });

    console.log(`Buscando hora ${TARGET_TIME}...`);
    const hourRow = page.locator('tr').filter({
      hasText: TARGET_TIME
    });

    const hourCount = await hourRow.count();
    if (hourCount === 0) {
      throw new Error(`No se encontró la hora ${TARGET_TIME}`);
    }

    await hourRow.first().click();

    console.log('Esperando formulario final...');
    await page.waitForURL(/ReservasFormulario/i, { timeout: 15000 });

    console.log('Comprobando forma de pago y descuento...');

    // Descuento Carnet Joven
    const descuentoSelect = page.locator('select[id*="cmbDescuentos"]');
    if (await descuentoSelect.isVisible()) {
      console.log('Seleccionando descuento CARNET JOVEN...');
      await descuentoSelect.selectOption({ label: '(-90 %) CARNET JOVEN' }).catch(e => console.log('Error seleccionando descuento:', e.message));
      const overlay = page.locator('#UpdateProgress1');
      await overlay.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    }

    // Forma de Pago Bono
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
        await bonoSelect.first().selectOption({ index: 1 }).catch(() => {});
        const overlay = page.locator('#UpdateProgress1');
        await overlay.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
      }
    }

    console.log('Marcando checkbox del reglamento...');
    const checkIcon = page.locator('i.check, label[for*="chkNormativa"], .fa-2x');
    const checkCount = await checkIcon.count();
    if (checkCount > 0 && await checkIcon.first().isVisible()) {
      console.log('Haciendo clic en la etiqueta o icono visual del reglamento...');
      await checkIcon.first().click();
      const overlay = page.locator('#UpdateProgress1');
      await overlay.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    } else {
      console.log('Icono/etiqueta no visible, intentando con checkbox nativo forzado...');
      await page.locator('input[type="checkbox"]').check({ force: true }).catch(() => {});
    }

    await page.screenshot({
      path: 'screenshots/formulario-final.png',
      fullPage: true
    });

    if (DRY_RUN === 'true') {
      console.log('DRY_RUN=true, prueba terminada antes de pulsar RESERVAR.');
      console.log('Revisa la captura en screenshots/formulario-final.png');
      if (!isHeadless) {
        await page.pause();
      }
    } else {
      console.log('Pulsando RESERVAR...');
      const reserveButton = page.locator('input[type="submit"][value*="RESERVAR"], button:has-text("RESERVAR"), a:has-text("RESERVAR")');
      await reserveButton.first().click();

      await page.screenshot({
        path: 'screenshots/resultado-reserva.png',
        fullPage: true
      });

      console.log('Reserva enviada. Revisa screenshots/resultado-reserva.png');
    }

    await browser.close();
  } catch (error) {
    console.error('Error en la automatización:', error.message);

    await page.screenshot({
      path: 'screenshots/error.png',
      fullPage: true
    });

    console.log('Captura de error guardada en screenshots/error.png');

    await browser.close();
    process.exit(1);
  }
}

main();