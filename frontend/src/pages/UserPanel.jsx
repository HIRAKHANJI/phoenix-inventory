import Layout from "../components/Layout";
import { useState, useEffect } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const UserPanel = () => {
  useAuth();
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const handleDownloadStockReport = () => {
    const doc = new jsPDF();
    const company = (localStorage.getItem("company") || "phoenix").toLowerCase();
    const companyLabel = company === 'inpack' ? 'Inpack' : 'Phoenix';

    doc.setFontSize(22);
    doc.setTextColor(12, 26, 61);
    doc.text(`${companyLabel} Inventory Report`, 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Report Generated: ${new Date().toLocaleString()}`, 14, 28);

    const rows = filteredStock.map((s) => [
      s.product_name || "—",
      s.product_sku || "—",
      s.warehouse_name || "—",
      s.shelf_code || "—",
      String(Number(s.quantity ?? 0)),
    ]);

    autoTable(doc, {
      startY: 35,
      head: [["Product", "SKU", "Warehouse", "Shelf", "Quantity"]],
      body: rows,
      theme: "grid",
      headStyles: { fillColor: [12, 26, 61] },
      styles: { fontSize: 8 },
    });

    doc.save(`${companyLabel}_Stock_Report_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const handleExportCSV = () => {
    try {
        const headers = ["Product Name,SKU,Warehouse,Shelf,Quantity,Status"];
        const rows = filteredStock.map(s => 
            `"${s.product_name}","${s.product_sku}","${s.warehouse_name}","${s.shelf_code}",${s.quantity},${Number(s.quantity) < 20 ? 'LOW' : 'OPTIMAL'}`
        );
        const csvContent = "data:text/csv;charset=utf-8," + headers.concat(rows).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Inventory_Data_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
    } catch (err) {
        console.error(err);
    }
  };

  useEffect(() => {
    const fetchStock = async () => {
      try {
        const res = await api.get("/stock");
        setStock(res.data);
      } catch (error) {
        console.error("Error fetching stock:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStock();
  }, []);

  const filteredStock = stock.filter(item =>
    item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.product_sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <header className="flex justify-between align-center mb-3" style={{ flexWrap: "wrap", gap: "1.5rem" }}>
          <div>
            <h1 style={{ letterSpacing: "-1.5px" }}>Facility <span className="text-accent">Inventory</span></h1>
            <p className="text-muted" style={{ fontWeight: 600, fontSize: "0.8rem", letterSpacing: "1px" }}>WAREHOUSE STOCK</p>
          </div>
          
          <div className="flex align-center gap-1" style={{ flexWrap: "wrap" }}>
            <button onClick={handleDownloadStockReport} className="secondary" style={{ height: "3.5rem", padding: "0 1.5rem", fontWeight: 800, fontSize: "0.75rem", letterSpacing: "1px" }}>⤓ PDF REPORT</button>
            <button onClick={handleExportCSV} className="secondary" style={{ height: "3.5rem", padding: "0 1.5rem", fontWeight: 800, fontSize: "0.75rem", letterSpacing: "1px", color: "var(--accent)" }}>📈 CSV EXPORT</button>
            <div style={{ position: "relative", width: "240px" }}>
              <span style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", opacity: 0.5 }}>🔍</span>
              <input
                type="text"
                placeholder="Search products..."
                style={{ paddingLeft: "42px", height: "3.5rem", borderRadius: "12px", fontSize: "0.9rem" }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </header>

        <div className="card glass-card" style={{ padding: 0, borderRadius: "16px", overflow: "hidden" }}>
          <div style={{ padding: "1.5rem 2rem", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <h2 style={{ fontSize: "1.1rem", margin: 0 }}>Current Stock</h2>
            <p className="text-muted" style={{ fontSize: "0.75rem", fontWeight: 600, marginTop: "0.25rem" }}>{filteredStock.length} TOTAL ITEMS</p>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
              <thead style={{ backgroundColor: "rgba(255,255,255,0.02)" }}>
                <tr>
                  <th style={{ padding: "1.25rem 2rem", fontSize: "0.65rem", letterSpacing: "1px", color: "var(--text-muted)" }}>PRODUCT NAME</th>
                  <th style={{ padding: "1.25rem", fontSize: "0.65rem", letterSpacing: "1px", color: "var(--text-muted)" }}>SKU</th>
                  <th style={{ padding: "1.25rem", fontSize: "0.65rem", letterSpacing: "1px", color: "var(--text-muted)" }}>WAREHOUSE</th>
                  <th style={{ padding: "1.25rem", fontSize: "0.65rem", letterSpacing: "1px", color: "var(--text-muted)" }}>SHELF</th>
                  <th style={{ padding: "1.25rem", fontSize: "0.65rem", letterSpacing: "1px", color: "var(--text-muted)" }}>QTY</th>
                  <th style={{ padding: "1.25rem 2rem", fontSize: "0.65rem", letterSpacing: "1px", color: "var(--text-muted)" }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" style={{ textAlign: "center", padding: "4rem" }}>
                    <div className="text-muted" style={{ fontWeight: 800, letterSpacing: "2px" }}>LOADING STOCK...</div>
                  </td></tr>
                ) : filteredStock.length > 0 ? (
                  filteredStock.map((item) => (
                    <tr key={item.id}>
                      <td style={{ padding: "1.25rem 2rem", fontWeight: 800 }}>{item.product_name}</td>
                      <td style={{ padding: "1.25rem" }}><code style={{ background: "rgba(255,255,255,0.05)", padding: "0.25rem 0.5rem", borderRadius: "4px", fontSize: "0.8rem" }}>{item.product_sku}</code></td>
                      <td style={{ padding: "1.25rem", fontWeight: 600 }}>{item.warehouse_name}</td>
                      <td style={{ padding: "1.25rem", fontWeight: 800, color: "var(--primary)" }}>{item.shelf_code || "—"}</td>
                      <td style={{ padding: "1.25rem", fontWeight: 900, fontSize: "1.1rem" }}>{item.quantity}</td>
                      <td style={{ padding: "1.25rem 2rem" }}>
                        <span style={{
                          padding: "0.3rem 0.8rem",
                          borderRadius: "15px",
                          fontSize: "0.6rem",
                          fontWeight: 900,
                          backgroundColor: 
                            item.quantity === 0 ? "rgba(225, 29, 72, 0.2)" :
                            item.quantity < 10 ? "rgba(225, 29, 72, 0.1)" :
                            item.quantity < 20 ? "rgba(234, 179, 8, 0.1)" : 
                            "rgba(16, 185, 129, 0.1)",
                          color: 
                            item.quantity === 0 ? "#ff0000" :
                            item.quantity < 10 ? "var(--accent)" :
                            item.quantity < 20 ? "var(--warning)" : 
                            "var(--success)",
                          border: `1px solid ${
                            item.quantity === 0 ? "#ff0000" :
                            item.quantity < 10 ? "var(--accent)" :
                            item.quantity < 20 ? "var(--warning)" : 
                            "var(--success)"
                          }`
                        }}>
                          {item.quantity === 0 ? "OUT OF STOCK" :
                           item.quantity < 10 ? "REPLENISH" :
                           item.quantity < 20 ? "LOW" : "GOOD"}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="6" style={{ textAlign: "center", padding: "4rem" }}>
                    <div className="text-muted" style={{ fontWeight: 800, letterSpacing: "1px" }}>NO PRODUCTS FOUND.</div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default UserPanel;
