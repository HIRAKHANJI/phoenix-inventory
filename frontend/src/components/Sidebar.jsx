import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Sidebar = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const role = user?.role;
    const isAdmin = role === "admin" || role === "super_admin";

    const adminLinks = [
        { path: "/admin", label: "Analytics", icon: "📊" },
        { path: "/admin/products", label: "Catalog", icon: "📦" },
        { path: "/admin/stock", label: "Inventory", icon: "🔄" },
        { path: "/admin/stock/updates", label: "Updates", icon: "📥" },
        { path: "/admin/inventory-items", label: "Inv. Items", icon: "🗂️" },
        { path: "/admin/manufacturing", label: "Manufacturing", icon: "🏭" },
        { path: "/admin/users", label: "Users", icon: "👥" },
    ];

    const userLinks = [
        { path: "/user/analytics", label: "Analytics", icon: "📊" },
        { path: "/user", label: "Warehouse", icon: "🏠" },
        { path: "/admin/products", label: "Catalog", icon: "📦" },
        { path: "/user/stock", label: "Updates", icon: "📥" },
    ];

    const links = isAdmin ? adminLinks : userLinks;

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    return (
        <aside className="sidebar" style={{
            width: "280px",
            backgroundColor: "white",
            borderRight: "1px solid var(--border)",
            minHeight: "calc(100vh - 73px)",
            padding: "2.5rem 1.5rem",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            transition: "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)"
        }}>
            <div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {links.map((link) => (
                        <li key={link.path} style={{ marginBottom: "0.5rem" }}>
                            <Link
                                to={link.path}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "1.25rem",
                                    padding: "1rem 1.5rem",
                                    borderRadius: "16px",
                                    color: location.pathname === link.path ? "white" : "var(--text-muted)",
                                    backgroundColor: location.pathname === link.path ? "var(--primary)" : "transparent",
                                    transition: "all 0.3s ease",
                                    textDecoration: "none",
                                    fontWeight: 700,
                                    fontSize: "0.85rem",
                                    letterSpacing: "0.5px"
                                }}
                            >
                                <span style={{ fontSize: "1.3rem", opacity: location.pathname === link.path ? 1 : 0.6 }}>{link.icon}</span>
                                <span>{link.label.toUpperCase()}</span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>

            <div style={{ paddingTop: "2rem", borderTop: "1px solid var(--border)" }}>
                <button
                    onClick={handleLogout}
                    className="secondary"
                    style={{ 
                        width: "100%", 
                        justifyContent: "center", 
                        gap: "1rem", 
                        backgroundColor: "rgba(0,0,0,0.03)", 
                        color: "var(--primary)",
                        padding: "1rem",
                        borderRadius: "16px",
                        fontWeight: 900,
                        fontSize: "0.75rem",
                        letterSpacing: "1px",
                        border: "none"
                    }}
                >
                    <span>SIGN OUT</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
