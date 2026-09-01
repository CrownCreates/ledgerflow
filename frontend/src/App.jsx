import React, { useState, useEffect } from 'react';
import axios from 'axios'; // 1. Import Axios to handle our API calls
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Login from './components/Login'; // Vite automatically resolves .jsx extensions!
import TransactionForm from './components/TransactionForm';
import TransactionList from './components/TransactionList';
export default
  function App() {
  // 2. Initialize transactions as an empty array (it will fill up instantly from the database)

  const [transactions, setTransactions] = useState([]);
  const [amount, setAmount] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customers, setCustomers] = useState([]);
  const [merchantNote, setMerchantNote] = useState('');
  const [transactionType, setTransactionType] = useState('CASH');
  const [pendingInvoices, setPendingInvoices] = useState([]); // 👈 Now initialized first!
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [merchant, setMerchant] = useState(null);
  const [dueDate, setDueDate] = useState('');
  const [validationError, setValidationError] = useState('');
  const [currency, setCurrency] = useState('NGN');
  // Add these at the top level of your App component (with your other states)
  const [viewCurrency, setViewCurrency] = useState('NGN'); // Controls what the entire dashboard calculates in

  const EXCHANGE_RATES = {
    NGN: 1,
    USD: 1385, // $1 = ₦1,385 (Dynamically scales everything up or down)
    CAD: 979,
    GBP: 1849,
    EUR: 1579,
    KES: 10.7,
    GHS: 120,
  };

  // 2. THE MATH GOES SECOND (Right after all states are ready)
  const totalPendingAmount = pendingInvoices.reduce((sum, invoice) => {
    const amountNum = parseFloat(invoice.amount) || 0;
    const paidNum = parseFloat(invoice.amount_paid) || 0; // 🎯 Parse the paid amount

    const remainingDebt = amountNum - paidNum; // 🎯 Calculate the net remaining balance
    return sum + remainingDebt;
  }, 0);
  const totalCustomersCount = customers ? customers.length : 0;



  const fetchPendingInvoices = async () => {
    try {
      // 🎯 Adding ?t= prevents the browser or network from caching old results
      const response = await axios.get(`http://localhost:5001/api/transactions/pending?t=${Date.now()}`);
      setPendingInvoices(response.data);
    } catch (error) {
      console.error("Error fetching pending invoices:", error);
    }
  };
  useEffect(() => {
    if (merchant) {
      fetchPendingInvoices();
      fetchCustomers();
    }
  }, [merchant]); // 👈 Added merchant dependency so it loads when the user logs in

  const fetchCustomers = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/customers');
      setCustomers(response.data);
    } catch (error) {
      console.error("Error fetching customers for dashboard:", error);
    }
  };


  const fetchLiveTransactions = async () => {
    // 1. 🎯 Safety check: If no merchant is logged in yet, don't query the backend
    if (!merchant || !(merchant.merchant_id || merchant.id)) {
      setTransactions([]);
      return;
    }

    const currentId = merchant.merchant_id || merchant.id;

    const totalPendingAmount = pendingInvoices.reduce((sum, invoice) => {
      const amountNum = parseFloat(invoice.amount) || 0;
      return sum + amountNum;
    }, 0);

    const totalCustomersCount = customers ? customers.length : 0;

    // 🕵️‍♂️ Temporary console logs to check our work
    console.log("--- DASHBOARD METRICS TEST ---");
    console.log("Calculated Pending Amount:", totalPendingAmount);
    console.log("Total Customers Count:", totalCustomersCount);



    try {
      setLoading(true);

      // 2. 🎯 FIXED: Attached the merchant_id query string to the backend request
      const response = await axios.get(`http://localhost:5001/api/transactions?merchant_id=${currentId}`);
      console.log("👉 RAW BACKEND DATA TYPE:", typeof response.data, "DATA:", response.data);

      // 3. Keep it safe: Ensure response data is an array before setting state
      setTransactions(Array.isArray(response.data) ? response.data : []);
      window.refreshDashboardData = fetchLiveTransactions;
      setLoading(false);
    } catch (error) {
      console.error("Could not fetch data stream from backend engine:", error);
      setTransactions([]); // 🎯 CRITICAL FALLBACK: Keeps state as an array so .filter() never crashes your graph!
      setLoading(false);
    }

  };

  const handleMarkAsPaid = async (transactionId) => {
    // 1. Prompt the clerk for the partial/full payment amount
    const amountInput = prompt("Enter the payment amount received (₦):");
    if (!amountInput) return; // Stop if they hit cancel

    const paymentAmount = Number(amountInput);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      alert("Please enter a valid number greater than zero.");
      return;
    }

    try {
      // 2. Fire the network request using your exact original URL base
      const response = await axios.put(`http://localhost:5001/api/transactions/paid/${transactionId}`, {
        payment_amount: paymentAmount
      });

      alert(response.data.message);

      // 3. Force state refreshers to wait until database finishes processing
      if (typeof fetchLiveTransactions === 'function') {
        await fetchLiveTransactions();
      }
      if (typeof fetchPendingInvoices === 'function') {
        await fetchPendingInvoices();
      }

      // 2. ⚡ LIVE UPDATE THE STATE ARRAY
      if (typeof setTransactions === 'function') {
        setTransactions((prevTransactions) =>
          prevTransactions.map((transaction) => {
            if (transaction.transaction_id === transactionId || transaction.id === transactionId) {
              const currentPaid = Number(transaction.amount_paid || 0);
              const totalAmount = Number(transaction.amount || 0);
              const updatedPaid = currentPaid + paymentAmount;

              // Update the values inside the card dynamically
              return {
                ...transaction,
                amount_paid: updatedPaid,
                // Only marks 'paid' if they've fully cleared the total bill
                payment_status: updatedPaid >= totalAmount ? 'paid' : 'pending'
              };
            }
            return transaction; // Leave other lines completely alone
          })
        );
      }


    } catch (error) {
      console.error("Error updating ledger status:", error);
      const serverError = error.response?.data?.error || "Failed to save payment changes.";
      alert(serverError);
    }
  };

  useEffect(() => {
    if (merchant) {
      fetchLiveTransactions();
    }
  }, [merchant]);

  // 3. REAL-TIME LEDGER CALCULATIONS (Bulletproof Array Verification)
