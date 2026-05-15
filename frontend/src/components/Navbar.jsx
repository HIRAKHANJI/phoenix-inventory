import phoenixLogo from "../assets/phoenix-logo.png";
import inpackLogo from "../assets/inpack-logo.png";

import { useNavigate, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

const Navbar = ({ company: propsCompany }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isAuthenticated = !!user;
  const role = user?.role;
  const company = (propsCompany || user?.company || localStorage.getItem("company") || "phoenix").toLowerCase();

  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const logoSrc = company === 'inpack' ? inpackLogo : phoenixLogo;
  const companyTitle = company === 'inpack' ? 'INPACK' : 'PHOENIX';
  const companySubtitle = company === 'inpack' ? 'INVENTORY' : 'STOCKS';

  useEffect(() => {
    if (isAuthenticated) {
      const fetchNotifications = async () => {
        try {
          const res = await api.get("/notifications");
          setNotifications(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
          console.error("Failed to fetch notifications", error);
        }
      };
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, role, company]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (error) {
      console.error("Failed to mark as read", error);
    }
  };

  return (
    <nav className="navbar" style={{
      padding: "0.75rem 2.5rem",
      backgroundColor: "white",
      boxShadow: "0 4px 20px -5px rgba(0,0,0,0.1)",
      position: "sticky",
      top: 0,
      zIndex: 1000,
      borderBottom: "1px solid var(--border)",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      transition: "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)"
    }}>
      <div className="flex align-center gap-1">
        <img src={logoSrc} alt={`${companyTitle} Logo`} style={{
          height: company === 'inpack' ? "55px" : "45px",
          objectFit: "contain"
        }} />
        <div style={{ height: "30px", width: "1px", backgroundColor: "var(--border)", margin: "0 0.75rem" }}></div>
        <h2 style={{
          margin: 0,
          fontSize: "1.4rem",
          fontWeight: 900,
          color: company === 'inpack' ? "var(--accent)" : "var(--primary)",
          letterSpacing: "-0.75px"
        }}>
          {companyTitle} <span className="text-muted" style={{ fontWeight: 400 }}>{companySubtitle}</span>
        </h2>
      </div>

      <div className="flex align-center gap-2">
        {!isAuthenticated ? (
          <div className="flex gap-1 align-center">
            <Link to="/login" style={{ color: "var(--primary)", fontWeight: 700, textDecoration: "none", fontSize: "0.75rem", letterSpacing: "1px" }}>LOGIN</Link>
            <div style={{ width: "1px", height: "12px", backgroundColor: "var(--border)" }}></div>
            <Link to="/register" style={{ color: "var(--accent)", fontWeight: 700, textDecoration: "none", fontSize: "0.75rem", letterSpacing: "1px" }}>REGISTER</Link>
          </div>
        ) : (
          <>
            <div className="flex align-center gap-1" style={{ marginRight: "1rem" }}>
              <div style={{ textAlign: "right", paddingRight: "1rem", borderRight: "1px solid var(--border)" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-main)", letterSpacing: "-0.25px" }}>
                  {user.name || "UNIDENTIFIED"}
                </div>
                <div style={{ fontSize: "0.65rem", fontWeight: 900, color: "var(--accent)", letterSpacing: "1px", textTransform: "uppercase" }}>
                  {role === 'super_admin' ? 'SUPER ADMIN' : role === 'admin' ? 'ADMIN' : role === 'viewer' ? 'VIEWER' : 'USER'}
                </div>
              </div>
            </div>

            <div style={{ position: "relative" }}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  position: "relative",
                  padding: "0.5rem",
                  color: "var(--text-main)",
                  opacity: 0.8
                }}
              >
                🔔
                {unreadCount > 0 && (
                  <span style={{
                    position: "absolute",
                    top: "0",
                    right: "0",
                    background: "var(--accent)",
                    color: "white",
                    borderRadius: "50%",
                    width: "18px",
                    height: "18px",
                    fontSize: "0.7rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 900,
                    border: "2px solid #fff"
                  }}>
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="card glass-card" style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  width: "350px",
                  maxHeight: "450px",
                  overflowY: "auto",
                  zIndex: 2000,
                  padding: "1.5rem",
                  marginTop: "1.25rem",
                  borderRadius: "20px",
                  backgroundColor: "rgba(255,255,255,0.95)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid var(--border)"
                }}>
                  <div className="flex justify-between align-center mb-1 pb-1" style={{ borderBottom: "1px solid var(--border)" }}>
                    <h3 style={{ fontSize: "0.8rem", margin: 0, letterSpacing: "1px", color: "var(--primary)" }}>NOTIFICATIONS</h3>
                    <span style={{ fontSize: "0.6rem", fontWeight: 800, background: "rgba(0,0,0,0.05)", padding: "0.2rem 0.5rem", borderRadius: "10px" }}>{unreadCount} NEW</span>
                  </div>
                  {notifications.length === 0 ? (
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center", padding: "2rem 0" }}>No new notifications.</p>
                  ) : (
                    <div className="flex flex-column gap-1">
                      {notifications.map(n => (
                        <div
                          key={n.id}
                          onClick={() => markAsRead(n.id)}
                          style={{
                            fontSize: "0.75rem",
                            padding: "0.75rem",
                            borderRadius: "12px",
                            backgroundColor: n.is_read ? "transparent" : "rgba(0,0,0,0.02)",
                            borderLeft: n.is_read ? "3px solid transparent" : "3px solid var(--accent)",
                            cursor: "pointer",
                            transition: "all 0.2s"
                          }}
                        >
                          <div style={{ color: "var(--text-main)", fontWeight: n.is_read ? 400 : 700 }}>{n.message}</div>
                          <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", marginTop: "0.4rem", fontWeight: 600 }}>
                            {new Date(n.created_at).toLocaleTimeString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={handleLogout}
              className="btn-sm"
              style={{
                backgroundColor: "var(--accent)",
                color: "white",
                padding: "0.6rem 1.4rem",
                borderRadius: "12px",
                fontSize: "0.75rem",
                fontWeight: 900,
                letterSpacing: "1px",
                display: "flex",
                alignItems: "center",
                gap: "0.6rem"
              }}
            >
              LOGOUT
            </button>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
