import React, { useState, useEffect } from 'react';

export default function TransactionList({ merchantId, transactionsData }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

 useEffect(() => {
    if (transactionsData) {
      setTransactions(transactionsData);
      setLoading(false);
    }
  }, [transactionsData]);

  if (loading) return <div style={{ color: '#666', fontSize: '12px', padding: '10px' }}>Loading stream...</div>;
  if (error) return <div style={{ color: '#ef4444', fontSize: '12px', padding: '10px' }}>{error}</div>;

  // 💡 FILTER FRONTEND: Only show clients who still owe money
  const debtorTransactions = transactions.filter((tx) => {
    const total = Number(tx.amount || 0);
    const paid = Number(tx.amount_paid || 0);
    const balance = total - paid;
    
    // Keep them on the list if they still owe money and aren't marked 'paid'
    return balance > 0 && tx.payment_status !== 'paid';
  });

  if (debtorTransactions.length === 0) {
    return <div style={{ color: '#666', fontSize: '12px', padding: '10px' }}>No active debtors found.</div>;
  }

  return (
    <div style={{ width: '100%', backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', fontFamily: 'sans-serif', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)' }}>
      {/* Crisp Light Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: '11px', fontWeight: '600', letterSpacing: '0.05em', color: '#6b7280', textTransform: 'uppercase' }}>
        <div style={{ width: '35%', textAlign: 'left' }}>Client Info</div>
        <div style={{ width: '20%', textAlign: 'right' }}>Total</div>
        <div style={{ width: '20%', textAlign: 'right' }}>Paid</div>
        <div style={{ width: '25%', textAlign: 'right' }}>Status</div>
      </div>

      {/* Rows Container (Mapping only debtors) */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {debtorTransactions.map((tx) => (
          <TransactionRow key={tx.transaction_id} tx={tx} />
        ))}
      </div>
    </div>
  );
}

function TransactionRow({ tx }) {
  const [isOpen, setIsOpen] = useState(false);

  const total = Number(tx.amount || 0);
  const paid = Number(tx.amount_paid || 0);
  const balance = total - paid;
  const isPaid = tx.payment_status === 'paid' || balance <= 0;
  const date = tx.logged_at ? new Date(tx.logged_at).toLocaleDateString() : '';

  return (
    <div style={{ borderBottom: '1px solid #f3f4f6', width: '100%' }}>
      {/* Clean Horizontal Row changed to CSS Grid */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          display: 'grid', 
          gridTemplateColumns: '1.2fr 1fr 1fr 0.8fr', 
          alignItems: 'center', 
          padding: '12px 16px', 
          cursor: 'pointer', 
          fontSize: '13px', 
          color: '#374151', 
          backgroundColor: '#ffffff' 
        }}
      >
        {/* 1. Client Info Column */}
        <div style={{ textAlign: 'left', minWidth: 0 }}>
          <span className="fw-semibold text-dark d-block" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tx.merchant_note || "Unnamed Client"}
          </span>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>
            #{tx.transaction_id || 'N/A'} {date ? `• ${date}` : ''}
          </span>
        </div>
        
        {/* 2. Total Column */}
        <div style={{ textAlign: 'right', fontFamily: 'monospace', color: '#4b5563', paddingRight: '8px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          ₦{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </div>
        
        {/* 3. Paid Column */}
        <div style={{ textAlign: 'right', fontFamily: 'monospace', color: '#059669', paddingRight: '8px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          ₦{paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </div>
        
        {/* 4. Status Badge Column */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
          <span style={{ fontSize: '10px', fontWeight: '600', color: isPaid ? '#059669' : '#d97706' }}>
            {isPaid ? 'PAID' : 'PENDING'}
          </span>
          <span style={{ fontSize: '9px', color: '#9ca3af' }}>{isOpen ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expandable Subtle Tray */}
      {isOpen && (
        <div style={{ padding: '10px 16px', backgroundColor: '#f9fafb', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#6b7280' }}>
          <div style={{ fontStyle: 'italic', color: '#4b5563', maxWidth: '60%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            "{tx.merchant_note || 'No notes available.'}"
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ color: '#9ca3af' }}>Owed:</span>{' '}
            <span style={{ fontFamily: 'monospace', color: balance > 0 ? '#d97706' : '#6b7280', fontWeight: '600' }}>
              ₦{balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}