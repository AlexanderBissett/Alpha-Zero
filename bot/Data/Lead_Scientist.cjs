const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

// Load configuration from Config.json
const configFilePath = path.resolve(__dirname, '../Config.json');

let config = {};
async function loadConfig() {
    try {
        const data = await fs.readFile(configFilePath, 'utf8');
        config = JSON.parse(data);
    } catch (err) {
        console.error('Error loading Config.json:', err);
        process.exit(1);
    }
}

// Get token price function
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
      if (entry.changeLimit === undefined) {
        entry.changeLimit = false;
      }

      if (entry.used && !entry.reversed && (entry.OGpriceUSD === undefined || entry.OGpriceUSD === null) && !entry.changeLimit) {
        console.log(`Processing address ${entry.address}`);
        const price = await getTokenPrice(entry.address); 
        entry.OGpriceUSD = price !== null ? price : 'Price not found';
      } else {
        console.log(`Skipping address ${entry.address} (used: ${entry.used}, reversed: ${entry.reversed}, OGpriceUSD: ${entry.OGpriceUSD}, changeLimit: ${entry.changeLimit})`);
      }

      await saveAddressesToFile(addresses);
    }
    
    console.log('Addresses updated successfully.');
    
  } catch (err) {
    console.error('Error:', err);
  }
}

async function calculatePriceDifference() {
  try {
    await loadConfig();  // Load the config file to get the priceChangeThreshold
    
    const addresses = await getAddressesFromFile();
    const priceChangeThreshold = config.priceChangeThreshold || 10;  // Default to 10 if not specified in Config.json
    
    for (const entry of addresses) {
      if (entry.changeLimit === undefined) {
        entry.changeLimit = false;
      }

      if (entry.OGpriceUSD !== undefined && entry.OGpriceUSD !== null && entry.priceUSD !== undefined && entry.priceUSD !== null && !entry.changeLimit) {
        const OGprice = parseFloat(entry.OGpriceUSD);
        const currentPrice = parseFloat(entry.priceUSD);

        if (!isNaN(OGprice) && !isNaN(currentPrice) && OGprice !== 0) {
          const percentageDifference = ((currentPrice - OGprice) / OGprice) * 100;
          console.log(`Address: ${entry.address}, OGpriceUSD: ${OGprice}, priceUSD: ${currentPrice}, Difference: ${percentageDifference.toFixed(2)}%`);

          // Use the configurable threshold from Config.json
          if (Math.abs(percentageDifference) >= priceChangeThreshold) {
            entry.changeLimit = true;
            console.log(`Address ${entry.address} has reached the change limit of ${priceChangeThreshold}%. changeLimit marked as true.`);
          }
        } else {
          console.log(`Invalid prices for address ${entry.address}. OGpriceUSD or priceUSD is not valid.`);
        }
      } else {
        console.log(`Skipping address ${entry.address} as OGpriceUSD, priceUSD, or changeLimit is invalid or already marked as true.`);
      }

      await saveAddressesToFile(addresses);
    }

    console.log('Price differences and changeLimit statuses updated successfully.');
    
  } catch (err) {
    console.error('Error calculating price differences:', err);
  }
}

(async () => {
  await calculatePriceDifference();  
  await processAddresses();  
})();