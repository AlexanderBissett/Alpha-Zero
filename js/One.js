"use strict";
const fs = require('fs');
const path = require('path');
const { Transaction, VersionedTransaction, sendAndConfirmTransaction } = require('@solana/web3.js');
const { NATIVE_MINT } = require('@solana/spl-token');
const axios = require('axios');
const { fetchTokenAccountData, owner, connection } = require('C:/Users/Alexander/AlphaZero/js/A0');
const { API_URLS } = require('@raydium-io/raydium-sdk-v2');
const { exec } = require('child_process');

// Function to create a new token account
const createTokenAccount = () => {
    return new Promise((resolve, reject) => {
        exec('spl-token create-account So11111111111111111111111111111111111111112', (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing command: ${stderr}`);
                reject(error);
                return;
            }
            console.log(`Token account creation output: ${stdout}`);
            resolve(stdout);
        });
    });
};

// Function to fetch token accounts for a given address and extract the balance
const fetchTokenAccounts = (address) => {
    return new Promise((resolve, reject) => {
        exec(`spl-token accounts ${address}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing command: ${stderr}`);
                reject(error);
                return;
            }
            
            // Use regex to extract the balance from the output
            const balanceMatch = stdout.match(/^\s*([\d.]+)\s*$/m);
            if (balanceMatch) {
                const balance = parseFloat(balanceMatch[1]);
                resolve(balance);
            } else {
                console.error('Failed to extract balance from token accounts output.');
                reject(new Error('Failed to extract balance.'));
            }
        });
    });
};

// Function to run all the logic, including loading addresses
const runProcess = async () => {
    // Attempt to create the token account
    try {
        await createTokenAccount();
    } catch (error) {
        console.error('Failed to create token account. Continuing to process addresses.');
        // Proceed even if account creation fails
    }

    // Path to the file where unique addresses are stored
    const addressesFilePath = path.join(__dirname, 'Scanner', 'addresses.json');

    // Load addresses from the file
    let addresses = [];
    if (fs.existsSync(addressesFilePath)) {
        const fileContent = fs.readFileSync(addressesFilePath, 'utf-8');
        addresses = JSON.parse(fileContent);
    } else {
        console.error('addresses.json file not found.');
        return; // Exit the function if the file is not found
    }

    // Function to mark an address as reversed and record the timestamp
    const markAddressAsReversed = (address) => {
        const timestamp = new Date().toISOString(); // Get the current timestamp in ISO format
        addresses = addresses.map(addr =>
            addr.address === address ? { ...addr, reversed: true, reversedAt: timestamp } : addr
        );
        fs.writeFileSync(addressesFilePath, JSON.stringify(addresses, null, 2));
    };

    // Function to process an address (swap to SOL)
    const processAddress = async (addressObj) => {
        const inputMint = addressObj.address;
        const outputMint = NATIVE_MINT.toBase58(); // Convert to SOL
        const decimals = addressObj.decimals;

        // Fetch balance for the input address
        let balance;
        try {
            balance = await fetchTokenAccounts(inputMint);
            console.log(`Fetched balance for ${inputMint}:`, balance);
        } catch (error) {
            console.error('Error fetching token accounts data:', error);
            return;
        }

        // Calculate the amount based on the balance
        const amount = balance * 10 ** decimals; // Use the balance value

        const slippage = 5; // in percent, for this example, 0.5 means 0.5%
        const txVersion = 'LEGACY'; // or 'LEGACY'
        const isV0Tx = txVersion === 'LEGACY';

        const [isInputSol, isOutputSol] = [inputMint === NATIVE_MINT.toBase58(), outputMint === NATIVE_MINT.toBase58()];

        let tokenAccounts;
        try {
            tokenAccounts = (await fetchTokenAccountData()).tokenAccounts;
        } catch (error) {
            console.error('Error fetching token account data:', error);
            return;
        }

        const inputTokenAcc = tokenAccounts.find(a => a.mint.toBase58() === inputMint)?.publicKey;
        const outputTokenAcc = tokenAccounts.find(a => a.mint.toBase58() === outputMint)?.publicKey;

        if (!inputTokenAcc && !isInputSol) {
            console.error('Do not have input token account');
            return;
        }

        let data, swapResponse, swapTransactions, allTxBuf, allTransactions;
        try {
            data = (await axios.get(`${API_URLS.BASE_HOST}${API_URLS.PRIORITY_FEE}`)).data;
            console.log("Fetched priority fee data:", data);

            swapResponse = (await axios.get(`${API_URLS.SWAP_HOST}/compute/swap-base-in?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippage * 100}&txVersion=${txVersion}`)).data;
            console.log("Fetched swap response:", swapResponse);

            if (!swapResponse || !swapResponse.data) {
                console.error('Swap response data is undefined or invalid');
                return;
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
                return;
            }

            allTxBuf = swapTransactions.data.map(tx => Buffer.from(tx.transaction, 'base64'));
            allTransactions = allTxBuf.map(txBuf => isV0Tx ? VersionedTransaction.deserialize(txBuf) : Transaction.from(txBuf));
        } catch (error) {
            console.error('Error fetching or processing transactions:', error);
            return;
        }

        console.log(`Total ${allTransactions.length} transactions`, swapTransactions);
        let idx = 0;
        if (!isV0Tx) {
            for (const tx of allTransactions) {
                try {
                    console.log(`${++idx} transaction sending...`);
                    tx.sign(owner);
                    console.log('Signed transaction:', tx);
                    const txId = await sendAndConfirmTransaction(connection, tx, [owner], { skipPreflight: true });
                    console.log(`${idx} transaction confirmed, txId: ${txId}`);
                    markAddressAsReversed(inputMint);  // Mark as reversed after successful transaction
                } catch (error) {
                    console.error('Error sending transaction:', error);
                }
            }
        } else {
            for (const tx of allTransactions) {
                try {
                    idx++;
                    tx.sign([owner]);
                    console.log('Signed transaction:', tx);
                    const txId = await connection.sendTransaction(tx, { skipPreflight: true });
                    const { lastValidBlockHeight, blockhash } = await connection.getLatestBlockhash({ commitment: 'finalized' });
                    console.log(`${idx} transaction sending..., txId: ${txId}`);
                    await connection.confirmTransaction({
                        blockhash: blockhash,
                        lastValidBlockHeight: lastValidBlockHeight,
                        signature: txId,
                    }, 'confirmed');
                    console.log(`${idx} transaction confirmed`);
                    markAddressAsReversed(inputMint);  // Mark as reversed after successful transaction
                } catch (error) {
                    console.error('Error sending transaction:', error);
                }
            }
        }
    };

    // Function to process each address one by one
    const processAddresses = async () => {
        // Get all non-reversed addresses
        const nonReversedAddresses = addresses.filter(addr => !addr.reversed);

        if (nonReversedAddresses.length === 0) {
            console.log("No non-reversed addresses found, will check again in 5 seconds.");
            return;
        }

        for (const addressObj of nonReversedAddresses) {
            console.log("Processing address:", addressObj.address);
            await processAddress(addressObj); // Pass the whole address object
            // MarkAddressAsReversed is now inside processAddress and called only on success
        }
    };

    // Start processing
    await processAddresses();

    // Schedule the next run after the current process completes
    setTimeout(runProcess, 5000);
};

// Start processing immediately
runProcess();