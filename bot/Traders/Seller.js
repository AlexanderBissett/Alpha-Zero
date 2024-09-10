"use strict";
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process'); // Import exec from child_process
const { Transaction, VersionedTransaction, sendAndConfirmTransaction } = require('@solana/web3.js');
const { NATIVE_MINT } = require('@solana/spl-token');
const axios = require('axios');
const { fetchTokenAccountData, owner, connection } = require('./A0.js');
const { API_URLS } = require('@raydium-io/raydium-sdk-v2');

// Path to the file where unique addresses are stored
const addressesFilePath = path.join(__dirname, '..', 'Workers', 'addresses.json');

// Utility function to introduce a delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Function to mark an address as reversed and record the timestamp
const markAddressAsReversed = (address) => {
    const timestamp = Math.floor(Date.now() / 1000); // Get the current timestamp in seconds (Linux timestamp)
    let addresses = JSON.parse(fs.readFileSync(addressesFilePath, 'utf-8'));
    addresses = addresses.map(addr =>
        addr.address === address ? { ...addr, reversed: true, reversedAt: timestamp } : addr
    );
    fs.writeFileSync(addressesFilePath, JSON.stringify(addresses, null, 2));
};

// Function to run the spl-token wrap command
const runWrapCommand = (amount) => {
    return new Promise((resolve) => {
        const command = `spl-token wrap ${amount}`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                // Check for the specific error message
                if (stderr.includes("Error: Account already exists:")) {
                    console.warn('Wrap command failed with specific error: Account already exists. Continuing processing.');
                    resolve(true); // Continue processing despite the specific error
                } else {
                    console.error(`Error executing command: ${error}`);
                    resolve(false); // Stop processing for other errors
                }
            } else if (stderr) {
                console.error(`stderr: ${stderr}`);
                resolve(false); // Stop processing for stderr output
            } else if (stdout.includes('Signature:')) {
                console.log('Wrap command completed successfully.');
                resolve(true); // Indicate success
            } else {
                console.error('Wrap command did not complete successfully.');
                resolve(false); // Indicate failure
            }
        });
    });
};

// Function to check if an address is eligible for processing
const isEligibleAddress = (address) => {
    const ageOfTrade = 1 * 60; // X minutes in seconds
    const currentTimestamp = Math.floor(Date.now() / 1000); // Current time in Unix timestamp

    // Check if balance is a number, used is true, and usedAt is at least older than the time in ageOfTrade
    return (
        typeof address.balance === 'number' &&
        address.used === true &&
        typeof address.usedAt === 'number' &&
        (currentTimestamp - address.usedAt) >= ageOfTrade
    );
};

// Function to process an address (swap to SOL) and ensure all transactions are confirmed
const processAddress = async (inputMint, decimals, balance) => {
    const fixedWrapAmount = 0.0005; // Fixed wrap amount in SOL

    console.log(`Processing address: ${inputMint}`);
    console.log(`Fixed wrap amount: ${fixedWrapAmount} SOL`);

    // Run the wrap command with the fixed amount and ensure it succeeds before continuing
    const wrapSuccess = await runWrapCommand(fixedWrapAmount);

    // Introduce a delay of at least 5 seconds after the wrap command
    await delay(5000);

    if (!wrapSuccess) {
        console.error('Wrap command failed. Aborting further processing.');
        return false; // Stop processing if wrap command fails
    }

    // Continue with the rest of your processing...
    const outputMint = NATIVE_MINT.toBase58(); // Convert to SOL
    const amount = balance * 10 ** decimals; // Use balance from the address data

    if (isNaN(amount) || amount <= 0) {
        console.error(`Invalid amount calculated: ${amount}`);
        return false; // Indicate failure
    }

    const slippage = 5; // Slippage in percent
    const txVersion = 'LEGACY'; // or V0
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

    let addresses = [];

    // Load addresses from the file
    if (fs.existsSync(addressesFilePath)) {
        const fileContent = fs.readFileSync(addressesFilePath, 'utf-8');
        addresses = JSON.parse(fileContent);
    } else {
        console.error('addresses.json file not found.');
        return; // Exit the function if file is not found
    }

    // Process each address sequentially
    for (const address of addresses) {
        if (address.reversed) {
            console.log(`Address ${address.address} already processed.`);
            continue; // Skip if already processed
        }

        if (!isEligibleAddress(address)) {
            console.log(`Address ${address.address} is not eligible for processing.`);
            continue; // Skip if address is not eligible
        }

        const { address: inputMint, decimals, balance } = address;

        try {
            const success = await processAddress(inputMint, decimals, balance);
            if (success) {
                console.log(`Successfully processed address: ${inputMint}`);
            } else {
                console.error(`Failed to process address: ${inputMint}`);
            }
        } catch (error) {
            console.error(`Error processing address ${inputMint}:`, error);
        }

        // Introduce a delay of 7 seconds before processing the next address
        await delay(7000);
    }
};

// Start the processing once
processAddressesSequentially();