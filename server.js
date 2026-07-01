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

  const dni = req.body?.dni || process.env.GYM_DNI;
  const password = req.body?.password || process.env.GYM_PASSWORD;
  const time = req.body?.time || process.env.TARGET_TIME;

  if (!dni || !password || !time) {
    return res.status(400).json({
      ok: false,
      error: 'Faltan parámetros requeridos: dni, password o time (deben pasarse en el body o configurarse en el servidor)'
    });
  }

  isRunning = true;

  const dryRunFromBody = req.body?.dryRun;

  const env = {
    ...process.env,
    GYM_DNI: dni,
    GYM_PASSWORD: password,
    TARGET_TIME: time,
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
