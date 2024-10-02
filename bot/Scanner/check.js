import { Connection, PublicKey } from '@solana/web3.js';
import pkg from '@raydium-io/raydium-sdk';
const { Raydium } = pkg; // Destructure Raydium from the imported package

// Replace with your own token address and network
const TOKEN_ADDRESS = '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'; // Replace with your token address
const NETWORK = 'https://api.mainnet-beta.solana.com'; // or testnet, devnet

const connection = new Connection(NETWORK);

async function getRaydiumPools() {
    try {
        // Assuming there's a method to fetch liquidity pools; this may differ based on SDK version.
        const pools = await Raydium.fetchAllPools(connection);
        return pools;
    } catch (error) {
        console.error("Error fetching pools:", error);
        return [];
    }
}

async function checkTokenSwappable(tokenAddress) {
    try {
        const tokenPubKey = new PublicKey(tokenAddress);

        // Fetch all pools from Raydium
        const pools = await getRaydiumPools();

        // Check if the token is part of any liquidity pool
        const isSwappable = pools.some(pool => {
            const { tokenA, tokenB } = pool;
            return tokenA.equals(tokenPubKey) || tokenB.equals(tokenPubKey);
        });

        return isSwappable;
    } catch (error) {
        console.error("Error checking token:", error);
        return false;
    }
}

checkTokenSwappable(TOKEN_ADDRESS).then(isSwappable => {
    if (isSwappable) {
        console.log(`Token ${TOKEN_ADDRESS} can be swapped on Raydium.`);
    } else {
        console.log(`Token ${TOKEN_ADDRESS} cannot be swapped on Raydium.`);
    }
});