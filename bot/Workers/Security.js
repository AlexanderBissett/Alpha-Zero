import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getMint } from '@solana/spl-token';
import { tokenAddresses } from '../Scanner/scanlog/Current_list.mjs';  // Import token addresses from Current_list.mjs
import fs from 'fs';  // For writing to a file
import path from 'path';
import { fileURLToPath } from 'url';

// Function to get the absolute path for the output file
const getOutputFilePath = () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    return path.resolve(__dirname, '../Scanner/scanlog/Secure_current_list.mjs');
};

// Function to read addresses from addresses.json
const readAddressesFromFile = () => {
    const addressesFilePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'addresses.json');
    if (!fs.existsSync(addressesFilePath)) {
        console.error('addresses.json file not found!');
        return [];
    }
    
    const addressesData = fs.readFileSync(addressesFilePath, 'utf8');
    return JSON.parse(addressesData);
};

async function isTokenFreezeable(mintAddress) {
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    const mintPublicKey = new PublicKey(mintAddress);

    try {
        // Fetch the mint account information
        const mintInfo = await getMint(connection, mintPublicKey, TOKEN_PROGRAM_ID);

        // Check if the freeze authority is set
        const isFreezeable = mintInfo.freezeAuthority !== null;
        return isFreezeable;
    } catch (error) {
        console.error(`Error fetching mint info for ${mintAddress}:`, error);
        return false;
    }
}

// Function to create a delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Function to filter and output non-freezeable tokens
async function checkFreezeableTokens(tokenAddresses) {
    const nonFreezeableTokens = [];
    const existingAddresses = readAddressesFromFile().map(entry => entry.address); // Get existing addresses

    for (const token of tokenAddresses) {
        const [mintAddress, decimals, ...rest] = token; // Destructure to get address, decimals, and any additional info

        // Check if the address already exists
        if (existingAddresses.includes(mintAddress)) {
            console.log(`Address ${mintAddress} already exists in addresses.json. Skipping...`);
            continue; // Skip processing this token
        }

        const isFreezeable = await isTokenFreezeable(mintAddress);

        if (!isFreezeable) {
            nonFreezeableTokens.push([mintAddress, decimals, ...rest]);  // Keep the same structure, including 'ignore' if present
        }

        // Delay after processing each token
        await delay(2000); // Adjust the delay time (in milliseconds) as needed
    }

    // Ensure the file is created with an empty array if no non-freezeable tokens
    const outputData = `export const tokenAddresses = ${JSON.stringify(nonFreezeableTokens, null, 4)};`;
    const outputFilePath = getOutputFilePath();

    // Ensure the directory exists
    fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });

    try {
        fs.writeFileSync(outputFilePath, outputData, 'utf8');
        console.log('Secure_current_list.mjs has been updated with non-freezeable tokens.');
    } catch (error) {
        console.error(`Failed to write to file: ${error.message}`);
    }
}

// Example usage with imported token addresses
checkFreezeableTokens(tokenAddresses);