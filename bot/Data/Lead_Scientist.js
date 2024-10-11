const axios = require('axios');
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

// Fetch token price using the API
async function getTokenPrice(tokenAddress) {
    try {
        const response = await axios.post(
            "https://graph.defined.fi/graphql",
            {
                query: `{
                    getTokenPrices(
                        inputs: [{ address: "${tokenAddress}", networkId: 1399811149 }]
                    ) {
                        priceUsd
                    }
                }`
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "9e9ec49bdbb58b704e359a2158b151c6981a985f" // API key Codex
                }
            }
        );

        const priceUsd = response.data.data.getTokenPrices[0]?.priceUsd;
        if (priceUsd !== undefined) {
            return priceUsd;
        } else {
            throw new Error('Price not found in API response.');
        }

    } catch (error) {
        console.error(`Error fetching price for token ${tokenAddress}:`, error.message);
        if (error.response) {
            console.error("API response data:", error.response.data);
        }
        return null;
    }
}

// Read addresses from a JSON file
async function getAddressesFromFile() {
    const filePath = path.resolve(__dirname, '../Workers/addresses.json');
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
}

// Save addresses with updated prices and flags back to the JSON file
async function saveAddressesToFile(addresses) {
    const filePath = path.resolve(__dirname, '../Workers/addresses.json');
    await fs.writeFile(filePath, JSON.stringify(addresses, null, 2));
}

// Process addresses to update original prices (OGpriceUSD) if not already set
async function processAddresses() {
    try {
        const addresses = await getAddressesFromFile();
        
        if (addresses.length === 0) {
            console.log('No addresses found in file.');
            return;
        }

        for (const entry of addresses) {
            // Initialize change limit flags if not already set
            entry.changeLimit = entry.changeLimit !== undefined ? entry.changeLimit : false;
            entry.changePositiveLimit = entry.changePositiveLimit !== undefined ? entry.changePositiveLimit : false;
            entry.changeNegativeLimit = entry.changeNegativeLimit !== undefined ? entry.changeNegativeLimit : false;

            // Process addresses that need initial price recording and are not yet limited
            if (entry.used && !entry.reversed && (entry.OGpriceUSD === undefined || entry.OGpriceUSD === null) && !entry.changeLimit) {
                console.log(`Processing address ${entry.address}`);
                const price = await getTokenPrice(entry.address);
                entry.OGpriceUSD = price !== null ? price : 'Price not found';
            } else {
                console.log(`Skipping address ${entry.address} (used: ${entry.used}, reversed: ${entry.reversed}, OGpriceUSD: ${entry.OGpriceUSD}, changeLimit: ${entry.changeLimit})`);
            }

            await saveAddressesToFile(addresses); // Save after processing each address
        }
        
        console.log('Addresses updated successfully.');
        
    } catch (err) {
        console.error('Error processing addresses:', err);
    }
}

// Calculate price differences and set the change limits
async function calculatePriceDifference() {
    try {
        await loadConfig();  // Load the config file to get the price change thresholds
        
        const addresses = await getAddressesFromFile();
        const positiveThreshold = config.positivePriceChangeThreshold || 100;  // Default to 100% if not specified
        const negativeThreshold = config.negativePriceChangeThreshold || 100;  // Default to 100% if not specified
        
        for (const entry of addresses) {
            // Initialize change limit flags if not already set
            entry.changeLimit = entry.changeLimit !== undefined ? entry.changeLimit : false;
            entry.changePositiveLimit = entry.changePositiveLimit !== undefined ? entry.changePositiveLimit : false;
            entry.changeNegativeLimit = entry.changeNegativeLimit !== undefined ? entry.changeNegativeLimit : false;

            // Only process if original and current prices are available and limits are not already triggered
            if (entry.OGpriceUSD && entry.priceUSD && !entry.changeLimit) {
                const OGprice = parseFloat(entry.OGpriceUSD);
                const currentPrice = parseFloat(entry.priceUSD);

                if (!isNaN(OGprice) && !isNaN(currentPrice) && OGprice !== 0) {
                    const percentageDifference = ((currentPrice - OGprice) / OGprice) * 100;
                    console.log(`Address: ${entry.address}, OGpriceUSD: ${OGprice}, priceUSD: ${currentPrice}, Difference: ${percentageDifference.toFixed(2)}%`);

                    // Check for price increase
                    if (percentageDifference >= positiveThreshold) {
                        entry.changePositiveLimit = true;
                        entry.changeLimit = true;
                        console.log(`Address ${entry.address} has reached the positive change limit of ${positiveThreshold}%. changePositiveLimit marked as true.`);
                    }

                    // Check for price decrease
                    if (percentageDifference <= -negativeThreshold) {
                        entry.changeNegativeLimit = true;
                        entry.changeLimit = true;
                        console.log(`Address ${entry.address} has reached the negative change limit of ${negativeThreshold}%. changeNegativeLimit marked as true.`);
                    }
                } else {
                    console.log(`Invalid prices for address ${entry.address}. OGpriceUSD or priceUSD is not valid.`);
                }
            } else {
                console.log(`Skipping address ${entry.address} as OGpriceUSD, priceUSD, or changeLimit is invalid or already marked as true.`);
            }

            await saveAddressesToFile(addresses); // Save after processing each address
        }

        console.log('Price differences and changeLimit statuses updated successfully.');
        
    } catch (err) {
        console.error('Error calculating price differences:', err);
    }
}

// Main execution
(async () => {
    await calculatePriceDifference();  
    await processAddresses();  
})();