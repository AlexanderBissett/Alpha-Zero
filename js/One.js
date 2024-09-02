"use strict";
const fs = require('fs');
const path = require('path');
const { Transaction, VersionedTransaction, sendAndConfirmTransaction } = require('@solana/web3.js');
const { NATIVE_MINT } = require('@solana/spl-token');
const axios = require('axios');
const { fetchTokenAccountData, owner, connection } = require('C:/Users/Alexander/AlphaZero/js/A0');
const { API_URLS } = require('@raydium-io/raydium-sdk-v2');

// Path to the file where unique addresses are stored
const addressesFilePath = path.join(__dirname, 'Scanner', 'addresses.json');

let isProcessing = false; // Global flag to track if processing is ongoing

// Function to mark an address as reversed and record the timestamp
const markAddressAsReversed = (address) => {
    const timestamp = new Date().toISOString(); // Get the current timestamp in ISO format
    let addresses = JSON.parse(fs.readFileSync(addressesFilePath, 'utf-8'));
    addresses = addresses.map(addr =>
        addr.address === address ? { ...addr, reversed: true, reversedAt: timestamp } : addr
    );
    fs.writeFileSync(addressesFilePath, JSON.stringify(addresses, null, 2));
};

// Function to process an address (swap to SOL) and ensure all transactions are confirmed
const processAddress = async (inputMint, decimals, balance) => {
    const outputMint = NATIVE_MINT.toBase58(); // Convert to SOL
    const amount = balance * 10 ** decimals; // Use balance from the address data

    // Log the calculated amount for debugging
    console.log(`Processing address: ${inputMint}`);
    console.log(`Calculated amount: ${amount} (balance: ${balance}, decimals: ${decimals})`);

    // Ensure amount is a valid number
    if (isNaN(amount) || amount <= 0) {
        console.error(`Invalid amount calculated: ${amount}`);
        return false; // Indicate failure
    }

    const slippage = 5; // Slippage in percent
    const txVersion = 'LEGACY'; // Transaction version
    const isV0Tx = txVersion === 'LEGACY';

    const [isInputSol, isOutputSol] = [inputMint === NATIVE_MINT.toBase58(), outputMint === NATIVE_MINT.toBase58()];

    let tokenAccounts;
    try {
        tokenAccounts = (await fetchTokenAccountData()).tokenAccounts;
    } catch (error) {
        console.error('Error fetching token account data:', error);
        return false; // Indicate failure
    }

    const inputTokenAcc = tokenAccounts.find(a => a.mint.toBase58() === inputMint)?.publicKey;
    const outputTokenAcc = tokenAccounts.find(a => a.mint.toBase58() === outputMint)?.publicKey;

    if (!inputTokenAcc && !isInputSol) {
        console.error('Do not have input token account');
        return false; // Indicate failure
    }

    let data, swapResponse, swapTransactions, allTxBuf, allTransactions;
    try {
        data = (await axios.get(`${API_URLS.BASE_HOST}${API_URLS.PRIORITY_FEE}`)).data;
        console.log("Fetched priority fee data:", data);

        swapResponse = (await axios.get(`${API_URLS.SWAP_HOST}/compute/swap-base-in?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippage * 100}&txVersion=${txVersion}`)).data;
        console.log("Fetched swap response:", swapResponse);

        if (!swapResponse || !swapResponse.data) {
            console.error('Swap response data is undefined or invalid');
            return false; // Indicate failure
        }

        if (!swapResponse.success) {
            console.error(`Swap failed: ${swapResponse.msg}`);
            return false; // Indicate failure
        }

        swapTransactions = (await axios.post(`${API_URLS.SWAP_HOST}/transaction/swap-base-in`, {
            computeUnitPriceMicroLamports: String(data.data.default.h),
            swapResponse: swapResponse,
            txVersion: txVersion,
            wallet: owner.publicKey.toBase58(),
            wrapSol: isInputSol,
            unwrapSol: isOutputSol, // true means output mint receives SOL
            inputAccount: isInputSol ? undefined : inputTokenAcc?.toBase58(),
            outputAccount: isOutputSol ? undefined : outputTokenAcc?.toBase58(),
        })).data;

        console.log("Fetched swap transactions:", swapTransactions);

        if (!swapTransactions || !swapTransactions.data) {
            console.error('Swap transactions data is undefined or invalid');
            return false; // Indicate failure
        }

        allTxBuf = swapTransactions.data.map(tx => Buffer.from(tx.transaction, 'base64'));
        allTransactions = allTxBuf.map(txBuf => isV0Tx ? VersionedTransaction.deserialize(txBuf) : Transaction.from(txBuf));
    } catch (error) {
        console.error('Error fetching or processing transactions:', error);
        return false; // Indicate failure
    }

    console.log(`Total ${allTransactions.length} transactions`, swapTransactions);

    let allConfirmed = true;
    let idx = 0;

    if (!isV0Tx) {
        for (const tx of allTransactions) {
            try {
                console.log(`${++idx} transaction sending...`);
                tx.sign([owner]);
                const txId = await sendAndConfirmTransaction(connection, tx, [owner], { skipPreflight: true });
                console.log(`${idx} transaction confirmed, txId: ${txId}`);
                // Mark the address as reversed only if all transactions are confirmed
                if (idx === allTransactions.length) {
                    markAddressAsReversed(inputMint);
                }
            } catch (error) {
                console.error('Error sending transaction:', error);
                allConfirmed = false; // Set flag to false if any transaction fails
                break; // Exit the loop on error
            }
        }
    } else {
        for (const tx of allTransactions) {
            try {
                idx++;
                tx.sign([owner]);
                const txId = await connection.sendTransaction(tx, { skipPreflight: true });
                const { lastValidBlockHeight, blockhash } = await connection.getLatestBlockhash({ commitment: 'finalized' });
                console.log(`${idx} transaction sending..., txId: ${txId}`);
                await connection.confirmTransaction({
                    blockhash: blockhash,
                    lastValidBlockHeight: lastValidBlockHeight,
                    signature: txId,
                }, 'confirmed');
                console.log(`${idx} transaction confirmed`);
                // Mark the address as reversed only if all transactions are confirmed
                if (idx === allTransactions.length) {
                    markAddressAsReversed(inputMint);
                }
            } catch (error) {
                console.error('Error sending transaction:', error);
                allConfirmed = false; // Set flag to false if any transaction fails
                break; // Exit the loop on error
            }
        }
    }

    return allConfirmed; // Return true only if all transactions were confirmed
};

