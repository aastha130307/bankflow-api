const express = require("express");
const { connectDB, sql } = require("./db");
const { sender } = require("./serviceBus");

const app = express();

app.use(express.json());


app.get("/", (req, res) => {
  res.json({
    message: "BankFlow API is running 🚀",
  });
});

async function sendMessageWithRetry(message, maxRetries = 3) {
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      await sender.sendMessages(message);

      console.log("✅ Message sent to Service Bus");
      return;
    } catch (error) {
      attempt++;

      console.error(
        `❌ Service Bus send failed (attempt ${attempt}):`,
        error.message
      );

      if (attempt > maxRetries) {
        console.error("❌ All Service Bus retry attempts failed");
        throw error;
      }

      const delay = Math.pow(2, attempt - 1) * 1000;

      console.log(
        `⏳ Retrying in ${delay / 1000} seconds...`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}


app.post("/transactions", async (req, res) => {
  try {
    const { customerId, amount, transactionType, transactionStatus } = req.body;

    if (!customerId || amount===undefined || !transactionType) {
  return res.status(400).json({
    message: "customerId, amount and transactionType are required",
  });
}

if (typeof amount !== "number" || amount <= 0) {
  return res.status(400).json({
    message: "amount must be a positive number",
  });
}

const allowedTransactionTypes = ["DEPOSIT", "WITHDRAWAL", "TRANSFER"];
const allowedTransactionStatus = ["SUCCESS","PENDING","FAILED"];

if (!allowedTransactionTypes.includes(transactionType.toUpperCase())) {
  return res.status(400).json({
    message: "transactionType must be DEPOSIT, WITHDRAWAL or TRANSFER",
  });
}

if (!transactionStatus || !allowedTransactionStatus.includes(transactionStatus.toUpperCase())) {
  return res.status(400).json({
    message: "transactionStatus must be SUCCESS,PENDING OR FAILED",
  });
}

    const pool = await connectDB();

    const result = await pool
  .request()
  .input("customerId", sql.VarChar, customerId)
  .input("amount", sql.Decimal(18, 2), amount)
  .input("transactionType", sql.VarChar, transactionType.toUpperCase())
  .input("transactionStatus", sql.VarChar, transactionStatus.toUpperCase())
  .query(`
    INSERT INTO Transactions
    (customerId, amount, transactionType, transactionStatus)
    OUTPUT INSERTED.*
    VALUES
    (@customerId, @amount, @transactionType, @transactionStatus)
  `);

const transaction = result.recordset[0];

const messageBody = JSON.stringify({
  customerId: transaction.customerId,
  amount: transaction.amount,
  transactionType: transaction.transactionType,
  transactionStatus: transaction.transactionStatus,
});

await pool
  .request()
  .input("transactionId", sql.Int, transaction.id)
  .input("messageBody", sql.NVarChar(sql.MAX), messageBody)
  .query(`
    INSERT INTO TransactionOutbox
    (transactionId, messageBody)
    VALUES
    (@transactionId, @messageBody)
  `);

console.log("✅ Transaction sent to Service Bus");

    res.status(201).json({
  message: "Transaction created successfully",
  transaction,
});

  } catch (error) {
    console.error("❌ Transaction error:", error.message);

    res.status(500).json({
      message: "Failed to create transaction",
      error: error.message,
    });
  }
});

app.get("/transactions", async (req, res) => {
  try {
    const pool = await connectDB();

    const result = await pool.request().query(`
      SELECT *
      FROM Transactions
      ORDER BY createdAt DESC
    `);

    res.status(200).json({
      message: "Transactions fetched successfully",
      transactions: result.recordset,
    });

  } catch (error) {
    console.error("❌ Fetch transactions error:", error.message);

    res.status(500).json({
      message: "Failed to fetch transactions",
      error: error.message,
    });
  }
});



const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`🚀 BankFlow API running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Could not start BankFlow API");
  }
}

startServer();