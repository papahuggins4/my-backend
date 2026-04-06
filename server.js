const express = require("express");
const cors = require("cors");
const { Configuration, PlaidApi, PlaidEnvironments } = require("plaid");

const app = express();
app.use(cors());
app.use(express.json());

// ─────────────────────────────────────────────────────────────────────────────
// PLAID CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = process.env.PLAID_ENV || "sandbox";

const configuration = new Configuration({
  basePath: PlaidEnvironments[PLAID_ENV],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": PLAID_CLIENT_ID,
      "PLAID-SECRET": PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// Root route
app.get("/", (req, res) => {
  res.send("Backend is Running");
});

// Health check — used by the app to verify backend is reachable
app.get("/health", (req, res) => {
  res.json({ status: "ok", plaidEnv: PLAID_ENV });
});

// Create a Plaid Link token
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
    console.error("Error creating link token:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

// Exchange public token for access token
app.post("/api/plaid/exchange-token", async (req, res) => {
  try {
    const { public_token } = req.body;
    const response = await plaidClient.itemPublicTokenExchange({
      public_token,
    });
    const accessToken = response.data.access_token;

    // Get accounts
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    res.json({
      access_token: accessToken,
      accounts: accountsResponse.data.accounts,
    });
  } catch (error) {
    console.error("Error exchanging token:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

// Get transactions
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
    console.error("Error fetching transactions:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
