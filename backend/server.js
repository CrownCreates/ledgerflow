const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const db = require('./config/db');
const bcrypt = require('bcrypt')

const app = express();
// 🎯 Tell your backend to accept requests from your React frontend origin
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));

app.use(express.json()); // Your existing body parser


app.use(cors());
app.use(express.json());

// 🛠️ ROUTE 1: Fetch All Merchants
app.get('/api/merchants', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM merchants');
        res.status(200).json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch merchants' });
    }
});

// ==========================================
// 🛠️ ROUTE 2: Fetch Comprehensive Transaction History (with Store Name)
// 🧠 the app.get route
const calculateDebtorRisk = (dueDate, paymentStatus) => {
  // 🛡️ 1. IF THERE IS NO DUE DATE, STOP AND RETURN SAFE DEFAULT IMMEDIATELY
  if (!dueDate) {
    return { score: 0, status: "No Debt", color: "secondary" };
  }

  // 2. If it's already paid, it's 0% risk
  if (paymentStatus === 'paid') {
    return { score: 0, status: "Paid", color: "success" };
  }

  const today = new Date();
  const due = new Date(dueDate);
  
  const timeDiff = today.getTime() - due.getTime();
  const daysOverdue = Math.floor(timeDiff / (1000 * 3600 * 24));

  // 🎯 Corrected scores: High numbers = Higher Risk
  if (daysOverdue <= 0) {
    return { score: 5, status: "Good Standing", color: "success" };
  } else if (daysOverdue <= 7) {
    return { score: 25, status: "Low Risk", color: "info" };
  } else if (daysOverdue <= 21) {
    return { score: 60, status: "Medium Risk", color: "warning" };
  } else {
    return { score: 95, status: "High Risk", color: "danger" };
  }
};
// 🚀 REPLACE YOUR OLD TRANSACTION GET ROUTE WITH THIS VERSION
app.get("/api/transactions", async (req, res) => {
  const { merchant_id } = req.query;
  
  if (!merchant_id) {
    return res.status(400).json({ error: "Merchant ID is required" });
  }

  try {
    // 💡 Changed INNER JOIN to LEFT JOIN so transactions never go blank!
    const query = `
      SELECT 
        t.*, 
        c.customer_name, 
        c.phone_number AS customer_phone
      FROM transactions t
      LEFT JOIN customers c ON t.customer_id = c.customer_id
      WHERE t.merchant_id = ?
      ORDER BY t.logged_at DESC
    `;

    const [transactions] = await db.query(query, [merchant_id]);

    const analyzedTransactions = transactions.map((tx) => {
      const riskAnalysis = calculateDebtorRisk(tx.due_date, tx.payment_status);
      return { 
        ...tx, 
        ai_risk: riskAnalysis 
      };
    });

    res.json(analyzedTransactions);

  } catch (error) {
    console.error("Database error in transaction data stream:", error);
    res.status(500).json({ error: "Failed to fetch analyzed data stream" });
  }
});
// SignUp
app.post('/api/auth/signup', async (req, res) => {
    const { business_name, phone_number, password, currency } = req.body;
    if (!business_name || !phone_number || !password) {
        return res.status(400).json({ error: "All required fields must be filled." });
    }
    try {
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        const query = `INSERT INTO merchants (business_name, phone_number, password_hash, currency) VALUES (?, ?, ?, ?)`;

        db.query(query, [business_name, phone_number, passwordHash, currency || 'NGN'], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ error: "This phone number is already registered." });
                }
                return res.status(500).json({ error: "Database error." });
            }
            res.status(201).json({ message: "Account created!", merchantId: result.insertId });
        });
    } catch (error) {
        res.status(500).json({ error: "Server error." });
    }
});

