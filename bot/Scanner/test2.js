
import axios from "axios";

const tokenAddress = '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'

// Function to check if a token can be swapped on Raydium and get additional data
async function checkTokenSwappable(tokenAddress) {
    try {
        const response = await axios.post(
            "https://graph.defined.fi/graphql",
            {
                // GraphQL query to check token and get priceUSD and high24
                query: `{
    filterTokens(
      filters: {
          exchangeAddress: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"
          network: [1399811149]
      }
      tokens:"4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R"
      limit: 5
    ) {
      results {
        priceUSD
        high1
        exchanges {
          name
        }
        token {
          address
          decimals
          networkId
        }
      }
    }
  }`