// Function to process addresses sequentially
const processAddressesSequentially = async () => {
    if (isProcessing) {
        console.log("Processing already in progress. Skipping this run.");
        return; // Skip if already processing
    }

    isProcessing = true; // Set the flag to indicate processing is in progress

    let addresses = [];

    // Load addresses from the file
    if (fs.existsSync(addressesFilePath)) {
        const fileContent = fs.readFileSync(addressesFilePath, 'utf-8');
        addresses = JSON.parse(fileContent);
    } else {
        console.error('addresses.json file not found.');
        isProcessing = false; // Reset the flag
        return; // Exit the function if the file is not found
    }

    // Filter non-reversed addresses
    const nonReversedAddresses = addresses.filter(addr => !addr.reversed);

    if (nonReversedAddresses.length === 0) {
        console.log("No non-reversed addresses found, will check again in 5 seconds.");
        isProcessing = false; // Reset the flag
        return;
    }

    for (const addressObj of nonReversedAddresses) {
        const { address, decimals, balance } = addressObj; // Extract address, decimals, and balance

        // Process the current address and wait for completion
        console.log("Processing address:", address);
        const success = await processAddress(address, decimals, balance);
        
        // Only proceed if processing was successful
        if (!success) {
            console.error(`Failed to process address: ${address}`);
            // Optionally, handle the failure case (e.g., retry, log more details)
        }
    }

    isProcessing = false; // Reset the flag once processing is complete
};

// Set an interval to run the processAddressesSequentially function every 5 seconds
const interval = 5000; // 5 seconds
setInterval(async () => {
    await processAddressesSequentially();
}, interval);

// Start processing immediately
processAddressesSequentially();