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

// Function to fetch token price using the API
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

        // Correctly access the price from the response
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
        await loadConfig(); // Load the config to get the interval value

        const addresses = await getAddressesFromFile();
        const currentTime = Math.floor(Date.now() / 1000); // Get current UNIX timestamp in seconds

        const priceUpdateIntervalSeconds = config.priceUpdateIntervalSeconds || 45;  // Default to 45 seconds if not set

        if (addresses.length === 0) {
            console.log('No addresses found in file.');
            return;
        }

        for (const entry of addresses) {
            // Only process addresses where 'used' is true and 'reversed' is false
            if (entry.used && !entry.reversed && entry.address) {
                // Use the interval from the config file
                if (entry.priceMeasuredAt && currentTime - entry.priceMeasuredAt < priceUpdateIntervalSeconds) {
                    console.log(`Skipping address ${entry.address} (last updated less than ${priceUpdateIntervalSeconds} seconds ago).`);
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

// Run the address processing function
processAddresses();