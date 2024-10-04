import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import axios from "axios"; // For checking swappability on Raydium
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

// Function to fetch boosted tokens from the API
const fetchBoostedTokensSolanaRaydium = async () => {
    const timestamp = new Date().toISOString();
    console.log(`Starting fetchBoostedTokensSolanaRaydium at ${timestamp}`);

    try {
        const response = await fetch('https://api.dexscreener.com/token-boosts/top/v1', {
            method: 'GET',
            headers: {}
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        console.log(`Number of tokens returned by Dexscreener: ${data.length}`);

        // Prepare an array to store token addresses and their decimals
        const tokenDetails = [];
        let outputContent = '';  // For detailed file logging

        // Ensure the response has tokens data
        if (data && data.length > 0) {
            // Process each token with a delay between requests
            for (const token of data) {
                if (token.chainId === 'solana' && token.totalAmount >= 500) { // Filter Solana tokens with amount >= 1
                    const tokenAddress = token.tokenAddress;
                    console.log(`Processing token: ${tokenAddress}, Boosts: ${token.totalAmount}`);

                    const decimals = await getTokenDecimals(tokenAddress);

                    if (decimals !== null) {
                        // Check if the token can be swapped on Raydium
                        const isSwappable = await checkTokenSwappable(tokenAddress);

                        if (isSwappable) {
                            tokenDetails.push([tokenAddress, decimals]); // Store address and decimals

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
                    }

                    // Introduce a delay between each token request to prevent rate-limiting (429 errors)
                    await sleep(2000); // Delay for 2 seconds between requests
                }
            }

            // Save output to Current_list.mjs
            if (tokenDetails.length > 0) {
                console.log('Swappable token details with decimals:', tokenDetails);
                const tokenAddressesContent = `export const tokenAddresses = ${JSON.stringify(tokenDetails)};`;
                const jsFilename = path.join(logFolder, 'Current_list.mjs');
                fs.writeFileSync(jsFilename, tokenAddressesContent, 'utf8');
                console.log(`Token addresses with decimals written to ${jsFilename}`);
            } else {
                console.log('No swappable tokens found.');
            }

            // Generate a timestamp for the log file name
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are 0-based
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const timestampForFile = `${year}-${month}-${day}--${hours}-${minutes}-${seconds}`;

            // Save detailed output to a text file with timestamp
            if (outputContent) {
                const outputFilePath = path.join(logFolder, `TokenResults_${timestampForFile}.txt`);
                fs.writeFileSync(outputFilePath, outputContent, 'utf8');
                console.log(`Detailed output saved to ${outputFilePath}`);
            }
        } else {
            console.log('No tokens data found in the response.');
        }

    } catch (error) {
        console.error('Error fetching boosted tokens:', error);
    }
};

// Function to get token decimals
const getTokenDecimals = async (tokenAddress) => {
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    const tokenPublicKey = new PublicKey(tokenAddress);
    try {
        const mintInfo = await getMint(connection, tokenPublicKey);
        return mintInfo.decimals;
    } catch (error) {
        console.error(`Error fetching decimals for ${tokenAddress}:`, error.message);
        return null; // Return null if there's an error
    }
};

// Function to check if a token can be swapped on Raydium
async function checkTokenSwappable(tokenAddress) {
    try {
        const response = await axios.post(
            "https://graph.defined.fi/graphql",
            {
                // GraphQL query to check token
                query: `{
                    token(input: { address: "${tokenAddress}", networkId: 1399811149 }) {
                        address
                        exchanges {
                            name
                        }
                    }
                }`
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "f489353be7368dc360236c9e9555c629cabad054" // API key Codex
                }
            }
        );

        const exchanges = response.data.data.token.exchanges;

        // Check if 'Raydium' is present in the exchanges array
        return exchanges.some(exchange => exchange.name.includes("Raydium"));

    } catch (error) {
        console.error("Error checking token:", error);
        return false;
    }
}

// Utility function to sleep for a given number of milliseconds
const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

// Fetch boosted tokens once
fetchBoostedTokensSolanaRaydium();

// Set interval to fetch every 5 minutes (300000 ms)
setInterval(fetchBoostedTokensSolanaRaydium, 300000);