// 🔑 GLOBAL LOGIN ENDPOINT: Authenticates a business
app.post('/api/auth/login', async (req, res) => {
    const { phone_number, password } = req.body;

    // 1. Instantly reject empty inputs
    if (!phone_number || !password) {
        return res.status(400).json({ error: "Please enter your phone number and password." });
    }

    const query = 'SELECT * FROM merchants WHERE phone_number = ?';

    try {
        // 🎯 FIXED: Changed to 'await' to properly query your promise-based database pool
        const [results] = await db.query(query, [phone_number]);

        // 2. If phone number doesn't exist, return IMMEDIATELY
        if (!results || results.length === 0) {
            console.log("⚠️ Login failed: Phone number not found.");
            return res.status(401).json({ error: "Invalid phone number or password." });
        }

        const merchant = results[0];

        // 3. Fallback check: If you are using plain text for testing
        if (password === merchant.password) {
            console.log("✅ Login successful (Plain text match)");
            return res.json({
                message: "Login successful!",
                merchant: {
                    id: merchant.merchant_id || merchant.id,
                    business_name: merchant.business_name
                }
            });
        }

        // 4. Secure Bcrypt Check
        const bcrypt = require('bcrypt');

        // 🎯 FIXED: Wrapped the bcrypt comparison in clean async await logic 
        const isMatch = await bcrypt.compare(password, merchant.password);

        if (!isMatch) {
            console.log("⚠️ Login failed: Password mismatch.");
            return res.status(401).json({ error: "Invalid phone number or password." });
        }

        console.log("✅ Login successful (Bcrypt match)");
        return res.json({
            message: "Login successful!",
            merchant: {
                id: merchant.merchant_id || merchant.id,
                business_name: merchant.business_name
            }
        });

    } catch (err) {
        console.error("❌ Login Database/Server Error:", err);
        return res.status(500).json({ error: "Internal server error during authentication." });
    }
}); // 🎯 Everything is balanced and closed perfectly!
// 📝 FIXED REGISTRATION ROUTE
app.post('/api/auth/register', async (req, res) => {
    const { business_name, phone_number, password } = req.body;

    if (!business_name || !phone_number || !password) {
        return res.status(400).json({ error: "All fields are required to establish an account." });
    }

    try {
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const query = `
          INSERT INTO merchants (business_name, phone_number, password) 
          VALUES (?, ?, ?)
        `;

        // 🎯 FIX: Use the promise-based wrapper or standard execution so try/catch can catch it!
        // If you are using 'mysql2/promise', use: await db.execute(query, [...])
        // If using standard mysql, execute it cleanly or return the response immediately:
        db.query(query, [business_name.trim(), phone_number, passwordHash], (err, result) => {
            if (err) {
                console.error("❌ Registration Database Error:", err);
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ error: "This phone number is already registered to a business." });
                }
                return res.status(500).json({ error: "Database failure during account creation." });
            }

            console.log(`🎉 Business Account Created Successfully: ${business_name}`);
            return res.status(201).json({
                message: "Account created successfully! You can now sign in."
            });
        });

    } catch (error) {
        console.error("❌ Catch block caught a server error:", error);
        // This ensures that even if something outside the callback throws, the server doesn't crash
        if (!res.headersSent) {
            return res.status(500).json({ error: "Server error during registration." });
        }
    }
});

