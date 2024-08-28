import axios from "axios";
import fs from "fs";
import { exec } from "child_process";

// Function to execute the API request and save the results
function fetchAndSaveTokenResults() {
  // Calculate the time you want to measure from in seconds
  let days = 1;
  let hours = 1;
  let minutes = 30;
  let seconds = 60;
  let desired_time = days * hours * minutes * seconds;

  // Get the current time in seconds since the epoch
  const time_right_now = Math.floor(Date.now() / 1000);
  const time_filter = time_right_now - desired_time;

  // Define a hashmap (Map in JavaScript) to store the results
  const tokenResults = new Map();
  const tokenAddresses = [];

  axios
    .post(
      "https://graph.defined.fi/graphql",
      {
        // Query for Raydium
        query: `{
    filterTokens(
      filters: {
        createdAt : { gte: ${time_filter} }
        volume1: {gte: 10000}
        liquidity: {gte: 5000}
        exchangeAddress: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"
        network: [1399811149]
      }
      limit: 30
    ) {
      results {
        volume1
        liquidity
        marketCap
        priceUSD
        exchanges {
          name
        }
        token {
          address
          name
          networkId
          symbol
        }
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
    )
    .then((response) => {
      const tokens = response.data.data.filterTokens.results;

      // Store each token result in the hashmap using the token address as the key
      tokens.forEach((token) => {
        tokenResults.set(token.token.address, {
          volume1: token.volume1,
          liquidity: token.liquidity,
          marketCap: token.marketCap,
          priceUSD: token.priceUSD,
          exchanges: token.exchanges.map((exchange) => exchange.name),
          name: token.token.name,
          symbol: token.token.symbol,
          networkId: token.token.networkId,
        });
        tokenAddresses.push(token.token.address); // Collect token addresses
      });

      // Get the current date and time for the filename in the desired format
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const seconds = String(now.getSeconds()).padStart(2, "0");

      const formattedDate = `${year}-${month}-${day}--${hours}-${minutes}-${seconds}`;
      const filenameBase = `TokenResults_${formattedDate}`;
      const txtFilename = `${filenameBase}.txt`;
      const jsFilename = `${filenameBase}.js`;

      // Write the token addresses to a JavaScript file
      const tokenAddressesContent = `export const tokenAddresses = ${JSON.stringify(tokenAddresses)};`;
      fs.writeFileSync(jsFilename, tokenAddressesContent);
      console.log(`Token addresses written to ${jsFilename}`);

      // Format the output for the text file
      let output = "Token Results:\n";
      tokenResults.forEach((value, key) => {
        output += `Token Address: ${key}\n`;
        output += `Name: ${value.name}\n`;
        output += `Symbol: ${value.symbol}\n`;
        output += `Volume1: ${value.volume1}\n`;
        output += `Liquidity: ${value.liquidity}\n`;
        output += `MarketCap: ${value.marketCap}\n`;
        output += `PriceUSD: ${value.priceUSD}\n`;
        output += `Exchanges: ${value.exchanges.join(", ")}\n`;
        output += `NetworkId: ${value.networkId}\n`;
        output += `\n`;
      });

      // Write the output to a text file
      fs.writeFileSync(txtFilename, output);

      console.log(`Results written to ${txtFilename}`);
    })
    .catch((error) => {
      console.error(error);
    });
}

// Run the function immediately and then every 5 minutes
fetchAndSaveTokenResults();
setInterval(fetchAndSaveTokenResults, 300000); // 300000 milliseconds = 5 minutes