// 🌍 Helper to convert transaction amount to the target viewing currency
const getAmountInViewCurrency = (tx) => {
  const originalAmount = parseFloat(tx.amount || 0);
  const txCurrency = tx.currency || 'NGN';

  // Step A: Convert to Naira (Base Currency)
  const rateToNaira = EXCHANGE_RATES[txCurrency] || 1;
  const amountInNaira = originalAmount * rateToNaira;

  // Step B: Convert from Naira to selected View Currency
  const rateFromNaira = EXCHANGE_RATES[viewCurrency] || 1;
  return amountInNaira / rateFromNaira;
};

// 💰 Dynamic math formulas that actually use the converter helper!
const totalCash = Array.isArray(transactions)
  ? transactions
      .filter(tx => tx && (tx.transaction_type === 'CASH' || tx.transaction_type === 'PAYMENT'))
      .reduce((sum, tx) => sum + getAmountInViewCurrency(tx), 0) // 👈 Changed here
  : 0;

const totalCredit = Array.isArray(transactions)
  ? transactions
      .filter(tx => tx && tx.transaction_type === 'CREDIT')
      .reduce((sum, tx) => sum + getAmountInViewCurrency(tx), 0) // 👈 Changed here
  : 0;
  // 4. ACTION HANDLERS
  const handleLogTransaction = (e) => {
    e.preventDefault();
    if (!amount) return;

    const newLog = {
      // Keep the state properties matching what your live MySQL backend expects
      merchant_note: customerName.trim() || "Quick Walk-in", // This fixes the blank name/note problem!
      amount: parseFloat(amount),
      transaction_type: transactionType,
      merchant_id: merchant?.id || merchant?.merchant_id
    };

    setTransactions([newLog, ...transactions]);
    setAmount('');
    setCustomerName('');
    setTransactionType('CASH');
  };

  const handleLogout = () => {
    setMerchant(null);          // Wipes the current logged-in business account
    setTransactions([]);        // Clears out the transaction history cache
    localStorage.removeItem('token'); // Clears out auth tokens if you are using them
  };

  const handleSaveTransaction = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    const parsedAmount = parseFloat(amount);

    if (!customerName || !customerName.trim()) {
      alert("⚠️ Please enter or select a customer name.");
      return;
    }

    if (transactionType === 'CREDIT' && !dueDate) {
      alert("⚠️ Please select a Payment Due Date for this credit transaction!");
      return;
    }

    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    if (parsedAmount > 99999999.99) {
      alert("Amount exceeds maximum allowed limit.");
      return;
    }

    // 🧠 OVERPAYMENT PREVENTION SECURITY GUARD (Now matches currency)
    if (transactionType !== 'CREDIT') {
      const existingDebtRecord = pendingInvoices.find(
        (inv) =>
          inv.merchant_note &&
          inv.merchant_note.trim().toLowerCase() === customerName.trim().toLowerCase() &&
          (inv.currency || 'NGN') === currency // Only matches open debt in the same currency
      );

      if (existingDebtRecord) {
        const totalDebt = parseFloat(existingDebtRecord.amount) || 0;
        const totalPaidSoFar = parseFloat(existingDebtRecord.amount_paid) || 0;
        const remainingOwed = totalDebt - totalPaidSoFar;

        if (parsedAmount > remainingOwed) {
          // Dynamic formatting based on the selected currency
          const formattedOwed = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(remainingOwed);
          const formattedPayment = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(parsedAmount);

          alert(`⚠️ Overpayment Alert! ${customerName.trim()} only owes ${formattedOwed}. You cannot record a payment of ${formattedPayment}.`);
          return;
        }
      }
    }

    if (isSaving) return;
    setIsSaving(true);

    try {
      const currentMerchantId = merchant?.merchant_id || merchant?.id || 3;

      const payload = {
        amount: parsedAmount,
        currency: currency, // 🌍 Added selected currency to the database payload
        transaction_type: transactionType === 'CASH' ? 'CASH' : 'CREDIT',
        merchant_note: customerName.trim() || "Quick Walk-in",
        merchant_id: currentMerchantId,
        due_date: transactionType === 'CREDIT' ? dueDate : null
      };

      await axios.post('http://localhost:5001/api/transactions', payload);

      // Re-fetch the fresh database list
      const res = await axios.get(`http://localhost:5001/api/transactions?merchant_id=${currentMerchantId}`);
      const freshTransactions = Array.isArray(res.data) ? res.data : [];

      // 1️⃣ Sync Top Table instantly using the fresh database list
      setTransactions(freshTransactions);

      // 2️⃣ Sync Bottom Table (Debtors) instantly from the exact same source array
      if (typeof setDebtorTransactions === 'function') {
        const activeDebtors = freshTransactions.filter(tx => {
          const bal = Number(tx.amount || 0) - Number(tx.amount_paid || 0);
          return tx.transaction_type === 'CREDIT' || bal > 0;
        });
        setDebtorTransactions(activeDebtors);
      }

      // Clear the inputs
      setAmount('');
      setCustomerName('');

      if (typeof fetchPendingInvoices === 'function') {
        fetchPendingInvoices();
      }
    } catch (error) {
      console.error('Error saving new record:', error);
      alert('Failed to save transaction. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  // 4. Send the correct payload to your backend POST route

  // 🎯 Place the lock set out here so it survives component re-renders
  let activePaymentRequests = new Set();

  const handleClearDebt = async (tx) => {
    const id = tx.transaction_id || tx.id;

    if (activePaymentRequests.has(id)) return;
    activePaymentRequests.add(id);

    // 1. Calculate what they owe right now
    const currentAmount = parseFloat(tx.amount || 0);
    const currentPaid = parseFloat(tx.amount_paid || tx.paid || 0);
    const missingBalance = currentAmount - currentPaid;

    // 💡 Note: If you are using a prompt or input field for the 40k, 
    // replace 'missingBalance' below with your custom input variable!
    const paymentAmountToSend = missingBalance;

    try {
      const response = await axios.put(`http://localhost:5001/api/transactions/paid/${id}`, {
        payment_amount: paymentAmountToSend
      });

      const currentMerchantId = merchant?.merchant_id || merchant?.id;

      // 2. Fetch updated Historical Ledger transactions
      const resLedger = await axios.get(`http://localhost:5001/api/transactions?merchant_id=${currentMerchantId}`);
      setTransactions(Array.isArray(resLedger.data) ? resLedger.data : []);

      // 3. 🎯 SMART UI UPDATE: Only remove them if they paid everything!
      setPendingInvoices((prevList) => {
        const updatedPaidTotal = currentPaid + paymentAmountToSend;

        if (updatedPaidTotal >= currentAmount) {
          // Fully paid! Slice them out of the pending view
          return prevList.filter(item => item.transaction_id !== id && item.id !== id);
        } else {
          // Partially paid! Update their numbers in place so they don't disappear
          return prevList.map(item => {
            if (item.transaction_id === id || item.id === id) {
              return {
                ...item,
                amount_paid: updatedPaidTotal,
                // If your layout displays remaining balance under 'amount', update it here:
                amount: currentAmount - paymentAmountToSend
              };
            }
            return item;
          });
        }
      });

    } catch (error) {
      console.error('Error updating transaction payment status:', error);
    } finally {
      activePaymentRequests.delete(id);
    }
  };
  // 🎯 Grouping database records by date for your Recharts component
  const chartData = transactions.reduce((acc, tx) => {
    // Extract a clean date string (YYYY-MM-DD) from the timestamp
    const dateStr = tx.logged_at ? new Date(tx.logged_at).toLocaleDateString() : 'Unknown';

    // Find if we already started a data point for this date
    let existingDate = acc.find(item => item.date === dateStr);

    if (!existingDate) {
      existingDate = { date: dateStr, Income: 0, Expenses: 0 };
      acc.push(existingDate);
    }

    // Convert amount to a real number safely
    const amt = parseFloat(tx.amount) || 0;

    // 🎯 MATCH YOUR UPDATED DB VALUES EXACTLY!
    if (tx.transaction_type === 'CASH') {         // 🌟 Changed from 'income'
      existingDate.Income += amt;
    } else if (tx.transaction_type === 'CREDIT') { // 🌟 Changed from 'expense'
      existingDate.Expenses += amt;
    }

    return acc;
  }, []).reverse();// Reverse so older dates are on the left and newer dates are on the right
  if (!merchant) {
    return <Login onLoginSuccess={(loggedInMerchant) => setMerchant(loggedInMerchant)} />;
  }
  const handleSendReminder = (invoice) => {
    const message = `Hello, this is a friendly reminder...`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  // 🔍 Filtered lists based on the customer's name
  const filteredTransactions = transactions.filter(tx =>
    // Check merchant_note instead of customer_name
    tx.merchant_note && tx.merchant_note.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDebtors = pendingInvoices.filter(invoice => {
    return invoice.merchant_note?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="container-fluid py-4 bg-light min-vh-100" style={{ maxWidth: '480px' }}>

      {/* 📊 REFINED CUSTOM COLOR METRICS CARDS */}
      <div className="row g-3 mb-4">

        {/* Card 1: Pending Receivables (Custom Sunflower Yellow with Subtle Border) */}
        <div className="col-12">
          {/* New inline background-color and a subtle border */}
          <div className="card text-white border-0 shadow-sm" style={{
            borderRadius: '12px',
            backgroundColor: '#f1c40f', // CUSTOM SUNFLOWER YELLOW
            border: '1px solid #d4ac0d'   // Slightly darker border
          }}>
            <div className="card-body p-3">
              <span className="text-uppercase small fw-bold opacity-75">Pending Receivables</span>
              <h3 className="mb-0 fw-bold mt-1">
                ₦{totalPendingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h3>
            </div>
          </div>
        </div>

        {/* Card 2: Total Active Customers (Custom Deep Navy with Subtle Border) */}
        <div className="col-6">
          {/* New inline background-color and a subtle border */}
          <div className="card text-white border-0 shadow-sm" style={{
            borderRadius: '12px',
            backgroundColor: '#1a5276', // CUSTOM DEEP NAVY BLUE
            border: '1px solid #154360'   // Slightly darker border
          }}>
            <div className="card-body p-3">
              <span className="text-uppercase small fw-bold opacity-75">Customers</span>
              <h4 className="mb-0 fw-bold mt-1">{totalCustomersCount}</h4>
            </div>
          </div>
        </div>

        {/* Card 3: Live Invoices Count (Custom Forest Green with Subtle Border) */}
        <div className="col-6">
          {/* New inline background-color and a subtle border */}
          <div className="card text-white border-0 shadow-sm" style={{
            borderRadius: '12px',
            backgroundColor: '#145a32', // CUSTOM FOREST GREEN
            border: '1px solid #114b29'   // Slightly darker border
          }}>
            <div className="card-body p-3">
              <span className="text-uppercase small fw-bold opacity-75">Invoices</span>
              <h4 className="mb-0 fw-bold mt-1">{pendingInvoices.length}</h4>
            </div>
          </div>
        </div>

      </div>

      {/* BRANDING HEADER */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="fw-bold m-0 text-dark">Ledger<span className="text-primary">Flow</span></h4>
          <small className="text-muted tracking-wide fw-semibold" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>OFFLINE RETAIL OS</small>
        </div>
        <span className="badge bg-success-subtle text-success px-3 py-2 rounded-pill fw-bold border border-success-subtle">
          ● Local Engine Live
        </span>
      </div>

      {/* Main Card Container with explicitly controlled spacing */}
      <div className="card border-0 shadow-sm rounded-4 p-4 mb-4">
        <h5 className="fw-bold text-dark mb-4">Financial Cash Flow</h5>

        {/* 🎯 THE HEIGHT FIX: Set a solid, safe height on the outer wrapper div */}
        <div style={{ width: '100%', height: '320px', marginBottom: '20px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />

              <XAxis dataKey="date" stroke="#6c757d" fontSize={11} tickLine={false} />

              {/* 🎯 THE Y-AXIS FIX: Completely standard, non-inverted axis layout */}
              <YAxis
                stroke="#6c757d"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `₦${value.toLocaleString()}`}
              />

              <Tooltip
                cursor={{ fill: '#f8f9fa' }}
                formatter={(value) => [`₦${value.toLocaleString()}`, '']}
              />
              <Bar name="Income" dataKey="Income" fill="#198754" radius={[4, 4, 0, 0]} maxBarSize={50} />
              <Bar name="Expenses" dataKey="Expenses" fill="#dc3545" radius={[4, 4, 0, 0]} maxBarSize={50} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 🎯 THE OVERLAP FIX: Keep your summary cards completely OUTSIDE and BELOW the chart card div */}
      <div className="row g-3 mb-4">
        <div className="col-6">
          {/* Your Total Cash In Card Code */}
        </div>
        <div className="col-6">
          {/* Your Total Credit Out Card Code */}
        </div>
      </div>
      {/* GLOBAL VIEW CURRENCY TOGGLE */}
      <div className="d-flex align-items-center justify-content-between mb-3 px-1">
        <span className="fw-bold text-muted small text-uppercase" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
          Dashboard View Currency
        </span>
        <select
          className="form-select form-select-sm w-auto fw-bold text-primary border-2"
          value={viewCurrency}
          onChange={(e) => setViewCurrency(e.target.value)}
        >
          <option value="NGN">NGN (₦)</option>
          <option value="USD">USD ($)</option>
          <option value="CAD">CAD ($)</option>
          <option value="GBP">GBP (£)</option>
          <option value="EUR">EUR (€)</option>
          <option value="KES">KES (KSh)</option>
          <option value="GHS">GHS (₵)</option>
        </select>
      </div>

      {/* REAL-TIME KIOSK INSIGHTS */}
      {(() => {
        const currencySymbols = {
          NGN: '₦',
          USD: '$',
          CAD: '$',
          GBP: '£',
          EUR: '€',
          KES: 'KSh',
          GHS: '₵'
        };
        const viewSymbol = currencySymbols[viewCurrency] || '₦';

        return (
          <div className="row g-2 mb-4">
            <div className="col-6">
              <div className="card border-0 shadow-sm rounded-4 p-3 bg-white border-start border-4 border-success">
                <small className="text-muted fw-bold text-uppercase" style={{ fontSize: '10px' }}>Total Cash In</small>
                <h4 className="fw-extrabold text-success m-0 mt-1">
                  {viewSymbol}{totalCash.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </h4>
              </div>
            </div>
            <div className="col-6">
              <div className="card border-0 shadow-sm rounded-4 p-3 bg-white border-start border-4 border-danger">
                <small className="text-muted fw-bold text-uppercase" style={{ fontSize: '10px' }}>Total Credit Out</small>
                <h4 className="fw-extrabold text-danger m-0 mt-1">
                  {viewSymbol}{totalCredit.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </h4>
              </div>
            </div>
          </div>
        );
      })()}

      {/* INSTANT DATA CAPTURE FORM */}
      {/* INSTANT DATA CAPTURE FORM */}
      <div className="card border-0 shadow-sm rounded-4 p-4 mb-4">
        <h6 className="fw-bold text-muted uppercase small mb-3 text-uppercase" style={{ fontSize: '12px' }}>Instant Data Capture</h6>
        <form onSubmit={(e) => { e.preventDefault(); handleSaveTransaction(); }}>

          {/* GLOBAL REQUIREMENT: Currency Selector Dropdown */}
          <div className="mb-3">
            <label className="form-label small text-muted fw-bold">SETTLEMENT CURRENCY</label>
            <select
              className="form-select"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              required
            >
              <option value="NGN">NGN (₦) - Nigerian Naira</option>
              <option value="USD">USD ($) - US Dollar</option>
              <option value="CAD">CAD ($) - Canadian Dollar</option>
              <option value="GBP">GBP (£) - British Pound</option>
              <option value="EUR">EUR (€) - Euro</option>
              <option value="KES">KES (KSh) - Kenyan Shilling</option>
              <option value="GHS">GHS (₵) - Ghanaian Cedi</option>
            </select>
          </div>

          <div className="mb-3">
            {/* The label dynamically updates its text based on the state variable */}
            <label className="form-label small text-muted fw-bold">TRANSACTION AMOUNT ({currency})</label>
            <input
              type="number"
              className="form-control form-control-lg fw-bold text-primary fs-3 border-2"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="mb-3">
            <label className="form-label font-weight-bold">Transaction Type</label>
            <select
              className="form-select"
              value={transactionType}
              onChange={(e) => {
                setTransactionType(e.target.value);
                if (e.target.value !== 'CREDIT') setDueDate('');
              }}
            >
              <option value="CASH">Instant Cash Sale</option>
              <option value="CREDIT">Invoice / Credit (Pay Later)</option>
            </select>
          </div>

          {transactionType === 'CREDIT' && (
            <div className="mb-3">
              <label className="form-label font-weight-bold text-danger">Payment Due Date</label>
              <input
                type="date"
                className="form-control"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>
          )}

          <div className="mb-3">
            <label className="form-label small text-muted fw-bold">MERCHANT NOTE / CUSTOMER</label>
            <input
              type="text"
              className="form-control mb-3"
              placeholder="Enter Customer Name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>

          {/* DUAL ACTION CAPTURE BUTTONS */}
          <div className="row g-2 mb-3">
            {/* CASH SALE BUTTON */}
            <div className="col-6">
              <button
                type="button"
                onClick={() => setTransactionType('CASH')}
                className={`btn btn-lg w-100 py-2 py-md-3 rounded-3 fw-bold shadow-sm text-nowrap d-flex align-items-center justify-content-center gap-1 ${transactionType === 'CASH'
                  ? 'btn-success text-white'
                  : 'btn-outline-secondary bg-white text-dark'
                  }`}
              >
                💵 Cash Sale
              </button>
            </div>

            {/* BOOK DEBT BUTTON */}
            <div className="col-6">
              <button
                type="button"
                onClick={() => setTransactionType('CREDIT')}
                className={`btn btn-lg w-100 py-2 py-md-3 rounded-3 fw-bold shadow-sm text-nowrap d-flex align-items-center justify-content-center gap-1 ${transactionType === 'CREDIT'
                  ? 'btn-danger text-white'
                  : 'btn-outline-secondary bg-white text-dark'
                  }`}
              >
                📝 Book Debt
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-dark btn-lg w-100 py-3 rounded-3 fw-bold shadow-sm">
            Commit Entry
          </button>
        </form>
      </div>
      <div className="card border-0 shadow-sm rounded-4 p-4 mt-4">
        <h6 className="fw-bold text-danger small mb-3 text-uppercase" style={{ fontSize: '12px', letterSpacing: '1px' }}>
          ⚠️ Pending Debts & Reminders
        </h6>

        {pendingInvoices.length === 0 ? (
          <p className="text-muted small my-2">No pending invoices found. Excellent job keeping balances cleared!</p>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr className="text-muted small" style={{ fontSize: '11px' }}>
                  <th>CUSTOMER / NOTE</th>
                  <th>AMOUNT</th>
                  <th>PAID</th>
                  <th>DUE DATE</th>
                  <th>Status</th>
                  <th className="text-end">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {pendingInvoices.length === 0 ? (
                  /* 📁 THIS SHOWS IF THE MERCHANT HAS ZERO PENDING INVOICES */
                  <tr>
                    <td colSpan="5" className="text-center py-5 bg-white" style={{ borderRadius: '12px' }}>
                      <div className="text-muted mb-2" style={{ fontSize: '28px' }}>📁</div>
                      <h6 className="fw-bold text-dark mb-1">No pending debts yet</h6>
                      <p className="small text-muted mb-0">When you record a credit transaction, it will appear here.</p>
                    </td>
                  </tr>
                ) : (
                  /* 🟢 THIS SHOWS THE ACTUAL INVOICES IF THEY EXIST */
                  filteredDebtors.map((invoice) => (
                    <tr key={invoice.transaction_id}>
                      <td>
                        <span className="fw-semibold text-dark d-block">{invoice.merchant_note || "Unnamed Debt"}</span>
                      </td>
                      <td>
                        <span className="fw-bold text-primary">₦{parseFloat((invoice.amount || 0) - (invoice.amount_paid || 0)).toLocaleString()}</span>
                      </td>
                      <td>
                        <span className="fw-bold text-success">
                          ₦{parseFloat(invoice.amount_paid || 0).toLocaleString()}
                        </span>
                      </td>

                      <td>
                        <span className="badge bg-light text-danger border border-danger-subtle fw-medium py-1.5 px-2">
                          {new Date(invoice.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                      </td>
                      <td>
                        <span className={`badge fw-medium py-1.5 px-2 ${invoice.status === 'Paid' ? 'bg-success text-white' : 'bg-warning text-dark'}`} style={{ borderRadius: '6px' }}>
                          {invoice.status || "Pending"}
                        </span>
                      </td>
                      <td className="text-end">
                        <div className="d-flex gap-1 justify-content-end align-items-center">
                          {/* 💬 Send Reminder Button (Compact & Single Line) */}
                          <button
                            className="btn btn-outline-success btn-sm fw-medium px-2 py-1 text-nowrap"
                            style={{ borderRadius: '6px', fontSize: '11px' }}
                            onClick={() => handleSendReminder(invoice)}
                          >
                            Reminder 💬
                          </button>
                          {/* Mark as Paid Button */}
                          <button
                            className="btn btn-sm btn-success px-2 py-1 fw-medium border-0 text-nowrap"
                            style={{
                              borderRadius: '6px',
                              fontSize: '11px',
                              backgroundColor: '#145a32'
                            }}
                            onClick={() => handleMarkAsPaid(invoice.transaction_id)}
                          >
                            Paid ✓
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 mb-4">
        <TransactionList
          merchantId={merchant?.merchant_id || merchant?.id || 3}
          transactionsData={transactions} // 👈 This connects the Top Table data to the Bottom Table
        />
      </div>

      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="fw-bold text-dark m-0">{merchant?.business_name || "Dashboard"}</h2>
        <button onClick={handleLogout} className="btn btn-outline-danger btn-sm px-3 rounded-pill fw-bold">
          Logout
        </button>
      </div>

      {/* THE STAGING PIPELINE VIEW */}
      <div className="card border-0 shadow-sm rounded-4 p-4">
        <h6 className="fw-bold text-muted text-uppercase small mb-3" style={{ fontSize: '12px' }}>Staging Pipeline (Unsynced)</h6>
        <div className="vstack gap-3">

          {pendingInvoices.map((tx, index) => {
            // Safe normalization of transaction types to lowercase for matching
            const currentType = (tx.transaction_type || tx.type || "").toLowerCase();

            // 💡 Smart check: If type says credit, OR if status says pending, OR if there's an unpaid balance, treat it as a debt!
            const isDebt =
              (tx.transaction_type || tx.type || "").toLowerCase() === 'credit' ||
              (tx.payment_status || "").toLowerCase() === 'pending' ||
              (parseFloat(tx.amount || 0) > parseFloat(tx.amount_paid || 0));

            return (
              <div key={`${tx.transaction_id || 'tx'}-${index}`} className="p-3 rounded-3 bg-white border-start border-4 border-dark shadow-sm mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div>
                    {/* Merchant Note Description */}
                    <p className="m-0 fw-bold text-dark">{tx.merchant_note || "Untitled Transaction"}</p>

                    {/* 👤 Dynamic label based on whether money is owed */}
                    <p className="m-0 text-muted small fw-medium">
                      👤 {tx.customer_name || (isDebt ? 'Debtor Account' : 'Direct Transaction')} {tx.customer_phone ? `(${tx.customer_phone})` : ''}
                    </p>

                    <small className="text-muted d-block mt-1">
                      {tx.logged_at ? (
                        new Date(tx.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      ) : (
                        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      )}
                    </small>
                  </div>

                  <div className="text-end">
                    {/* 💰 Color changes dynamically based on debt status */}
                    <p className={`m-0 fw-bold fs-5 ${isDebt ? 'text-danger' : 'text-success'}`}>
                      {isDebt ? '-' : '+'}₦{parseFloat(tx.amount || 0).toLocaleString()}
                    </p>
                    <span className={`badge rounded-pill px-2 py-1 small fw-bold ${isDebt ? 'bg-danger-subtle text-danger' : 'bg-success-subtle text-success'}`}>
                      {isDebt ? 'CREDIT' : (currentType ? currentType.toUpperCase() : 'CASH SALE')}
                    </span>
                  </div>
                </div>

                {/* 🤖 Bulletproof AI Risk Rating Display (Fires if tx.ai_risk exists and it is verified as debt) */}
                {tx.ai_risk && (
                  <div className="bg-light p-2 rounded-2 my-2 d-flex justify-content-between align-items-center" style={{ fontSize: '13px' }}>
                    <span className="text-secondary fw-semibold">🤖 AI Risk Rating:</span>
                    <span className={`badge bg-${tx.ai_risk.color || 'warning'} text-white fw-bold px-2 py-1`}>
                      {tx.ai_risk.status || 'Reviewing'} ({tx.ai_risk.score || 0}%)
                    </span>
                  </div>
                )}

                {/* ACTION LAYER */}
                <div className="d-flex justify-content-end border-top pt-2 mt-2">
                  <button
                    onClick={() => handleClearDebt(tx)} // <-- Just pass "tx" right here!
                    className="btn btn-sm btn-light text-muted fw-bold py-1 px-3 rounded-2"
                    style={{ fontSize: '12px' }}
                  >
                    {isDebt || currentType === 'expense' ? '✅ Mark as Paid' : '🗑️ Remove Entry'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* 📜 HISTORICAL LEDGER (PREVIOUS TRANSACTIONS) */}
      <div className="card border-0 shadow-sm rounded-4 p-4 mt-4">
        <h6 className="fw-bold text-muted text-uppercase small mb-3" style={{ fontSize: '12px', letterSpacing: '0.5px' }}>
          Historical Ledger (Synced Transactions)
        </h6>

        <div className="vstack gap-3">
          {/* 💡 Loop through your main transactions history array */}
          {transactions && transactions.length > 0 ? (
            transactions.map((tx, index) => {
              console.log("WHAT FRONTEND SEES FOR THIS CARD:", tx);

              // 1️⃣ ALWAYS DEFINE TXTYPE FIRST!
              const txType = (tx.transaction_type || tx.type || "").toLowerCase();

              // 2️⃣ NOW IT IS SAFE TO USE IT HERE
              const isDebt =
                txType === 'credit' ||
                (tx.payment_status || "").toLowerCase() === 'pending' ||
                (parseFloat(tx.amount || 0) > parseFloat(tx.amount_paid || 0));
              console.log(`Card #${index} | isDebt: ${isDebt} | AI Data:`, tx.ai_risk || tx.ai_analysis || tx.risk_score || "NOT FOUND");
              return (
                <div key={`hist-${tx.transaction_id || index}`} className="p-3 rounded-3 bg-light border-start border-4 border-secondary mb-2">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <p className="m-0 fw-bold text-dark">{tx.merchant_note || "Past Transaction"}</p>
                      <p className="m-0 text-muted small">
                        {tx.customer_name ? `👤 ${tx.customer_name}` : '👤 Direct Transaction'}
                      </p>
                      <small className="text-muted dynamic-date" style={{ fontSize: '11px' }}>
                        {tx.logged_at ? new Date(tx.logged_at).toLocaleDateString() : 'Archived'}
                      </small>
                    </div>

                    <div className="text-end">
                      {(() => {
                        // 1. Map the codes directly to the symbols you want to display
                        const currencySymbols = {
                          NGN: '₦',
                          USD: '$',
                          CAD: '$',
                          GBP: '£',
                          EUR: '€',
                          KES: 'KSh',
                          GHS: '₵'
                        };
                        // 2. Determine which symbol to use (falls back to ₦ if currency is undefined or missing)
                        const symbol = currencySymbols[tx.currency] || '₦';

                        return (
                          <p className={`m-0 fw-bold ${txType === 'credit' ? 'text-danger' : 'text-success'}`}>
                            {txType === 'credit' ? '-' : '+'}
                            {symbol}
                            {parseFloat(tx.amount || 0).toLocaleString(undefined, {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 2
                            })}
                          </p>
                        );
                      })()}
                      <span className="badge bg-secondary-subtle text-secondary rounded-pill px-2 py-1 small fw-bold text-uppercase">
                        {txType || 'Settled'}
                      </span>
                    </div>
                  </div>
                  {txType === 'credit' && tx.ai_risk && (
                    <div className={`mt-2 p-2 rounded-2 border small bg-${tx.ai_risk.color || 'secondary'}-subtle text-${tx.ai_risk.color || 'dark'}`}>
                      <div className="d-flex justify-content-between align-items-center">
                        <span><strong>🤖 AI Risk:</strong> {tx.ai_risk.status || 'Assessing'}</span>
                        <span className="fw-bold">{tx.ai_risk.score || 0}%</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-4 text-muted small">
              <p className="m-0">No past synchronized transactions found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}