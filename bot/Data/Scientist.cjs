const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

async function getTokenPrice(tokenAddress) {
  const url = `https://solscan.io/token/${tokenAddress}`;
  const browser = await puppeteer.launch({ headless: true, defaultViewport: null }); // Run in headless mode
  const page = await browser.newPage();

  try {
    const response = await page.goto(url, { waitUntil: 'networkidle2' });

    if (response.status() !== 200) {
      throw new Error(`Failed to load page, status code: ${response.status()}`);
    }

    const price = await page.evaluate(() => {
      const priceText = Array.from(document.querySelectorAll('div'))
        .filter(div => div.getAttribute('data-state') !== 'closed')
        .map(div => div.textContent)
        .join(' ')
        .match(/OverviewPrice\$([\d.,]+)/);

      if (priceText) {
        const rawPrice = priceText[1];
        const cleanedPrice = rawPrice.replace(/[^0-9.]/g, '');
        const [integerPart, decimalPart] = cleanedPrice.split('.');
        return parseFloat(decimalPart ? `${integerPart}.${decimalPart.padEnd(8, '0').substring(0, 8)}` : `${cleanedPrice}.00000000`);
      }
      return null;
    });

    await browser.close();
    return price;
  } catch (error) {
    console.error(`Error while fetching price: ${error.message}`);
    await browser.close();
    return null;
  }
}

async function getAddressesFromFile() {
  const filePath = path.resolve(__dirname, '../Workers/addresses.json');
  const data = await fs.readFile(filePath, 'utf8');
  return JSON.parse(data);
}

async function saveAddressesToFile(addresses) {
  const filePath = path.resolve(__dirname, '../Workers/addresses.json');
  await fs.writeFile(filePath, JSON.stringify(addresses, null, 2));
}

async function processAddresses() {
  try {
    const addresses = await getAddressesFromFile();
    
    if (addresses.length === 0) {
      console.log('No addresses found in file.');
      return;
    }

    for (const entry of addresses) {
      // Process only addresses where used is true and reversed is false
      if (entry.used && !entry.reversed && entry.address) {
        console.log(`Processing address ${entry.address}`);
        const price = await getTokenPrice(entry.address);
        entry.priceUSD = price !== null ? price : 'Price not found';
      }
    }
    
    await saveAddressesToFile(addresses);
    console.log('Addresses updated successfully.');
    
  } catch (err) {
    console.error('Error:', err);
  }
}

processAddresses();
