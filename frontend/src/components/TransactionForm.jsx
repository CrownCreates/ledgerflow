import React, { useState, useEffect } from 'react';

export default function TransactionForm() {
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [amount, setAmount] = useState('');
    // Global Step 1: Add a dynamic currency state defaulting to NGN
    const [currency, setCurrency] = useState('NGN'); 
    const [loading, setLoading] = useState(true);
    
    console.log("!!! TransactionForm Component has mounted !!!");
    
    useEffect(() => {
        setLoading(true);
        fetch('http://localhost:5001/api/customers')
            .then((res) => {
                if (!res.ok) throw new Error('Network response failed');
                return res.json();
            })
            .then((data) => {
                console.log("--- FRONTEND RECEIVED DATA ---", data); 
                setCustomers(data);
                setLoading(false);
            })
            .catch((err) => {
                console.error("Frontend Fetch Error:", err);
                setLoading(false);
            });
    }, []);

    // Handle form submission
    const handleSubmit = (e) => {
        e.preventDefault();
        
        // Global Step 2: Package the currency field into your data payload
        const transactionData = {
            customer_id: selectedCustomer,
            amount: parseFloat(amount),
            currency: currency, // Explicitly sending "NGN", "USD", etc.
            date: new Date().toISOString()
        };

        console.log("Submitting global transaction data:", transactionData);
        // Your database POST fetch request goes here next
    };

    return (
        <div className="container mt-5" style={{ maxWidth: '500px' }}>
            <div className="card shadow-sm p-4">
                <h3 className="card-title mb-4 text-center">Log New Transaction</h3>

                <form onSubmit={handleSubmit}>
                    {/* Customer Dropdown Selection */}
                    <div className="mb-3">
                        <label htmlFor="customerSelect" className="form-label font-weight-bold">
                            Select Customer
                        </label>
                        {loading ? (
                            <p className="text-muted small">Loading customers from database...</p>
                        ) : (
                            <select
                                id="customerSelect"
                                className="form-select form-control"
                                value={selectedCustomer}
                                onChange={(e) => setSelectedCustomer(e.target.value)}
                                required
                            >
                                <option value="">-- Choose a Customer --</option>
                                {customers.map((customer) => (
                                    <option key={customer.customer_id} value={customer.customer_id}>
                                        {customer.customer_name} {customer.phone_number ? `(${customer.phone_number})` : ''}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Global Step 3: Add the Currency Selector Input */}
                    <div className="mb-3">
                        <label htmlFor="currencySelect" className="form-label font-weight-bold">
                            Settlement Currency
                        </label>
                        <select
                            id="currencySelect"
                            className="form-select form-control"
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

                    {/* Amount Input (Dynamic Label updates based on choice) */}
                    <div className="mb-4">
                        <label htmlFor="amountInput" className="form-label font-weight-bold">
                            Amount ({currency})
                        </label>
                        <input
                            type="number"
                            id="amountInput"
                            className="form-control"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                        />
                    </div>

                    {/* Submit Button */}
                    <button type="submit" className="btn btn-primary w-100 py-2">
                        Record Transaction
                    </button>
                </form>
            </div>
        </div>
    );
}