import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch'; // Ensure you have node-fetch installed
import { fileURLToPath } from 'url';
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
    try {
        const response = await fetch('https://api.dexscreener.com/token-boosts/latest/v1', {
            method: 'GET',
            headers: {}
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();

        // Prepare an array to store token addresses and their decimals
        const tokenDetails = [];
        // Prepare output content for the text file
        let outputContent = '';

        // Ensure the response has tokens data
        if (data && data.length > 0) {
            // Output specific token information for tokens with chainId: 'solana'
            for (const token of data) {
                if (token.chainId === 'solana' && token.amount >= 50) { // Check if chainId is 'solana' and totalAmount is >= 50
                    const tokenAddress = token.tokenAddress; // Get the token address
                    const decimals = await getTokenDecimals(tokenAddress); // Fetch decimals
                    tokenDetails.push([tokenAddress, decimals]); // Store address and decimals in the specified format

                    // Prepare detailed output content for the text file
                    outputContent += `==========================================================================================\n`;
                    outputContent += `==========================================================================================\n`;
                    outputContent += `URL: ${token.url}\n`;
                    outputContent += `Chain ID: ${token.chainId}\n`;
                    outputContent += `Token Address: ${token.tokenAddress}\n`;
                    outputContent += `Total Amount: ${token.totalAmount}\n`;
                    outputContent += `Amount: ${token.amount}\n`;
                    outputContent += `Decimals: ${decimals}\n`; // Add decimals to output
                    outputContent += '\n'; // Separator for readability
                }
            }

            // Save output to Current_list.mjs
            if (tokenDetails.length > 0) {
                const tokenAddressesContent = `export const tokenAddresses = ${JSON.stringify(tokenDetails)};`;
                const jsFilename = path.join(logFolder, 'Current_list.mjs');
                fs.writeFileSync(jsFilename, tokenAddressesContent, 'utf8');
                console.log(`Token addresses with decimals written to ${jsFilename}`);
            } else {
                console.log('No tokens with totalAmount >= 50 found.');
            }

            // Generate a timestamp for the log file name
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are 0-based
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const timestamp = `${year}-${month}-${day}--${hours}-${minutes}-${seconds}`;

            // Save detailed output to a text file with timestamp
            if (outputContent) {
                const outputFilePath = path.join(logFolder, `TokenResults_${timestamp}.txt`);
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

// Fetch boosted tokens once
fetchBoostedTokensSolanaRaydium();

// Set interval to fetch every 5 minutes (300000 ms)
setInterval(fetchBoostedTokensSolanaRaydium, 300000);