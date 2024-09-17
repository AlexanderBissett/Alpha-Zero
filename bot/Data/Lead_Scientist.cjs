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

    // Process each address one by one
    for (const entry of addresses) {
      // Add default changeLimit as false if it doesn't exist
      if (entry.changeLimit === undefined) {
        entry.changeLimit = false;
      }

      // Only process if changeLimit is false, and used is true, reversed is false, OGpriceUSD is missing
      if (entry.used && !entry.reversed && (entry.OGpriceUSD === undefined || entry.OGpriceUSD === null) && !entry.changeLimit) {
        console.log(`Processing address ${entry.address}`);
        const price = await getTokenPrice(entry.address);  // Await each price fetch one by one
        entry.OGpriceUSD = price !== null ? price : 'Price not found';
      } else {
        console.log(`Skipping address ${entry.address} (used: ${entry.used}, reversed: ${entry.reversed}, OGpriceUSD: ${entry.OGpriceUSD}, changeLimit: ${entry.changeLimit})`);
      }

      // Save after processing each address to avoid data loss
      await saveAddressesToFile(addresses);
    }
    
    console.log('Addresses updated successfully.');
    
  } catch (err) {
    console.error('Error:', err);
  }
}

// New function to calculate percentage difference and update changeLimit, processing one by one
async function calculatePriceDifference() {
  try {
    const addresses = await getAddressesFromFile();
    
    // Process each address one by one
    for (const entry of addresses) {
      // Ensure changeLimit field is present, set to false if missing
      if (entry.changeLimit === undefined) {
        entry.changeLimit = false;
      }

      // Calculate the price difference only if changeLimit is false and both prices are present
      if (entry.OGpriceUSD !== undefined && entry.OGpriceUSD !== null && entry.priceUSD !== undefined && entry.priceUSD !== null && !entry.changeLimit) {
        const OGprice = parseFloat(entry.OGpriceUSD);
        const currentPrice = parseFloat(entry.priceUSD);

        // Ensure both prices are valid numbers
        if (!isNaN(OGprice) && !isNaN(currentPrice) && OGprice !== 0) {
          const percentageDifference = ((currentPrice - OGprice) / OGprice) * 100;
          console.log(`Address: ${entry.address}, OGpriceUSD: ${OGprice}, priceUSD: ${currentPrice}, Difference: ${percentageDifference.toFixed(2)}%`);

          // If the percentage difference is >= 10%, set changeLimit to true
          if (Math.abs(percentageDifference) >= 10) {
            entry.changeLimit = true;
            console.log(`Address ${entry.address} has reached the change limit of 10%. changeLimit marked as true.`);
          }
        } else {
          console.log(`Invalid prices for address ${entry.address}. OGpriceUSD or priceUSD is not valid.`);
        }
      } else {
        console.log(`Skipping address ${entry.address} as OGpriceUSD, priceUSD, or changeLimit is invalid or already marked as true.`);
      }

      // Save after processing each address to avoid data loss
      await saveAddressesToFile(addresses);
    }

    console.log('Price differences and changeLimit statuses updated successfully.');
    
  } catch (err) {
    console.error('Error calculating price differences:', err);
  }
}

// Call the function to calculate price differences and check change limits one by one
(async () => {
  await calculatePriceDifference();  // Process one by one in percentage difference check
  await processAddresses();  // Process one by one in fetching OGpriceUSD
})();