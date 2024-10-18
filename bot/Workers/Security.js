import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getMint } from '@solana/spl-token';
import { tokenAddresses } from '../Scanner/scanlog/Current_list.mjs';  // Import token addresses from Scanner.js
import fs from 'fs';  // For writing to a file
import path from 'path';
import { fileURLToPath } from 'url';

// Function to get the absolute path for the output file
const getOutputFilePath = () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    return path.resolve(__dirname, '../Scanner/scanlog/Secure_current_list.mjs');
};

// Function to load existing addresses from addresses.json and extract token names
const loadExistingTokenNames = () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const addressesFilePath = path.join(__dirname, 'addresses.json');

    if (fs.existsSync(addressesFilePath)) {
        const fileContent = fs.readFileSync(addressesFilePath, 'utf-8');
        const existingAddresses = JSON.parse(fileContent);

        // Extract and return the list of token names from addresses.json
        return new Set(existingAddresses.map(entry => entry.name));
    }

    return new Set();  // Return an empty set if addresses.json does not exist
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

// Function to filter and output non-freezeable tokens
async function checkFreezeableTokens(tokenAddresses) {
    const nonFreezeableTokens = [];
    const existingTokenNames = loadExistingTokenNames();  // Load existing token names from addresses.json

    // tokenAddresses now contains [address, decimals, name]
    for (const [mintAddress, decimals, name] of tokenAddresses) {
        // Skip if the token name already exists in addresses.json
        if (existingTokenNames.has(name)) {
            console.log(`Skipping token "${name}" as it already exists in addresses.json.`);
            continue;
        }

        const isFreezeable = await isTokenFreezeable(mintAddress);

        if (!isFreezeable) {
            nonFreezeableTokens.push([mintAddress, decimals, name]);  // Keep the structure with name
        }
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