// 🧾 RE-ADD TRANSACTION POST ROUTE: Saves records for a specific business
app.post('/api/transactions', async (req, res) => {
    // 🌍 Added 'currency' to the incoming request payload destructuring
    const { amount, currency, transaction_type, merchant_note, merchant_id, due_date } = req.body;

    if (!amount || !transaction_type || !merchant_id) {
        return res.status(400).json({ error: "Missing required transaction fields." });
    }

    const final_due_date = due_date || null;
    const final_status = transaction_type === 'CREDIT' ? 'pending' : 'paid';
    const final_currency = currency || 'NGN'; // Default to NGN if not provided

    // 1. Insert the new transaction row (Including dynamic currency column)
    const insertQuery = `
        INSERT INTO transactions (amount, currency, transaction_type, merchant_note, merchant_id, due_date, payment_status) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    try {
        const [result] = await db.query(insertQuery, [
            amount, 
            final_currency, // 🌍 Stored to your database
            transaction_type, 
            merchant_note || null, 
            merchant_id, 
            final_due_date, 
            final_status
        ]);
        
        console.log(`🎉 Transaction logged successfully. ID: ${result.insertId} | Currency: ${final_currency}`);

        // 🧠 AUTO-SETTLE LOGIC: If a payment was just made, check if the debt is now cleared!
        if (transaction_type === 'PAYMENT' && merchant_note) {
            
            // Step A: Fetch the original CREDIT amount for this note (matching the currency)
            const [creditRows] = await db.query(
                `SELECT amount FROM transactions WHERE merchant_note = ? AND transaction_type = 'CREDIT' AND payment_status = 'pending' AND currency = ?`,
                [merchant_note, final_currency]
            );

            if (creditRows.length > 0) {
                const totalDebtAmount = parseFloat(creditRows[0].amount);

                // Step B: Sum up all PAYMENT transactions for this note (matching the currency)
                const [paymentRows] = await db.query(
                    `SELECT SUM(amount) as total_paid FROM transactions WHERE merchant_note = ? AND transaction_type = 'PAYMENT' AND currency = ?`,
                    [merchant_note, final_currency]
                );

                const totalPaidAmount = parseFloat(paymentRows[0].total_paid) || 0;

                // Step C: If total payments cover the debt, flip the status to 'paid'
                if (totalPaidAmount >= totalDebtAmount) {
                    await db.query(
                        `UPDATE transactions SET payment_status = 'paid' WHERE merchant_note = ? AND transaction_type = 'CREDIT' AND currency = ?`,
                        [merchant_note, final_currency]
                    );
                    console.log(`🔒 DEBT SETTLED: "${merchant_note}" has paid in full (${final_currency} ${totalPaidAmount} of ${totalDebtAmount}). Status updated to 'paid'.`);
                }
            }
        }

        return res.status(201).json({ 
            message: "Transaction recorded successfully!",
            transactionId: result.insertId,
            paymentStatus: final_status,
            currency: final_currency
        });

    } catch (err) {
        console.error("❌ SQL DATABASE ERROR:", err);
        return res.status(500).json({ error: "Database failure while logging transaction." });
    }
});
// --- FETCH PENDING INVOICES FOR REMINDERS ---
app.get('/api/transactions/pending', async (req, res) => {
    // 🎯 This query looks at the original debt rows, then dynamically sums up 
    // any associated payment rows from the database using a LEFT JOIN
    const query = `
        SELECT 
            t.transaction_id, 
            t.amount, 
            COALESCE(SUM(p.amount_paid), t.amount_paid, 0) AS amount_paid,
            t.merchant_note, 
            t.due_date, 
            t.payment_status
        FROM transactions t
        LEFT JOIN transactions p ON p.merchant_note = t.merchant_note AND p.transaction_type = 'PAYMENT'
        WHERE t.payment_status = 'pending' AND t.transaction_type = 'CREDIT'
        GROUP BY t.transaction_id
        ORDER BY t.due_date ASC
    `;

    try {
        const [rows] = await db.query(query);
        return res.status(200).json(rows);
    } catch (err) {
        console.error("❌ FETCH PENDING ERROR:", err);
        return res.status(500).json({ error: "Failed to load pending invoices." });
    }
});
// 🎯 Balanced and completely closed
// ==========================================
// 🛠️ ROUTE 3: Fetch Active Debtors (Credit Ledger)
// ==========================================
app.get('/api/debtors', async (req, res) => {
    try {
        const queryText = `
            SELECT c.customer_name AS debtor, c.phone_number, t.amount AS balance_owed, t.merchant_note, t.logged_at
            FROM transactions t
            JOIN customers c ON t.customer_id = c.customer_id
            WHERE t.transaction_type = 'CREDIT'
            ORDER BY t.logged_at DESC
        `;
        // Make sure you are only passing these 4 values to match your variables:
        await db.query(queryText, [amount, customerName, transactionType, merchantNote]);
        res.status(200).json(rows);
    } catch (error) {
        console.error('Debtors fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch credit ledger' });
    }
});
const PORT = 5001;

// Add the 'async' keyword before (req, res)
app.get('/api/customers', async (req, res) => {
  try {
    // Selection modified to match your exact database column schema
    const sqlQuery = 'SELECT customer_id, customer_name, phone_number FROM customers ORDER BY customer_name ASC';
    
    const [results] = await db.query(sqlQuery);
    res.json(results); // Sends back the fields exactly as named in the DB
  } catch (error) {
    console.error('Database error fetching customers:', error);
    res.status(500).json({ error: 'Failed to retrieve customers from database.' });
  }
});

// 🎯 FORCE EXPRESS TO BIND EXPLICITLY TO THE IPv4 ADDRESS
app.listen(PORT, () => {
    console.log(`🚀 LedgerFlow Server Engine running live on http://localhost:${PORT}`);
});

// ==========================================
// 🛠️ ROUTE 4: Settle (Delete) a Transaction
// ==========================================
app.delete('/api/transactions/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Execute the SQL statement to remove the row from your ledger
        await db.query('DELETE FROM transactions WHERE transaction_id = ?', [id]);

        res.status(200).json({ message: `Transaction #${id} successfully settled.` });
    } catch (error) {
        console.error('Settlement error:', error);
        res.status(500).json({ error: 'Failed to settle transaction in database' });
    }
});


// PUT: Update the paid amount on an existing debt line
app.put("/api/transactions/paid/:id", async (req, res) => {
  const { id } = req.params;
  const { payment_amount } = req.body;

  try {
    const [rows] = await db.query("SELECT * FROM transactions WHERE transaction_id = ?", [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: `No row found for Transaction ID: ${id}` });
    }

    const totalBill = Number(rows[0].amount || 0);
    const oldPaid = Number(rows[0].amount_paid || 0);
    const incomingPayment = Number(payment_amount || 0);
    const newPaidTotal = oldPaid + incomingPayment;

    const finalStatus = newPaidTotal >= totalBill ? 'paid' : 'pending';

    // Update the database
    await db.query(
      "UPDATE transactions SET amount_paid = ?, payment_status = ? WHERE transaction_id = ?", 
      [newPaidTotal, finalStatus, id]
    );

    // 💡 DIAGNOSTIC RESPONSE: This will show us the exact math breakdown in your browser alert!
    return res.json({ 
      success: true, 
      message: `Status: ${finalStatus}. Bill: ₦${totalBill}, Prev Paid: ₦${oldPaid}, New Input: ₦${incomingPayment}, Total Paid: ₦${newPaidTotal}`
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});



async function testConnection() {
  try {
    const [rows] = await db.query('SELECT 1 + 1 AS result');
    console.log('Aiven Database Connected Successfully! Test Query Result:', rows[0].result);
  } catch (err) {
    console.error('Aiven Database Connection Failed:', err.message);
  }
}

testConnection();