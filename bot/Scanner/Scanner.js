import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import axios from "axios";
import { Connection, PublicKey } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';

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

// Utility function to read addresses from addresses.json
const readAddresses = () => {
    const addressesFilePath = path.join(__dirname, '..', 'Workers', 'addresses.json');
    if (!fs.existsSync(addressesFilePath)) {
        console.log('addresses.json not found. Proceeding with all tokens.');
        return []; // Return an empty array if the file does not exist
    }

    try {
        const data = fs.readFileSync(addressesFilePath, 'utf8');
        if (data.trim()) {
            const addresses = JSON.parse(data);
            return addresses.map(item => item.address); // Return only the address values
        } else {
            console.log('addresses.json is empty. Proceeding with all tokens.');
            return [];
        }
    } catch (error) {
        console.error('Error reading or parsing addresses.json:', error.message);
        return [];
    }
};

// Flag to track if it's the first run
let isFirstRun = true;

// Function to fetch boosted tokens from the API
const fetchBoostedTokensSolanaRaydium = async (attempt = 1) => {
    const timestamp = new Date().toISOString();
    console.log(`Starting fetchBoostedTokensSolanaRaydium at ${timestamp}`);

    const existingAddresses = readAddresses(); // Load existing addresses from addresses.json

    try {
        const response = await fetch('https://api.dexscreener.com/token-boosts/top/v1', {
            method: 'GET',
            headers: {}
        });

        if (!response.ok) {
            console.error(`Attempt ${attempt}: Network response was not ok. Status: ${response.status}`);
            if (attempt < 5) {
                const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                console.log(`Retrying in ${delay / 1000} seconds...`);
                await sleep(delay); // Wait before retrying
                return fetchBoostedTokensSolanaRaydium(attempt + 1); // Retry
            }
            throw new Error('Max retry attempts reached.');
        }

        const data = await response.text(); // Get response as raw text

        try {
            const parsedData = JSON.parse(data); // Try to parse as JSON
            console.log(`Number of tokens returned by Dexscreener: ${parsedData.length}`);

            // Prepare an array to store token addresses and their decimals
            const tokenDetails = [];
            let outputContent = '';  // For detailed file logging

            // Ensure the response has tokens data
            if (parsedData && parsedData.length > 0) {
                // Process each token sequentially, with a delay between each one
                for (const token of parsedData) {
                    // Filter Solana tokens with totalAmount within the specified range
                    if (token.chainId === 'solana' && token.totalAmount >= MIN_BOOSTS && token.totalAmount <= MAX_BOOSTS) {
                        const tokenAddress = token.tokenAddress;

                        // Check if the token address exists in existingAddresses
                        if (existingAddresses.includes(tokenAddress)) {
                            console.log(`Skipping token: ${tokenAddress} (already processed)`);
                            continue; // Skip processing this token
                        }

                        console.log(`Processing token: ${tokenAddress}, Boosts: ${token.totalAmount}`);

                        const decimals = await getTokenDecimals(tokenAddress);  // Fetch token decimals sequentially

                        if (decimals !== null) {
                            // Check if the token can be swapped on Raydium and meets price conditions
                            const isValidToken = await checkTokenSwappableAndPrice(tokenAddress);

                            if (isFirstRun) {
                                // For the first run, append "ignore" note
                                tokenDetails.push([tokenAddress, decimals, 'ignore']); // Add 'ignore' for first run
                            } else if (isValidToken) {
                                tokenDetails.push([tokenAddress, decimals]); // Store address and decimals for valid tokens
                            } else {
                                tokenDetails.push([tokenAddress, decimals, 'ignore']); // Add 'ignore' for invalid tokens
                            }

                            // Prepare detailed output content for the text file
                            outputContent += `==========================================================================================\n`;
                            outputContent += `==========================================================================================\n`;
                            outputContent += `URL: ${token.url}\n`;
                            outputContent += `Chain ID: ${token.chainId}\n`;
                            outputContent += `Token Address: ${token.tokenAddress}\n`;
                            outputContent += `Total Amount: ${token.totalAmount}\n`;
                            outputContent += `Amount: ${token.amount}\n`;
                            outputContent += `Decimals: ${decimals}\n`;
                            outputContent += '\n'; // Separator for readability
                        }

                        // Introduce a delay between each token processing to prevent rate-limiting (429 errors)
                        await sleep(5000); // Delay for 5 seconds before processing the next token
                    }
                }

                // Save output to Current_list.mjs
                if (tokenDetails.length > 0) {
                    console.log('Token details with decimals:', tokenDetails);
                    const tokenAddressesContent = `export const tokenAddresses = ${JSON.stringify(tokenDetails)};`;
                    const jsFilename = path.join(logFolder, 'Current_list.mjs');
                    fs.writeFileSync(jsFilename, tokenAddressesContent, 'utf8');
                    console.log(`Token addresses written to ${jsFilename}`);
                } else {
                    console.log('No valid tokens found.');
                }

                // Log the timestamp and save detailed output to a file
                const now = new Date();
                const timestampForFile = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}--${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
                if (outputContent) {
                    const outputFilePath = path.join(logFolder, `TokenResults_${timestampForFile}.txt`);
                    fs.writeFileSync(outputFilePath, outputContent, 'utf8');
                    console.log(`Detailed output saved to ${outputFilePath}`);
                }

                isFirstRun = false; // After the first run
            } else {
                console.log('No tokens data found in the response.');
            }

        } catch (jsonError) {
            // Check if the error is related to incomplete JSON input
            if (jsonError.message.includes("Unexpected end of JSON input")) {
                console.warn('Ignoring incomplete JSON response and continuing execution.');
            } else {
                console.error('Error parsing JSON response:', jsonError.message);
            }
        }

    } catch (error) {
        console.error('Error fetching boosted tokens:', error.message);
    }
};

// Function to check if a token is swappable on Raydium and meets price filtering condition
async function checkTokenSwappableAndPrice(tokenAddress) {
    try {
        const response = await axios.post(
            "https://graph.defined.fi/graphql",
            {
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
                            high12
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
                    Authorization: `${API_KEY}`
                }
            }
        );

        const tokenData = response.data.data.filterTokens.results[0]; // Take the first result
        const { priceUSD, high12, exchanges } = tokenData;

        console.log(`Token Address: ${tokenData.token.address}`);
        console.log(`Price (USD): ${priceUSD}`);
        console.log(`12h High: ${high12}`);

        // Check if 'Raydium' is present in the exchanges array and price condition is met
        const isSwappableOnRaydium = exchanges.some(exchange => exchange.name.includes("Raydium"));
        const isValidPrice = priceUSD >= high12;

        console.log(`Swappable on Raydium: ${isSwappableOnRaydium}`);
        console.log(`Price is valid: ${isValidPrice}`);

        return isSwappableOnRaydium && isValidPrice;

    } catch (error) {
        console.error("Error checking token swap and price:", error.message);
        return false;
    }
}

// Function to fetch token decimals from Solana blockchain
async function getTokenDecimals(tokenAddress) {
    try {
        const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
        const mintPublicKey = new PublicKey(tokenAddress);
        const mintInfo = await getMint(connection, mintPublicKey);
        return mintInfo.decimals;
    } catch (error) {
        console.error(`Error fetching decimals for token ${tokenAddress}:`, error.message);
        return null; // Return null in case of failure
    }
}

// Helper function to introduce a delay (sleep)
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Fetch boosted tokens once
fetchBoostedTokensSolanaRaydium().then(() => {
    // After the first run, start the interval to run every 60 seconds
    setInterval(fetchBoostedTokensSolanaRaydium, 60000);
});
