import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getMint } from '@solana/spl-token';
import { tokenAddresses } from '../Scanner/scanlog/Current_list.mjs';  // Import token addresses from Scanner.js
import fs from 'fs';  // For writing to a file

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

    for (const [mintAddress, decimals] of tokenAddresses) {
        const isFreezeable = await isTokenFreezeable(mintAddress);

        if (!isFreezeable) {
            nonFreezeableTokens.push([mintAddress, decimals]);  // Keep the same structure
        }
    }

    // Write non-freezeable tokens to Secure_current_list.mjs
    const outputData = `export const tokenAddresses = ${JSON.stringify(nonFreezeableTokens, null, 4)};`;

    fs.writeFileSync('../Scanner/scanlog/Secure_current_list.mjs', outputData, 'utf8');
    console.log('Secure_current_list.mjs has been updated with non-freezeable tokens.');
}

// Example usage with imported token addresses
checkFreezeableTokens(tokenAddresses);