const express = require("express");
const cors = require("cors");
const { PlaidApi, PlaidEnvironments, Configuration } = require("plaid");

const app = express();
app.use(cors());
app.use(express.json());

const plaidConfig = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || "sandbox"],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(plaidConfig);

app.get("/", (req, res) => {
  res.send("Backend is Running");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", plaidEnv: process.env.PLAID_ENV || "sandbox" });
});

app.post("/api/plaid/create-link-token", async (req, res) => {
  try {
    const { userId } = req.body;
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: userId || "user-1" },
      client_name: "My Two Weeks",
      products: ["transactions"],
      country_codes: ["US"],
      language: "en",
    });
    res.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error("Link token error:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

app.post("/api/plaid/exchange-token", async (req, res) => {
  try {
    const { public_token } = req.body;
    const response = await plaidClient.itemPublicTokenExchange({ public_token });
    const accessToken = response.data.access_token;
    const accountsResponse = await plaidClient.accountsGet({ access_token: accessToken });
    res.json({ access_token: accessToken, accounts: accountsResponse.data.accounts });
  } catch (error) {
    console.error("Exchange token error:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

app.post("/api/plaid/transactions", async (req, res) => {
  try {
    const { access_token, start_date, end_date } = req.body;
    const response = await plaidClient.transactionsGet({
      access_token,
      start_date: start_date || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
      end_date: end_date || new Date().toISOString().slice(0, 10),
    });
    res.json({ transactions: response.data.transactions });
  } catch (error) {
    console.error("Transactions error:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
