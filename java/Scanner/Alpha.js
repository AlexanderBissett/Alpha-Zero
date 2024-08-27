import axios from "axios";

let days    = 1;
let hours   = 1;
let minutes = 30;
let seconds = 60;
let desired_time = days * hours * minutes * seconds;

const time_right_now = Math.floor(Date.now() / 1000);
const time_filter = time_right_now - desired_time;

// Define a hashmap (Map in JavaScript) to store the results
const tokenResults = new Map();

axios
  .post(
    "https://graph.defined.fi/graphql",
    {
      //query for Raydium
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
    },{
      headers: {
        "Content-Type": "application/json",
        "Authorization": "f489353be7368dc360236c9e9555c629cabad054" //API key Codex
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
    });

    console.log("Token Results Map:", tokenResults);
  })
  .catch((error) => {
    console.error(error);
  });