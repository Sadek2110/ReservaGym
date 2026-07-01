require('dotenv').config();
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  testMatch: 'reserve.spec.js',
  timeout: 45000,
  expect: {
    timeout: 10000
  },
  reporter: 'list',
  use: {
    browserName: 'chromium',
    headless: false,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
