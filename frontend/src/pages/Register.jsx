import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-hot-toast";
import api from "../api/axios";
import phoenixLogo from "../assets/phoenix-logo.png";
import inpackLogo from "../assets/inpack-logo.png";
import Navbar from "../components/Navbar";

const Register = () => {
    const [company, setCompany] = useState((localStorage.getItem("company") || "phoenix").toLowerCase());
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: ""
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [submitted, setSubmitted] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            localStorage.setItem("company", company);
            await api.post(
              "/auth/register",
              formData,
              { headers: { "x-company": company } }
            );
            setSubmitted(true);
            toast.success("Registration submitted! Awaiting admin approval.");
        } catch (error) {
            setError(error.response?.data?.error || "Registration failed.");
        } finally {
            setLoading(false);
        }
    };

    const logoSrc = company === "inpack" ? inpackLogo : phoenixLogo;
    const isInpack = company === 'inpack';

    // Show success state after registration
    if (submitted) {
        return (
            <div className={`theme-${company}`} style={{ minHeight: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <Navbar company={company} />
                <main style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "2rem", backgroundColor: "var(--bg-main)",
                    backgroundImage: isInpack
                        ? "radial-gradient(circle at 80% 20%, rgba(249, 115, 22, 0.05) 0%, transparent 100%)"
                        : "radial-gradient(circle at 80% 20%, rgba(29, 71, 155, 0.05) 0%, transparent 100%)"
                }}>
                    <div className="glass-card" style={{
                        width: "100%", maxWidth: "500px", padding: "3rem", borderRadius: "32px",
                        border: "1px solid var(--border)", backgroundColor: "rgba(255, 255, 255, 0.8)",
                        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.1)", textAlign: "center"
                    }}>
                        <div style={{
                            width: "80px", height: "80px", borderRadius: "50%", margin: "0 auto 1.5rem",
                            background: "linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.05))",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            border: "2px solid rgba(16, 185, 129, 0.3)"
                        }}>
                            <span style={{ fontSize: "2rem" }}>✓</span>
                        </div>
                        <h2 style={{ margin: "0 0 1rem", fontSize: "1.4rem", fontWeight: 900, color: "var(--text-main)" }}>
                            Registration <span style={{ color: "var(--accent)" }}>Submitted</span>
                        </h2>
                        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: "2rem" }}>
                            Your account is <strong>pending approval</strong>. An administrator will review your request and assign your access level. You will be able to login once approved.
                        </p>
                        <Link to="/login" style={{
                            display: "inline-block", padding: "0.8rem 2rem", borderRadius: "12px",
                            backgroundColor: isInpack ? "var(--accent)" : "var(--primary)",
                            color: "white", textDecoration: "none", fontWeight: 800, fontSize: "0.8rem",
                            letterSpacing: "1px"
                        }}>
                            Go to Login
                        </Link>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className={`theme-${company}`} style={{ minHeight: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <Navbar company={company} />
            
            <main style={{
                flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
                padding: "2rem", backgroundColor: "var(--bg-main)",
                backgroundImage: isInpack
                    ? "radial-gradient(circle at 80% 20%, rgba(249, 115, 22, 0.05) 0%, transparent 100%)"
                    : "radial-gradient(circle at 80% 20%, rgba(29, 71, 155, 0.05) 0%, transparent 100%)",
                transition: "all 0.8s cubic-bezier(0.4, 0, 0.2, 1)"
            }}>
                {/* Technical Overlay */}
                <div className="dot-grid-bg" style={{ position: "absolute", inset: 0, opacity: 0.1, pointerEvents: "none" }}></div>

                <div className="glass-card" style={{
                    width: "100%", maxWidth: "500px", padding: "3rem", borderRadius: "32px",
                    position: "relative", zIndex: 1, border: "1px solid var(--border)",
                    backgroundColor: "rgba(255, 255, 255, 0.8)", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.1)"
                }}>
                    {/* Security Badge */}
                    <div style={{
                        position: "absolute", top: "-15px", left: "50%", transform: "translateX(-50%)",
                        backgroundColor: isInpack ? "var(--accent)" : "var(--primary)",
                        color: "white", padding: "0.4rem 1.2rem", borderRadius: "20px",
                        fontSize: "0.65rem", fontWeight: 900, letterSpacing: "1.5px",
                        textTransform: "uppercase", boxShadow: "0 10px 20px rgba(0,0,0,0.1)", whiteSpace: "nowrap"
                    }}>
                        New User Registration
                    </div>

                    <div style={{ textAlign: "center", marginBottom: "2rem" }}>
                        <img src={logoSrc} alt="Brand" style={{ height: "60px", marginBottom: "1rem", objectFit: "contain" }} />
                        <h1 style={{
                            margin: 0, fontSize: "1.5rem", fontWeight: 900, color: "var(--text-main)",
                            letterSpacing: "-0.5px", textTransform: "uppercase"
                        }}>
                             Create <span style={{ color: "var(--accent)", fontWeight: 300 }}>Account</span>
                        </h1>
                    </div>

                    <form onSubmit={handleRegister}>
                        {/* Company Segmented Control */}
                        <div style={{
                            marginBottom: "2rem", backgroundColor: "rgba(0,0,0,0.03)", padding: "0.4rem",
                            borderRadius: "16px", display: "flex", position: "relative", border: "1px solid var(--border)"
                        }}>
                            <div style={{
                                position: "absolute", width: "calc(50% - 0.4rem)", height: "calc(100% - 0.8rem)",
                                top: "0.4rem", left: isInpack ? "50%" : "0.4rem",
                                backgroundColor: isInpack ? "var(--accent)" : "var(--primary)",
                                borderRadius: "12px", transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                                boxShadow: isInpack ? "0 4px 12px rgba(249, 115, 22, 0.3)" : "0 4px 12px rgba(29, 71, 155, 0.2)", zIndex: 0
                            }}></div>
                            <button type="button" onClick={() => setCompany("phoenix")} style={{ flex: 1, background: "none", border: "none", padding: "0.7rem", color: !isInpack ? "white" : "var(--text-muted)", fontSize: "0.7rem", fontWeight: 800, cursor: "pointer", zIndex: 1 }}>PHOENIX</button>
                            <button type="button" onClick={() => setCompany("inpack")} style={{ flex: 1, background: "none", border: "none", padding: "0.7rem", color: isInpack ? "white" : "var(--text-muted)", fontSize: "0.7rem", fontWeight: 800, cursor: "pointer", zIndex: 1 }}>INPACK</button>
                        </div>

                        {error && (
                            <div style={{ backgroundColor: "rgba(244, 63, 94, 0.1)", border: "1px solid rgba(244, 63, 94, 0.2)", color: "#fb7185", padding: "0.7rem", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 600, textAlign: "center", marginBottom: "1.5rem" }}>{error}</div>
                        )}

                        {/* Info banner about approval */}
                        <div style={{
                            backgroundColor: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.15)",
                            color: "var(--text-muted)", padding: "0.7rem 1rem", borderRadius: "12px",
                            fontSize: "0.7rem", fontWeight: 600, textAlign: "center", marginBottom: "1.5rem", lineHeight: 1.5
                        }}>
                            ℹ️ After registration, an administrator will review and approve your access.
                        </div>

                        <div className="flex gap-1" style={{ marginBottom: "1.25rem" }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.6rem", fontWeight: 800, color: "var(--text-muted)", letterSpacing: "1px" }}>FULL NAME</label>
                                <input type="text" name="name" placeholder="John R. Doe" onChange={handleChange} required style={{ height: "3.2rem", backgroundColor: "white", border: "1px solid var(--border)", color: "var(--text-main)", borderRadius: "12px", width: "100%", padding: "0 1rem" }} />
                            </div>
                        </div>

                        <div style={{ marginBottom: "1.25rem" }}>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.6rem", fontWeight: 800, color: "var(--text-muted)", letterSpacing: "1px" }}>EMAIL ADDRESS</label>
                            <input type="email" name="email" placeholder="name@corporation.com" onChange={handleChange} required style={{ height: "3.2rem", backgroundColor: "white", border: "1px solid var(--border)", color: "var(--text-main)", borderRadius: "12px", width: "100%", padding: "0 1rem" }} />
                        </div>

                        <div style={{ marginBottom: "2rem" }}>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.6rem", fontWeight: 800, color: "var(--text-muted)", letterSpacing: "1px" }}>PASSWORD</label>
                            <input type="password" name="password" placeholder="••••••••••••" onChange={handleChange} required style={{ height: "3.2rem", backgroundColor: "white", border: "1px solid var(--border)", color: "var(--text-main)", borderRadius: "12px", width: "100%", padding: "0 1rem" }} />
                        </div>

                        <button
                            type="submit"
                            style={{
                                width: "100%", height: "3.8rem", borderRadius: "16px", fontSize: "0.9rem",
                                fontWeight: 900, textTransform: "uppercase", letterSpacing: "1.5px",
                                background: isInpack ? "var(--accent)" : "var(--primary)",
                                boxShadow: isInpack ? "0 8px 30px rgba(249, 115, 22, 0.2)" : "0 8px 30px rgba(29, 71, 155, 0.2)",
                                transition: "all 0.3s ease", color: "white", border: "none", cursor: "pointer"
                            }}
                            disabled={loading}
                        >
                            {loading ? "REGISTERING..." : "REGISTER"}
                        </button>
                    </form>

                    <footer style={{ textAlign: "center", marginTop: "2rem" }}>
                        <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                            Already have an account? <Link to="/login" style={{ color: "var(--accent)", fontWeight: 800, textDecoration: "none" }}>Login</Link>
                        </p>
                    </footer>
                </div>
            </main>
        </div>
    );
};

export default Register;
