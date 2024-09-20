const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs').promises;
const path = require('path');

// Apply the stealth plugin to Puppeteer
puppeteer.use(StealthPlugin());

// Function to delay actions (simulating human-like delay)
function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}

// Function to scrape token price from a specific token address
async function getTokenPrice(tokenAddress) {
  const url = `https://solscan.io/token/${tokenAddress}`;
  
  // Launch Puppeteer with stealth mode and headless disabled (to make it look more human)
  const browser = await puppeteer.launch({ headless: false, defaultViewport: null });
  const page = await browser.newPage();

  try {
    // Set a custom user-agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36');
    
    // Navigate to the token page, wait for network to be idle
    const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Check if the page loaded successfully
    if (response.status() !== 200) {
      throw new Error(`Failed to load page, status code: ${response.status()}`);
    }

    // Add some human-like delay
    await delay(2000);

    // Wait for a selector that indicates the page has loaded correctly
    await page.waitForSelector('body'); // You might need to update this with a specific selector on Solscan

    // Extract the price
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

// Function to read addresses from a JSON file
async function getAddressesFromFile() {
  const filePath = path.resolve(__dirname, '../Workers/addresses.json');
  const data = await fs.readFile(filePath, 'utf8');
  return JSON.parse(data);
}

// Function to save addresses with prices to a JSON file
async function saveAddressesToFile(addresses) {
  const filePath = path.resolve(__dirname, '../Workers/addresses.json');
  await fs.writeFile(filePath, JSON.stringify(addresses, null, 2));
}

// Function to process addresses and get token prices
async function processAddresses() {
  try {
    const addresses = await getAddressesFromFile();
    const currentTime = Math.floor(Date.now() / 1000); // Get current UNIX timestamp in seconds

    if (addresses.length === 0) {
      console.log('No addresses found in file.');
      return;
    }

    for (const entry of addresses) {
      // Only process addresses where 'used' is true and 'reversed' is false
      if (entry.used && !entry.reversed && entry.address) {
        // Check if priceMeasuredAt exists and is less than 45 seconds ago
        if (entry.priceMeasuredAt && currentTime - entry.priceMeasuredAt < 45) {
          console.log(`Skipping address ${entry.address} (last updated less than 45 seconds ago).`);
          continue;
        }

        console.log(`Processing address ${entry.address}`);
        const price = await getTokenPrice(entry.address);
        
        if (price !== null) {
          entry.priceUSD = price;
          entry.priceMeasuredAt = currentTime; // Set the last updated timestamp
          console.log(`Updated price for ${entry.address}: $${price}`);
        } else {
          console.log(`Price not found for ${entry.address}`);
        }
      }
    }
    
    // Save updated addresses back to file
    await saveAddressesToFile(addresses);
    console.log('Addresses updated successfully.');
    
  } catch (err) {
    console.error('Error:', err);
  }
}

processAddresses();