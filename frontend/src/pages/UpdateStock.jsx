import Layout from "../components/Layout";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-hot-toast";
import { IconSearch } from "../components/Icons";

const UpdateStock = () => {
    useAuth();
    const [products, setProducts] = useState([]);
    const [searchParams] = useSearchParams();
    const [stockRows, setStockRows] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [formData, setFormData] = useState({
        product_id: "",
        warehouse_name: "",
        quantity: "",
        shelf_code: "",
        product_name: "",
        product_description: ""
    });
    const [selectedSummary, setSelectedSummary] = useState(null);
    const [loading, setLoading] = useState(false);
    const suggestionRef = useRef(null);

    const loadCatalogAndStock = useCallback(async () => {
        try {
            const [prodRes, stockRes] = await Promise.all([api.get("/products"), api.get("/stock")]);
            setProducts(prodRes.data);
            setStockRows(stockRes.data);
            return { products: prodRes.data, stockRows: stockRes.data };
        } catch (error) {
            console.error("Error fetching catalog/stock:", error);
            return { products: [], stockRows: [] };
        }
    }, []);

    const applyProductFromStock = useCallback((p, rows) => {
        const list = Array.isArray(rows) ? rows : [];
        const forProduct = list
            .filter((s) => Number(s.product_id) === Number(p.id))
            .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
        const row = forProduct[0];
        const shelfVal = row?.shelf_code && row.shelf_code !== "N/A" ? row.shelf_code : "";
        setFormData((prev) => ({
            ...prev,
            product_id: p.id,
            product_name: p.name,
            product_description: p.description || "",
            warehouse_name: row?.warehouse_name ?? "",
            shelf_code: shelfVal,
            quantity: ""
        }));
        setSelectedSummary({
            name: p.name,
            sku: p.sku,
            unit: p.unit || "pcs",
            category: p.category,
            costLabel: p.cost_per_unit != null ? String(p.cost_per_unit) : "—",
            currentQty: row != null ? Number(row.quantity) : 0,
            hasRow: Boolean(row),
            locationHint: row
                ? `Prefilled from the most recently updated location (${row.warehouse_name}${shelfVal ? ` · ${shelfVal}` : ""}).`
                : "No stock row yet — enter warehouse and shelf, then add stock."
        });
    }, []);

    useEffect(() => {
        const init = async () => {
            const { products: fetchedProducts, stockRows: fetchedStockRows } = await loadCatalogAndStock();
            
            const pId = searchParams.get("product_id");
            const warehouse = searchParams.get("warehouse");
            const shelf = searchParams.get("shelf");
            
            if (pId && fetchedProducts.length > 0) {
                const p = fetchedProducts.find(x => String(x.id) === String(pId));
                if (p) {
                    setSearchTerm(`${p.name} (${p.sku})`);
                    
                    if (warehouse) {
                        setFormData({
                            product_id: p.id,
                            product_name: p.name,
                            product_description: p.description || "",
                            warehouse_name: warehouse,
                            shelf_code: shelf || "N/A",
                            quantity: ""
                        });
                        
                        const row = fetchedStockRows.find(s => 
                            Number(s.product_id) === Number(p.id) && 
                            s.warehouse_name === warehouse && 
                            (s.shelf_code === shelf || (s.shelf_code === "N/A" && !shelf))
                        );

                        setSelectedSummary({
                            name: p.name,
                            sku: p.sku,
                            unit: p.unit || "pcs",
                            category: p.category,
                            costLabel: p.cost_per_unit != null ? String(p.cost_per_unit) : "—",
                            currentQty: row != null ? Number(row.quantity) : 0,
                            hasRow: Boolean(row),
                            locationHint: `Location: ${warehouse}${shelf ? ` · ${shelf}` : ""}`
                        });
                    } else {
                        applyProductFromStock(p, fetchedStockRows);
                    }
                }
            }
        };
        init();
    }, [loadCatalogAndStock, searchParams, applyProductFromStock]);

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (suggestionRef.current && !suggestionRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelectProduct = (p) => {
        applyProductFromStock(p, stockRows);
        setSearchTerm(`${p.name} (${p.sku})`);
        setShowSuggestions(false);
    };

    const handleAction = async (action) => {
        const qty = Number(formData.quantity);
        if (!formData.product_id || !formData.warehouse_name?.trim()) {
            toast.error("Select a product and enter a warehouse.");
            return;
        }
        if (!Number.isFinite(qty) || qty <= 0) {
            toast.error(`Enter a valid quantity (pcs).`);
            return;
        }

        const pid = formData.product_id;
        setLoading(true);
        try {
            // Unified Update: Sync product details first
            await api.put(`/products/${pid}`, {
                name: formData.product_name,
                description: formData.product_description
            });

            const endpoint = action === "add" ? "/stock/add" : "/stock/remove";
            await api.post(endpoint, {
                product_id: Number(formData.product_id),
                warehouse_name: formData.warehouse_name.trim(),
                quantity: qty,
                shelf_code: (formData.shelf_code || "").trim() || "N/A"
            });
            toast.success(`Stock ${action === "add" ? "added" : "removed"} successfully.`);
            const stockRes = await api.get("/stock");
            setStockRows(stockRes.data);
            const p = products.find((x) => Number(x.id) === Number(pid));
            if (p) applyProductFromStock(p, stockRes.data);
            setFormData((prev) => ({ ...prev, quantity: "" }));
        } catch (error) {
            toast.error(error.response?.data?.message || error.response?.data?.error || "Failed to update stock.");
        } finally {
            setLoading(false);
        }
    };

    const filteredSuggestions = Array.isArray(products) 
        ? products.filter(p => 
            (p.name && p.name.toLowerCase().includes(searchTerm.toLowerCase())) || 
            (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
        ).slice(0, 8)
        : [];

    return (
        <Layout>
            <div style={{ maxWidth: "900px", margin: "0 auto" }}>
                <header className="mb-2">
                    <h1>Update <span className="text-accent">Stock</span></h1>
                    <p className="text-muted">Add or remove items from the warehouse.</p>
                </header>

                <div className="card glass-card" style={{ borderTop: "4px solid var(--accent)", position: "relative" }}>
                    <h2 className="mb-2">Stock Update Form</h2>
                    <div className="flex flex-column gap-1">
                        
                        {/* Searchable Item Input */}
                        <div style={{ position: "relative" }} ref={suggestionRef}>
                            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.5rem", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)" }}>
                                <IconSearch size={16} style={{ opacity: 0.7 }} />
                                1. SEARCH PRODUCT
                            </label>
                            <input
                                type="text"
                                placeholder="Type product name or SKU..."
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setShowSuggestions(true);
                                    if (!e.target.value.trim()) {
                                        setFormData((f) => ({ ...f, product_id: "", warehouse_name: "", shelf_code: "", quantity: "" }));
                                        setSelectedSummary(null);
                                    }
                                }}
                                onFocus={() => setShowSuggestions(true)}
                                style={{ height: "3.5rem" }}
                            />
                            {showSuggestions && searchTerm.length > 0 && (
                                <div style={{
                                    position: "absolute", top: "100%", left: 0, right: 0, 
                                    backgroundColor: "#1e293b", border: "1px solid var(--border)",
                                    borderRadius: "12px", marginTop: "5px", zIndex: 10,
                                    boxShadow: "0 10px 25px rgba(0,0,0,0.3)", overflow: "hidden", color: "white"
                                }}>
                                    {filteredSuggestions.length > 0 ? filteredSuggestions.map(p => (
                                        <div 
                                            key={p.id} 
                                            onClick={() => handleSelectProduct(p)}
                                            style={{
                                                padding: "1rem", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.05)",
                                                transition: "background 0.2s"
                                            }}
                                            onMouseEnter={(e) => e.target.style.backgroundColor = "rgba(255,255,255,0.05)"}
                                            onMouseLeave={(e) => e.target.style.backgroundColor = "transparent"}
                                        >
                                            <div style={{ fontWeight: 800, fontSize: "0.9rem" }}>{p.name}</div>
                                            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>SKU: {p.sku} | {(p.category || "—").replace(/_/g, " ").toUpperCase()} · Unit: {p.unit || "pcs"}</div>
                                        </div>
                                    )) : (
                                        <div style={{ padding: "1rem", color: "var(--text-muted)", fontSize: "0.8rem" }}>No matching products found.</div>
                                    )}
                                </div>
                            )}
                        </div>

                        {selectedSummary && (
                            <div className="flex flex-column gap-1" style={{ background: "rgba(255,255,255,0.02)", padding: "1.5rem", borderRadius: "12px", border: "1px solid var(--border)" }}>
                                <div className="flex gap-1">
                                    <div style={{ flex: 2 }}>
                                        <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)" }}>PRODUCT NAME</label>
                                        <input
                                            type="text"
                                            value={formData.product_name}
                                            onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                                            style={{ height: "3.5rem" }}
                                        />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)" }}>SKU (READ-ONLY)</label>
                                        <input
                                            type="text"
                                            value={selectedSummary.sku}
                                            disabled
                                            style={{ height: "3.5rem", opacity: 0.6, background: "rgba(0,0,0,0.1)" }}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)" }}>PRODUCT DETAILS</label>
                                    <textarea
                                        placeholder="Enter additional details..."
                                        value={formData.product_description}
                                        onChange={(e) => setFormData({ ...formData, product_description: e.target.value })}
                                        style={{ height: "80px", resize: "none", padding: "1rem" }}
                                    />
                                </div>
                                <div style={{ fontSize: "0.75rem", color: "var(--primary)", fontWeight: 700, marginTop: "0.5rem" }}>
                                    {selectedSummary.locationHint} | Current: {selectedSummary.currentQty} pcs
                                </div>
                            </div>
                        )}

                        <div className="flex gap-1" style={{ flexWrap: "wrap" }}>
                            <div style={{ flex: 1, minWidth: "200px" }}>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)" }}>2. WAREHOUSE</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Main Store, Building A"
                                    value={formData.warehouse_name}
                                    onChange={(e) => setFormData({ ...formData, warehouse_name: e.target.value })}
                                    style={{ height: "3.5rem" }}
                                />
                            </div>

                            <div style={{ flex: 1, minWidth: "150px" }}>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)" }}>3. SHELF CODE</label>
                                <input
                                    type="text"
                                    placeholder="e.g. ALPHA-101"
                                    value={formData.shelf_code}
                                    onChange={(e) => setFormData({ ...formData, shelf_code: e.target.value })}
                                    style={{ height: "3.5rem" }}
                                />
                            </div>

                            <div style={{ flex: 1, minWidth: "150px" }}>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)" }}>
                                    4. QUANTITY TO ADD OR REMOVE (PCS)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    placeholder="0"
                                    value={formData.quantity}
                                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                                    style={{ height: "3.5rem" }}
                                />
                            </div>
                        </div>

                        <div className="flex gap-1 mt-2">
                            <button
                                style={{ flex: 1, height: "4.5rem", fontSize: "1.1rem", fontWeight: 900, letterSpacing: "1px" }}
                                onClick={() => handleAction("add")}
                                disabled={loading}
                            >
                                {loading ? "PROCESSING..." : "ADD STOCK (+)"}
                            </button>
                            <button
                                className="danger"
                                style={{ flex: 1, height: "4.5rem", fontSize: "1.1rem", fontWeight: 900, letterSpacing: "1px" }}
                                onClick={() => handleAction("remove")}
                                disabled={loading}
                            >
                                {loading ? "PROCESSING..." : "REMOVE STOCK (-)"}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mt-3" style={{ textAlign: "center" }}>
                    <p className="text-muted" style={{ fontSize: "0.8rem" }}>
                        Cannot find the item? Go to <a href="/admin/products" style={{ color: "var(--accent)", fontWeight: 800 }}>All Products</a> to register it first.
                    </p>
                </div>
            </div>
        </Layout>
    );
};

export default UpdateStock;
