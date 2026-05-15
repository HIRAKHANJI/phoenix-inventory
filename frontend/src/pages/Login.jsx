import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";
import phoenixLogo from "../assets/phoenix-logo.png";
import inpackLogo from "../assets/inpack-logo.png";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany] = useState(localStorage.getItem("company") || "phoenix");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const logoSrc = company === "inpack" ? inpackLogo : phoenixLogo;
  const companyName = company === "inpack" ? "Inpack" : "Phoenix";
  const systemName = company === "inpack" ? "Inpack" : "Phoenix";

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      localStorage.setItem("company", company);
      const response = await api.post(
        "/auth/login",
        { email, password },
        { headers: { "x-company": company } }
      );
      login({ ...response.data, company });
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Login Failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    localStorage.setItem("company", company);
  }, [company]);

  const isInpack = company === 'inpack';

  return (
    <div className={`theme-${company}`} style={{ minHeight: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Navbar company={company} />
      
      <main style={{
        flex: 1,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        backgroundColor: "var(--bg-main)",
        backgroundImage: isInpack
          ? "radial-gradient(circle at 20% 30%, rgba(249, 115, 22, 0.05) 0%, transparent 100%)"
          : "radial-gradient(circle at 20% 30%, rgba(29, 71, 155, 0.05) 0%, transparent 100%)",
        transition: "all 0.8s cubic-bezier(0.4, 0, 0.2, 1)"
      }}>
        {/* Technical Overlay */}
        <div className="dot-grid-bg" style={{ position: "absolute", inset: 0, opacity: 0.1, pointerEvents: "none" }}></div>
        
        {/* Animated Background Element */}
        <div style={{
          position: "absolute",
          top: "10%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "600px",
          height: "600px",
          background: isInpack ? "rgba(249, 115, 22, 0.1)" : "rgba(29, 71, 155, 0.05)",
          borderRadius: "50%",
          filter: "blur(120px)",
          pointerEvents: "none",
          zIndex: 0
        }}></div>

        <div className="glass-card" style={{
          width: "100%",
          maxWidth: "460px",
          padding: "3.5rem",
          borderRadius: "32px",
          position: "relative",
          zIndex: 1,
          border: "1px solid var(--border)",
          backgroundColor: "rgba(255, 255, 255, 0.8)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.1)"
        }}>
          {/* Security Badge */}
          <div style={{
            position: "absolute",
            top: "-15px",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: isInpack ? "var(--accent)" : "var(--primary)",
            color: "white",
            padding: "0.4rem 1.2rem",
            borderRadius: "20px",
            fontSize: "0.65rem",
            fontWeight: 900,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            boxShadow: "0 10px 20px rgba(0,0,0,0.1)",
            whiteSpace: "nowrap"
          }}>
            {companyName} Login
          </div>

          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <img src={logoSrc} alt="Brand" style={{
              height: "80px",
              marginBottom: "1.5rem",
              objectFit: "contain"
            }} />
            <h1 style={{
              margin: 0,
              fontSize: "1.75rem",
              fontWeight: 900,
              color: "var(--text-main)",
              letterSpacing: "-1px",
              textTransform: "uppercase"
            }}>
              {companyName} <span style={{ color: "var(--accent)", fontWeight: 300 }}>Inventory</span>
            </h1>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.5rem", fontWeight: 700, letterSpacing: "1px" }}>LOGIN TO YOUR ACCOUNT</p>
          </div>

          {/* Premium Segmented Control */}
          <div style={{
            marginBottom: "2.5rem",
            backgroundColor: "rgba(0,0,0,0.03)",
            padding: "0.4rem",
            borderRadius: "16px",
            display: "flex",
            position: "relative",
            border: "1px solid var(--border)"
          }}>
            {/* Sliding Highlight */}
            <div style={{
              position: "absolute",
              width: "calc(50% - 0.4rem)",
              height: "calc(100% - 0.8rem)",
              top: "0.4rem",
              left: isInpack ? "50%" : "0.4rem",
              backgroundColor: isInpack ? "var(--accent)" : "var(--primary)",
              borderRadius: "12px",
              transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
              boxShadow: isInpack ? "0 4px 12px rgba(249, 115, 22, 0.3)" : "0 4px 12px rgba(29, 71, 155, 0.2)",
              zIndex: 0
            }}></div>
            
            <button
              onClick={() => setCompany("phoenix")}
              style={{
                flex: 1,
                background: "none",
                border: "none",
                padding: "0.8rem",
                color: !isInpack ? "white" : "var(--text-muted)",
                fontSize: "0.75rem",
                fontWeight: 800,
                cursor: "pointer",
                zIndex: 1,
                transition: "color 0.3s"
              }}
            >
              PHOENIX
            </button>
            <button
              onClick={() => setCompany("inpack")}
              style={{
                flex: 1,
                background: "none",
                border: "none",
                padding: "0.8rem",
                color: isInpack ? "white" : "var(--text-muted)",
                fontSize: "0.75rem",
                fontWeight: 800,
                cursor: "pointer",
                zIndex: 1,
                transition: "color 0.3s"
              }}
            >
              INPACK
            </button>
          </div>

          {error && (
            <div style={{
              backgroundColor: "rgba(244, 63, 94, 0.1)",
              border: "1px solid rgba(244, 63, 94, 0.2)",
              color: "#fb7185",
              padding: "0.8rem",
              borderRadius: "12px",
              fontSize: "0.8rem",
              fontWeight: 600,
              textAlign: "center",
              marginBottom: "1.5rem"
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", marginBottom: "0.6rem", fontSize: "0.65rem", fontWeight: 800, color: "var(--text-muted)", letterSpacing: "1px" }}>EMAIL ADDRESS</label>
              <input
                type="email"
                placeholder="info@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  height: "3.5rem",
                  backgroundColor: "white",
                  border: "1px solid var(--border)",
                  color: "var(--text-main)",
                  fontSize: "0.9rem",
                  padding: "0 1.25rem"
                }}
              />
            </div>

            <div style={{ marginBottom: "2.5rem" }}>
              <label style={{ display: "block", marginBottom: "0.6rem", fontSize: "0.65rem", fontWeight: 800, color: "var(--text-muted)", letterSpacing: "1px" }}>PASSWORD</label>
              <input
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  height: "3.5rem",
                  backgroundColor: "white",
                  border: "1px solid var(--border)",
                  color: "var(--text-main)",
                  fontSize: "0.9rem",
                  padding: "0 1.25rem"
                }}
              />
            </div>

            <button
              type="submit"
              className="primary"
              style={{
                width: "100%",
                height: "4rem",
                borderRadius: "16px",
                fontSize: "1rem",
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "2px",
                background: isInpack ? "var(--accent)" : "var(--primary)",
                boxShadow: isInpack ? "0 8px 30px rgba(249, 115, 22, 0.2)" : "0 8px 30px rgba(29, 71, 155, 0.2)",
                transition: "all 0.3s ease",
                border: "none",
                color: "white",
                cursor: "pointer"
              }}
              disabled={loading}
            >
              {loading ? "LOGGING IN..." : "LOGIN"}
            </button>
          </form>

          <footer style={{ textAlign: "center", marginTop: "2.5rem" }}>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Don't have an account? <Link to="/register" style={{ color: "var(--accent)", fontWeight: 800, textDecoration: "none" }}>Register</Link>
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
};

export default Login;
