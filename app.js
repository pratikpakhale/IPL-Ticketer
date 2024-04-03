const express = require('express');
const { chromium } = require('playwright');

const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;

const SEATS = 4;
const PRICE = 2400;

app.use(express.json());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

app.use(morgan('dev'));

let browser;
let page;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ensureBrowserIsOpen() {
  if (!browser) {
    console.log('browser is not open, launching new browser');
    browser = await chromium.launch({ headless: false });
    browser.on('disconnected', () => {
      console.log('browser is disconnected');
      browser = null;
    });
  }
  const context = await browser.newContext({});
  page = await context.newPage();
}

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.post('/open-url', async (req, res) => {
  await ensureBrowserIsOpen();
  const { url } = req.body;
  await page.goto(url);
  res.send(await page.content());
});

app.post('/save-cookies', async (req, res) => {
  if (!browser || !browser.isConnected()) {
    res.send('No browser instance is open.');
    return;
  }
  const cookies = await page.context().cookies();
  require('fs').writeFileSync('cookies.json', JSON.stringify(cookies));
  res.send('Cookies saved successfully!');
});

app.post('/launch-with-cookies', async (req, res) => {
  const cookies = require('fs').readFileSync('cookies.json', 'utf8');
  await ensureBrowserIsOpen();
  await page.context().addCookies(JSON.parse(cookies));
  await page.goto(req.body.url);

  res.send('Cookies loaded successfully!');
});

app.post('/activate-clicker', async (req, res) => {
  const seats = req.body.seats || SEATS; // If no value provided, use the default SEATS value
  const price = req.body.prices || PRICE;

  res.send('Clicker activated!');

  const book_button = `button[id="synopsis-book-button"]`;

  while (!(await page.isVisible(book_button))) {
    await sleep(1000);
    await page.reload();
  }

  await page.click(book_button);
  sleep(500);

  const cross_button = `div[data-auto="cancel-close"]`;

  while (!(await page.isVisible(cross_button))) {
    await sleep(1000);
    await page.reload();
  }

  await page.click(cross_button);

  sleep(500);

  const seat_selector = `//div[contains(text(),'How many seats?')]/following-sibling::div[2]/child::div[${seats}]`;

  await page.locator(seat_selector).click();
  sleep(100);
  const continue_button_selector = `//button[contains(text(), "Continue")]`;
  await page.locator(continue_button_selector).click();
  sleep(100);
  const price_selector = `//div[contains(text(), "${price}")]`;
  await page.locator(price_selector).click();
});

app.post('/confirm-booking', async (req, res) => {
  const phone = req.body.phone;
  res.send('confirming booking!');
  const book_button = `//button[contains(text(), "Book")]`;
  await page.locator(book_button).click();
  await sleep(1500);
  await page.locator(`//button[contains(text(), "Skip")]`).click();
  await sleep(1500);
  await page.locator(`input[data-id="enter-pincode"]`).fill('415413');
  await page
    .locator(`//button[contains(text(), "Check Availability")]`)
    .click();
  await sleep(800);
  await page.locator(`//button[contains(text(), "Proceed to Pay")]`).click();
  await sleep(2000);
  await page.locator(`input[data-auto="mobile-number"]`).fill(phone);
  await page.locator(`//a[contains(text(), "Continue")]`).click();
  await page.locator(`//span[contains(text(), "slice UPI")]`).click();
  await sleep(500);
  await page.locator(`input[id="txtUPIId"]`).fill(req.body.upi);
  await page.locator(`input[id="dUPIVPADrop"]`).fill(req.body.bank);
  await page.evaluate(() => {
    pay.fnPayUPI('UPI');
  });
});

const server = app.listen(PORT, () =>
  console.log(`Server is running on port ${PORT}`)
);

process.on('uncaughtException', async err => {
  console.error('Uncaught exception:', err);
});
