"use strict";
const fs = require('fs');
const path = require('path');
const { sendAndConfirmTransaction, Transaction, VersionedTransaction } = require('@solana/web3.js');
const { NATIVE_MINT } = require('@solana/spl-token');
const axios = require('axios');
const { fetchTokenAccountData, owner, connection } = require('./A0.js');
const { API_URLS } = require('@raydium-io/raydium-sdk-v2');

// Path to the files where addresses and capital are stored
const addressesFilePath = path.join(__dirname, '..', 'Workers', 'addresses.json');
const capitalFilePath = path.join(__dirname, '..', 'Workers', 'current_capital.json');
const configFilePath = path.join(__dirname, '..', 'Config.json');

let isProcessing = false; // Global flag to track if processing is ongoing

// Utility function to introduce a delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Function to mark an address as used and record the timestamp
const markAddressAsUsed = (address) => {
    const timestamp = Math.floor(Date.now() / 1000); // Get the current timestamp in Unix time
    let addresses = JSON.parse(fs.readFileSync(addressesFilePath, 'utf-8'));
    addresses = addresses.map(addr =>
        addr.address === address ? { ...addr, used: true, usedAt: timestamp } : addr
    );
    fs.writeFileSync(addressesFilePath, JSON.stringify(addresses, null, 2));
};

// Function to process an address using the updated `apiSwap` method
const apiSwap = async (outputMint) => {
    const inputMint = NATIVE_MINT.toBase58();

    // Read the config file
    const config = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
    const amountType = config.amountType; // "static" or "dynamic"
    let amount;

    if (amountType === 'static') {
        amount = config.staticAmount; // Use the static amount
    } else if (amountType === 'dynamic') {
        const capital = JSON.parse(fs.readFileSync(capitalFilePath, 'utf-8')).lamports;
        const percentageToUse = config.percentageToUse || 0.25; // Default to 25% if not specified
        amount = Math.floor(capital * percentageToUse); // Calculate the amount based on the percentage
    } else {
        console.error('Invalid amount type specified in config. Defaulting to static amount of 0.');
        amount = 0; // Fallback if configuration is invalid
    }

    const slippage = 5; // Slippage in percent (0.5 = 0.5%)
    const txVersion = 'V0'; // or LEGACY
    const isV0Tx = txVersion === 'V0';

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
        console.log('Fetching transaction data...');
        data = (await axios.get(`${API_URLS.BASE_HOST}${API_URLS.PRIORITY_FEE}`)).data;
        swapResponse = (await axios.get(`${API_URLS.SWAP_HOST}/compute/swap-base-in?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippage * 100}&txVersion=${txVersion}`)).data;
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
        allTxBuf = swapTransactions.data.map(tx => Buffer.from(tx.transaction, 'base64'));
        allTransactions = allTxBuf.map(txBuf => isV0Tx ? VersionedTransaction.deserialize(txBuf) : Transaction.from(txBuf));
    } catch (error) {
        console.error('Error fetching or processing transactions:', error);
        return false; // Indicate failure
    }

    console.log(`Total ${allTransactions.length} transactions`, swapTransactions);

    // Process each transaction and wait for confirmation
    let allConfirmed = true;
    for (const [idx, tx] of allTransactions.entries()) {
        try {
            console.log(`${idx + 1} transaction sending...`);
            tx.sign([owner]); // Ensure signers is an array
            let txId;
            if (!isV0Tx) {
                txId = await sendAndConfirmTransaction(connection, tx, [owner], { skipPreflight: true });
            } else {
                txId = await connection.sendTransaction(tx, { skipPreflight: true });
                const { lastValidBlockHeight, blockhash } = await connection.getLatestBlockhash({ commitment: 'finalized' });
                await connection.confirmTransaction({
                    blockhash: blockhash,
                    lastValidBlockHeight: lastValidBlockHeight,
                    signature: txId,
                }, 'confirmed');
            }
            console.log(`${idx + 1} transaction confirmed, txId: ${txId}`);
            markAddressAsUsed(outputMint);  // Mark as used after successful transaction
        } catch (error) {
            console.error('Error sending transaction:', error);
            allConfirmed = false; // Set flag to false if any transaction fails
        }
    }

    console.log(`Completed processing for address: ${outputMint}`);
    return allConfirmed; // Return true only if all transactions were confirmed
};

// Function to process addresses sequentially
const processAddressesSequentially = async () => {
    if (isProcessing) {
        console.log("Processing already in progress. Skipping this run.");
        return; // Skip if already processing
    }

    isProcessing = true; // Set the flag to indicate processing is in progress

    try {
        let addresses = [];

        // Load addresses from the file
        if (fs.existsSync(addressesFilePath)) {
            const fileContent = fs.readFileSync(addressesFilePath, 'utf-8');
            addresses = JSON.parse(fileContent);
        } else {
            console.error('addresses.json file not found.');
            return; // Exit the function if the file is not found
        }

        // Filter unused wallet addresses
        const unusedWalletAddresses = addresses.filter(addr => !addr.used && addr.wallet);

        if (unusedWalletAddresses.length === 0) {
            console.log("No unused wallet addresses found, will check again in 5 seconds.");
            return;
        }

        for (const addressObj of unusedWalletAddresses) {
            const address = addressObj.address;

            // Process the current address and wait for completion
            console.log("Processing address:", address);
            const success = await apiSwap(address);

            // Only proceed if processing was successful
            if (success) {
                console.log(`Successfully processed address: ${address}. Waiting for 5 seconds before continuing.`);
                await delay(5000);  // Wait for 5 seconds before continuing
            } else {
                console.error(`Failed to process address: ${address}`);
                // Optionally, handle the failure case (e.g., retry, log more details)
            }

            // Wait for an additional 5 seconds before processing the next address
            await delay(5000);
        }
    } catch (error) {
        console.error('Unexpected error in processing addresses:', error);
    } finally {
        isProcessing = false; // Reset the flag once processing is complete
        // Do not re-run the process
        // setTimeout(processAddressesSequentially, interval); // Commented out to ensure it runs only once
    }
};

// Start processing immediately
processAddressesSequentially();