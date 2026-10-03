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


app.post("/transactions", async (req, res) => {
  try {
    const { customerId, amount, transactionType, transactionStatus } = req.body;

    if (!customerId || !amount || !transactionType) {
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

if (!allowedTransactionStatus.includes(transactionStatus.toUpperCase())) {
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
      .input("transactionStatus",sql.VarChar,transactionStatus.toUpperCase())
      .query(`
        INSERT INTO Transactions
        (customerId, amount, transactionType,transactionStatus)
        OUTPUT INSERTED.*
        VALUES
        (@customerId, @amount, @transactionType, @transactionStatus)
      `);

      await sender.sendMessages({
  body: {
    customerId,
    amount,
    transactionType: transactionType.toUpperCase(),
    transactionStatus: transactionStatus.toUpperCase(),
  },
});

console.log("✅ Transaction sent to Service Bus");

    res.status(201).json({
      message: "Transaction created successfully",
      transaction: result.recordset[0],
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