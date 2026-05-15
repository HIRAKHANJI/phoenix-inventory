import Layout from "../components/Layout";
import { useState, useEffect } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { stockRowKey } from "../utils/warehouse";

const LABEL_W2 = "Warehouse 2";
const LABEL_W3 = "Warehouse 3";
const isWarehouse2 = (item) => item.warehouse_name === LABEL_W2;
const isWarehouse3 = (item) => item.warehouse_name === LABEL_W3;
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "react-hot-toast";

const AdminPanel = () => {
    const { user } = useAuth();
    const role = user?.role;

    const [products, setProducts] = useState([]);
    const [stock, setStock] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [message] = useState({ type: "", text: "" });

    const fetchData = async () => {
        setLoading(true);
        try {
            const prodRes = await api.get("/products");
            setProducts(Array.isArray(prodRes.data) ? prodRes.data : []);
        } catch (error) {
            console.error("Error fetching products:", error);
            setProducts([]);
        }
        try {
            const stockRes = await api.get("/stock");
            setStock(Array.isArray(stockRes.data) ? stockRes.data : []);
        } catch (error) {
            console.error("Error fetching stock:", error);
            setStock([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const q = searchTerm.toLowerCase();
    const filteredStock = stock.filter(item =>
        (item.product_name?.toLowerCase() || "").includes(q) ||
        (item.product_sku?.toLowerCase() || "").includes(q) ||
        (item.warehouse_name?.toLowerCase() || "").includes(q)
    );

    const lowStockCount = stock.filter(item => Number(item.quantity) < 20).length;

    const warehouse2Stock = filteredStock.filter(isWarehouse2);
    const warehouse3Stock = filteredStock.filter(isWarehouse3);

    const StatusPill = ({ qty }) => {
        const q = Number(qty);
        return (
            <span style={{
                padding: "0.4rem 0.8rem",
                borderRadius: "20px",
                fontSize: "0.7rem",
                fontWeight: 800,
                backgroundColor:
                    q === 0 ? "rgba(225, 29, 72, 0.2)" :
                        q < 10 ? "rgba(225, 29, 72, 0.1)" :
                            q < 20 ? "rgba(234, 179, 8, 0.1)" :
                                "rgba(16, 185, 129, 0.1)",
                color:
                    q === 0 ? "#ff0000" :
                        q < 10 ? "var(--accent)" :
                            q < 20 ? "var(--warning)" :
                                "var(--success)",
                border: `1px solid ${q === 0 ? "#ff0000" :
                        q < 10 ? "var(--accent)" :
                            q < 20 ? "var(--warning)" :
                                "var(--success)"
                    }`
            }}>
                {q === 0 ? "OUT OF STOCK" :
                    q < 10 ? "REPLENISH" :
                        q < 20 ? "LOW" : "OPTIMAL"}
            </span>
        );
    };

    const AnalysisFacilityTable = ({ title, rows, borderColorVar }) => (
        <div className="card" style={{ flex: 1, minWidth: "320px", borderTop: `4px solid var(${borderColorVar})` }}>
            <div className="flex justify-between align-center mb-2">
                <h3 style={{ margin: 0, fontSize: "1.05rem" }}>{title}</h3>
                <span style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "white",
                    background: `var(${borderColorVar})`,
                    padding: "0.2rem 0.65rem",
                    borderRadius: "20px"
                }}>
                    {rows.length} ITEMS
                </span>
            </div>
            <div style={{ overflowX: "auto" }}>
                <table>
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>SKU</th>
                            <th>Shelf</th>
                            <th>Qty</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length > 0 ? (
                            rows.map((item) => (
                                <tr key={stockRowKey(item)}>
                                    <td style={{ fontWeight: 700 }}>{item.product_name}</td>
                                    <td><code style={{ background: "var(--bg-main)", padding: "0.2rem 0.45rem", borderRadius: "4px", fontSize: "0.8rem" }}>{item.product_sku || "—"}</code></td>
                                    <td style={{ fontWeight: 600, color: "var(--primary)" }}>{item.shelf_code || "—"}</td>
                                    <td style={{ fontWeight: 800 }}>{item.quantity}</td>
                                    <td><StatusPill qty={item.quantity} /></td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="5" style={{ textAlign: "center", padding: "2rem" }}>
                                    <div className="text-muted">No stock found for this warehouse.</div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const handleDownloadReport = async () => {
        const toastId = toast.loading("Creating PDF report...");
        const company = (localStorage.getItem("company") || "phoenix").toLowerCase();
        const companyLabel = company === 'inpack' ? 'Inpack Inventory' : 'Phoenix Stocks';

        try {
            const notifRes = await api.get("/notifications");
            const notifications = Array.isArray(notifRes.data) ? notifRes.data : [];

            const doc = new jsPDF();

            // Header
            doc.setFontSize(22);
            doc.setTextColor(12, 26, 61);
            doc.text(`${companyLabel} - Inventory Report`, 14, 22);

            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Generated exactly at: ${new Date().toLocaleString()}`, 14, 30);

            // Section 1: Operations
            doc.setFontSize(14);
            doc.setTextColor(225, 29, 72);
            doc.text("1. Recent Activity", 14, 42);

            const activityData = notifications.map(notif => [
                new Date(notif.created_at).toLocaleString(),
                notif.user_name || "System",
                notif.message
            ]);

            autoTable(doc, {
                startY: 48,
                head: [["Timestamp", "User", "Activity Details"]],
                body: activityData,
                theme: 'striped',
                headStyles: { fillColor: [225, 29, 72] },
                styles: { fontSize: 8 },
                columnStyles: { 2: { cellWidth: 100 } }
            });

            // Section 2: Stock
            const finalY = doc.lastAutoTable?.finalY || 48;

            doc.setFontSize(14);
            doc.setTextColor(12, 26, 61);
            doc.text("2. Current Stock List", 14, finalY + 14);

            const stockData = stock.map(s => {
                const qty = Number(s.quantity ?? 0);
                return [
                    s.product_name || "—",
                    s.product_sku || "N/A",
                    s.warehouse_name || "—",
                    s.shelf_code || "—",
                    qty.toString(),
                    qty === 0 ? "OUT OF STOCK" : qty < 20 ? "LOW STOCK" : "GOOD"
                ];
            });

            autoTable(doc, {
                startY: finalY + 20,
                head: [["Item", "SKU", "Warehouse", "Shelf", "Units", "Condition"]],
                body: stockData,
                theme: 'grid',
                headStyles: { fillColor: [12, 26, 61] },
                styles: { fontSize: 8 }
            });

            doc.save(`${companyLabel.replace(' ', '_')}_Executive_Report_${new Date().toISOString().split('T')[0]}.pdf`);
            toast.success("Inventory Report downloaded successfully.", { id: toastId });
        } catch (error) {
            console.error("PDF Export Error:", error);
            toast.error("Failed to generate documentation. Check console for details.", { id: toastId });
        }
    };

    return (
        <Layout>
            <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
                <header className="flex justify-between align-center mb-2" style={{ flexWrap: "wrap", gap: "1rem" }}>
                    <div>
                        <h1>Dashboard <span className="text-accent">Overview</span></h1>
                        <p className="text-muted">Stats for all warehouses and products.</p>
                    </div>
                    <button onClick={handleDownloadReport} style={{
                        backgroundColor: "var(--accent)",
                        padding: "0.75rem 1.75rem",
                        fontWeight: "900",
                        letterSpacing: "1px",
                        boxShadow: "0 8px 25px rgba(225, 29, 72, 0.3)",
                        fontSize: "0.75rem"
                    }}>
                        ⤓ PDF REPORT
                    </button>
                </header>

                {message.text && (
                    <div className="card mb-2" style={{
                        backgroundColor: message.type === "success" ? "rgba(16, 185, 129, 0.1)" : "rgba(225, 29, 72, 0.1)",
                        borderColor: message.type === "success" ? "var(--success)" : "var(--accent)",
                        color: message.type === "success" ? "var(--success)" : "var(--accent)"
                    }}>
                        {message.text}
                    </div>
                )}

                <div className="flex gap-1 mb-2" style={{ flexWrap: "wrap" }}>
                    <div className="card" style={{ flex: 1, minWidth: "280px", borderLeft: "4px solid var(--primary)" }}>
                        <div className="flex justify-between align-center">
                            <span className="text-muted" style={{ fontSize: "0.85rem", fontWeight: 700 }}>TOTAL PRODUCTS</span>
                            <span style={{ fontSize: "1.5rem" }}>📦</span>
                        </div>
                        <p style={{ fontSize: "2.5rem", fontWeight: 800, margin: "0.5rem 0" }}>{products.length}</p>
                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Active in current catalog</div>
                    </div>

                    <div className="card" style={{ flex: 1, minWidth: "280px", borderLeft: "4px solid var(--accent)" }}>
                        <div className="flex justify-between align-center">
                            <span className="text-muted" style={{ fontSize: "0.85rem", fontWeight: 700 }}>LOW STOCK ALERT</span>
                            <span style={{ fontSize: "1.5rem" }}>⚠️</span>
                        </div>
                        <p style={{ fontSize: "2.5rem", fontWeight: 800, margin: "0.5rem 0", color: lowStockCount > 0 ? "var(--accent)" : "inherit" }}>
                            {lowStockCount}
                        </p>
                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Items below 20 unit threshold</div>
                    </div>

                    <div className="card" style={{ flex: 1, minWidth: "280px", borderLeft: "4px solid var(--success)" }}>
                        <div className="flex justify-between align-center">
                            <span className="text-muted" style={{ fontSize: "0.85rem", fontWeight: 700 }}>WAREHOUSES</span>
                            <span style={{ fontSize: "1.5rem" }}>🏭</span>
                        </div>
                        <p style={{ fontSize: "2.5rem", fontWeight: 800, margin: "0.5rem 0" }}>2</p>
                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Active warehouses</div>
                    </div>
                </div>

                <div className="flex gap-2 mb-2" style={{ flexWrap: "wrap" }}>
                    <div className="card" style={{ flex: 1, minWidth: "300px" }}>
                        <h2 style={{ fontSize: "1.1rem", marginBottom: "1.5rem" }}>Stock by <span className="text-accent">Type</span></h2>
                        <div className="flex flex-column gap-1">
                            {['raw_material', 'spare_part'].map(cat => {
                                const count = products.filter(p => p.category === cat).length;
                                const total = products.length || 1;
                                const percent = (count / total) * 100;
                                return (
                                    <div key={cat}>
                                        <div className="flex justify-between mb-0.5">
                                            <span style={{ fontSize: "0.8rem", fontWeight: 700 }}>{cat.replace('_', ' ').toUpperCase()}</span>
                                            <span style={{ fontSize: "0.8rem", fontWeight: 800 }}>{count} Items ({Math.round(percent)}%)</span>
                                        </div>
                                        <div style={{ height: "8px", background: "rgba(255,255,255,0.05)", borderRadius: "4px", overflow: "hidden" }}>
                                            <div style={{ 
                                                width: `${percent}%`, height: "100%", 
                                                background: cat === 'spare_part' ? "#6366f1" : "var(--success)",
                                                boxShadow: `0 0 10px ${cat === 'spare_part' ? "rgba(99, 102, 241, 0.3)" : "rgba(16, 185, 129, 0.3)"}`
                                            }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="card" style={{ flex: 1, minWidth: "300px" }}>
                        <h2 style={{ fontSize: "1.1rem", marginBottom: "1.5rem" }}>Warehouse <span className="text-accent">Stock</span></h2>
                        <div className="flex flex-column gap-1">
                            {['Warehouse 2', 'Warehouse 3'].map(w => {
                                const wStock = stock.filter(s => s.warehouse_name === w);
                                const totalUnits = wStock.reduce((acc, s) => acc + (s.quantity || 0), 0);
                                const items = wStock.length;
                                return (
                                    <div key={w} className="flex justify-between align-center p-1" style={{ background: "rgba(255,255,255,0.02)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.05)" }}>
                                        <div>
                                            <div style={{ fontSize: "0.9rem", fontWeight: 800 }}>{w.toUpperCase()}</div>
                                            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{items} Unique products</div>
                                        </div>
                                        <div style={{ textAlign: "right" }}>
                                            <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "var(--primary)" }}>{totalUnits}</div>
                                            <div style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "1px" }}>TOTAL UNITS</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="flex justify-between align-center mb-2" style={{ flexWrap: "wrap", gap: "1rem" }}>
                        <div>
                            <h2 style={{ margin: "0 0 0.35rem 0" }}>Stock List</h2>
                            <p className="text-muted" style={{ margin: 0, fontSize: "0.9rem" }}>
                                {LABEL_W2} and {LABEL_W3} line items (includes legacy registry names mapped to each facility).
                            </p>
                        </div>
                        <div style={{ position: "relative", width: "300px" }}>
                            <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>🔍</span>
                            <input
                                type="text"
                                placeholder="Filter by product or SKU..."
                                style={{ paddingLeft: "36px" }}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: "center", padding: "4rem" }} className="text-muted">
                            Loading stock data...
                        </div>
                    ) : (
                        <div className="flex gap-1" style={{ flexWrap: "wrap", alignItems: "stretch" }}>
                            <AnalysisFacilityTable title={LABEL_W2} rows={warehouse2Stock} borderColorVar="--primary" />
                            <AnalysisFacilityTable title={LABEL_W3} rows={warehouse3Stock} borderColorVar="--accent" />
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
};

export default AdminPanel;
