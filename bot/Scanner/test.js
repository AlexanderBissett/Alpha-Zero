import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from "axios";

// Define the folder path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logFolder = path.join(__dirname, 'scanlog');

// Ensure the log folder exists
if (!fs.existsSync(logFolder)) {
    fs.mkdirSync(logFolder, { recursive: true });
}

// Load configuration from Config.json
const configFilePath = path.join(__dirname, '..', 'Config.json');
let config = {};
if (fs.existsSync(configFilePath)) {
    const configFile = fs.readFileSync(configFilePath, 'utf8');
    try {
        config = JSON.parse(configFile);
    } catch (error) {
        console.error('Error parsing Config.json:', error.message);
    }
} else {
    console.error('Config.json not found. Please make sure it exists.');
    process.exit(1); // Exit if config file is not found
}

// Define minimum and maximum boost thresholds from Config.json
const MIN_BOOSTS = config.MIN_BOOSTS || 500;  // Default to 500 if not found in config
const MAX_BOOSTS = config.MAX_BOOSTS || 5000; // Default to 5000 if not found in config
const API_KEY = config.API_KEY || ''; // Fetch API key from config, ensure it exists

const tokenAddress = '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'

// Function to check if a token can be swapped on Raydium and get additional data
async function checkTokenSwappable(tokenAddress) {
    try {
        const response = await axios.post(
            "https://graph.defined.fi/graphql",
            {
                // Updated GraphQL query as per the new requirements
                query: `{
                    filterTokens(
                        filters: {
                            exchangeAddress: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"
                            network: [1399811149]
                        }
                        tokens: "${tokenAddress}"
                        limit: 100
                    ) {
                        results {
                            priceUSD
                            high1
                            exchanges {
                                name
                            }
                            token {
                                address
                                decimals
                                networkId
                            }
                        }
                    }
                }`
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `${API_KEY}`  // Use CODEX from config.json
                }
            }
        );

        const results = response.data.data.filterTokens.results[0]; // Get the first result
        const exchanges = results.exchanges;

        // Log the priceUSD and high1 values
        console.log(`Token Address: ${results.token.address}`);
        console.log(`Price (USD): ${results.priceUSD}`);
        console.log(`24h High: ${results.high1}`);

        // Check if 'Raydium' is present in the exchanges array
        const isSwappableOnRaydium = exchanges.some(exchange => exchange.name.includes("Raydium"));
        console.log(`Swappable on Raydium: ${isSwappableOnRaydium}`);

        return isSwappableOnRaydium;

    } catch (error) {
        console.error("Error checking token:", error.message);
        return false;
    }
}

checkTokenSwappable(tokenAddress);
