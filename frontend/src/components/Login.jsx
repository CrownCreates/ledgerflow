import React, { useState } from 'react';
import axios from 'axios';

const AuthSystem = ({ onLoginSuccess }) => {
    const [isRegistering, setIsRegistering] = useState(false); // Controls view toggle
    const [businessName, setBusinessName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        const payload = isRegistering
            ? { business_name: businessName, phone_number: phoneNumber, password }
            : { phone_number: phoneNumber, password };
        const endpoint = isRegistering
            ? 'http://localhost:5001/api/auth/register' // 🎯 Swapped 127.0.0.1 for localhost
            : 'http://localhost:5001/api/auth/login';    // 🎯 Swapped 127.0.0.1 for localhost
        try {
            const response = await axios.post(endpoint, payload);

            if (isRegistering) {
                setSuccess("Account established successfully! Switching to sign-in...");
                setIsRegistering(false); // Send them to login screen
                setBusinessName('');
                setPassword('');
            } else {
                if (response.data && response.data.merchant) {
                    onLoginSuccess(response.data.merchant); // Pass user data up to App.jsx
                }
            }
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || "An error occurred during authentication.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
            <div className="card p-4 shadow-sm" style={{ width: '100%', maxWidth: '400px' }}>

                <h3 className="card-title text-center fw-bold mb-2">Merchant Dashboard</h3>
                <p className="text-muted text-center small mb-4">Private Business Ledger System</p>

                {error && <div className="alert alert-danger py-2 small">{error}</div>}
                {success && <div className="alert alert-success py-2 small">{success}</div>}

                <form onSubmit={handleSubmit}>
                    {isRegistering && (
                        <div className="mb-3">
                            <label className="form-label small fw-bold">Business / Merchant Name</label>
                            <input
                                type="text"
                                className="form-control"
                                value={businessName}
                                onChange={(e) => setBusinessName(e.target.value)}
                                placeholder="e.g., Senator Black Collections"
                                required
                            />
                        </div>
                    )}

                    <div className="mb-3">
                        <label className="form-label small fw-bold">Phone Number</label>
                        <input
                            type="text"
                            className="form-control"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="e.g., 08012345678"
                            required
                        />
                    </div>

                    <div className="mb-4">
                        <label className="form-label small fw-bold">Password</label>
                        <input
                            type="password"
                            className="form-control"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button type="submit" className="btn btn-dark w-100 fw-bold mb-3" disabled={loading}>
                        {loading && <span className="spinner-border spinner-border-sm me-2"></span>}
                        {isRegistering ? "Create Account" : "Sign In"}
                    </button>

                    <div className="text-center">
                        <button
                            type="button"
                            className="btn btn-link btn-sm text-decoration-none text-dark fw-bold"
                            onClick={() => {
                                setIsRegistering(!isRegistering);
                                setError('');
                                setSuccess('');
                            }}
                        >
                            {isRegistering ? "Already have an account? Sign In" : "New business? Create an account"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AuthSystem;