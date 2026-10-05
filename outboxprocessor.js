const { connectDB, sql } = require("./db");
const { sender } = require("./serviceBus");

async function processOutbox() {
  try {
    const pool = await connectDB();

    const result = await pool.request().query(`
      SELECT TOP 10 *
      FROM TransactionOutbox
      WHERE status = 'PENDING'
      ORDER BY createdAt ASC
    `);

    for (const message of result.recordset) {
      try {
        console.log(
          `📦 Processing outbox message ${message.id}`
        );

    await sender.sendMessages({
    body: {
    transactionId: message.transactionId,
    ...JSON.parse(message.messageBody),
  },
});

        await pool
          .request()
          .input("id", sql.Int, message.id)
          .query(`
            UPDATE TransactionOutbox
            SET
              status = 'SENT',
              processedAt = GETDATE()
            WHERE id = @id
          `);

        console.log(
          `✅ Outbox message ${message.id} sent successfully`
        );

      } catch (error) {
        console.error(
          `❌ Failed to send outbox message ${message.id}:`,
          error.message
        );
      }
    }

  } catch (error) {
    console.error(
      "❌ Outbox processor error:",
      error.message
    );
  }
}

processOutbox();