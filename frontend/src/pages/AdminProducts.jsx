import Layout from "../components/Layout";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { toast } from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { getCurrencySymbol, formatCurrency } from "../utils/currency";
import { IconSearch, IconPackage, IconSettings, IconTrash, IconPlus } from "../components/Icons";

const AdminProducts = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const role = user?.role;
    const isViewer = role === "viewer";

    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [showAddForm, setShowAddForm] = useState(false);
    const [newProduct, setNewProduct] = useState({
        name: "",
        warehouse_name: "",
        shelf_code: "",
        category: "raw_material",
        unit: "pcs",
        cost_per_unit: "",
        initial_quantity: "",
        description: ""
    });
    const [editingProduct, setEditingProduct] = useState(null);
    const [editData, setEditData] = useState({
        name: "",
        sku: "",
        description: "",
        category: "raw_material",
        unit: "pcs",
        cost_per_unit: ""
    });

    const fetchProducts = async () => {
        try {
            const res = await api.get("/products");
            setProducts(res.data);
        } catch (error) {
            console.error("Error fetching products:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchProducts(); }, []);

    const handleAddProduct = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const cost = newProduct.cost_per_unit === "" ? 0 : Number(newProduct.cost_per_unit);
            const initialQty = newProduct.initial_quantity === "" ? 0 : Number(newProduct.initial_quantity);
            if (!Number.isFinite(cost) || cost < 0) {
                toast.error("Unit cost must be a valid non-negative number.");
                setLoading(false);
                return;
            }
            if (!Number.isFinite(initialQty) || initialQty < 0) {
                toast.error(`Initial quantity must be zero or more (${newProduct.unit || "pcs"}).`);
                setLoading(false);
                return;
            }

            await api.post("/products", {
                name: newProduct.name.trim(),
                warehouse_name: newProduct.warehouse_name.trim(),
                shelf_code: newProduct.shelf_code.trim(),
                category: newProduct.category,
                unit: (newProduct.unit || "pcs").trim(),
                cost_per_unit: cost,
                initial_quantity: initialQty,
                description: newProduct.description?.trim() || undefined
            });

            toast.success("Product added successfully!");
            setNewProduct({
                name: "",
                warehouse_name: "",
                shelf_code: "",
                category: "raw_material",
                unit: "pcs",
                cost_per_unit: "",
                initial_quantity: "",
                description: ""
            });
            setShowAddForm(false);
            fetchProducts();
        } catch (error) {
            const errorMsg = error.response?.data?.error || "Failed to add product.";
            toast.error(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = (p) => {
        setEditingProduct(p);
        setEditData({
            name: p.name,
            sku: p.sku || "",
            description: p.description || "",
            category: p.category === "spare_part" ? "spare_part" : "raw_material",
            unit: p.unit || "pcs",
            cost_per_unit: p.cost_per_unit != null ? String(p.cost_per_unit) : ""
        });
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            const cost = editData.cost_per_unit === "" ? 0 : Number(editData.cost_per_unit);
            if (!Number.isFinite(cost) || cost < 0) {
                toast.error("Unit cost must be a valid non-negative number.");
                return;
            }
            await api.put(`/products/${editingProduct.id}`, {
                name: editData.name.trim(),
                sku: editData.sku.trim(),
                description: editData.description,
                category: editData.category,
                unit: (editData.unit || "pcs").trim(),
                cost_per_unit: cost
            });
            setEditingProduct(null);
            fetchProducts();
            toast.success("Product details updated.");
        } catch {
            toast.error("Failed to update product details.");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure? This will delete the product and all its stock. Proceed?")) return;
        try {
            await api.delete(`/products/${id}`);
            fetchProducts();
            toast.success("Product deleted.");
        } catch {
            toast.error("Delete failed. Product may be in use.");
        }
    };

    const filteredProducts = Array.isArray(products) 
        ? products.filter(p =>
            (p.name && p.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
        )
        : [];


    return (
        <Layout>
            <div style={{ maxWidth: "1250px", margin: "0 auto" }}>
                <header className="flex justify-between align-center mb-3" style={{ flexWrap: "wrap", gap: "1.5rem" }}>
                    <div>
                        <h1 style={{ letterSpacing: "-1.5px" }}>All <span className="text-accent">Products</span></h1>
                        <p className="text-muted" style={{ fontWeight: 600, fontSize: "0.8rem", letterSpacing: "1px" }}>MANAGE ALL PRODUCTS</p>
                    </div>
                    <div className="flex gap-1">
                        <div style={{ position: "relative", width: "320px" }}>
                          <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", opacity: 0.55, color: "var(--text-muted)", display: "flex" }}>
                            <IconSearch size={18} />
                          </span>
                          <input
                              type="text"
                              placeholder="Search products..."
                              style={{ paddingLeft: "44px", height: "3.5rem", borderRadius: "12px", fontSize: "0.9rem" }}
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                          />
                        </div>
                        {!isViewer && (
                            <button onClick={() => setShowAddForm(!showAddForm)} style={{ height: "3.5rem", padding: "0 1.5rem", fontWeight: 800, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                {showAddForm ? "CLOSE FORM" : <><IconPlus size={18} /> NEW ENTRY</>}
                            </button>
                        )}
                    </div>
                </header>

                {showAddForm && (
                    <div className="card mb-2" style={{ borderLeft: "4px solid var(--primary)", padding: "2.5rem", backgroundColor: "white" }}>
                        <h2 style={{ fontSize: "1.25rem", fontWeight: 900, color: "var(--primary)", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.6rem" }}>
                          <span style={{ display: "flex", color: "var(--primary)" }}><IconPackage size={22} /></span>
                          NEW PRODUCT REGISTRATION
                        </h2>
                        <form onSubmit={handleAddProduct}>
                            <div className="grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.5rem", marginBottom: "1.5rem" }}>
                                <div style={{ gridColumn: "span 2" }}>
                                    <label style={{ display: "block", marginBottom: "0.6rem", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", letterSpacing: "1px" }}>PRODUCT NAME</label>
                                    <input type="text" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} placeholder="Enter full item name" required style={{ height: "3.5rem" }} />
                                </div>
                                <div style={{ gridColumn: "span 2" }}>
                                    <label style={{ display: "block", marginBottom: "0.6rem", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", letterSpacing: "1px" }}>PRODUCT DETAILS (OPTIONAL)</label>
                                    <textarea value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} placeholder="Specs, size, supplier notes…" rows={2} style={{ width: "100%", padding: "1rem", resize: "vertical", minHeight: "72px" }} />
                                </div>
                                <div>
                                    <label style={{ display: "block", marginBottom: "0.6rem", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", letterSpacing: "1px" }}>WAREHOUSE</label>
                                    <input type="text" value={newProduct.warehouse_name} onChange={(e) => setNewProduct({ ...newProduct, warehouse_name: e.target.value })} placeholder="e.g. Main Store" required style={{ height: "3.5rem" }} />
                                </div>
                                <div>
                                    <label style={{ display: "block", marginBottom: "0.6rem", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", letterSpacing: "1px" }}>SHELF CODE</label>
                                    <input type="text" value={newProduct.shelf_code} onChange={(e) => setNewProduct({ ...newProduct, shelf_code: e.target.value })} placeholder="e.g. A1-B2" required style={{ height: "3.5rem" }} />
                                </div>
                                <div>
                                    <label style={{ display: "block", marginBottom: "0.6rem", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", letterSpacing: "1px" }}>
                                        QUANTITY (PCS)
                                    </label>
                                    <input type="number" min="0" step="any" value={newProduct.initial_quantity} onChange={(e) => setNewProduct({ ...newProduct, initial_quantity: e.target.value })} placeholder="0" style={{ height: "3.5rem" }} />
                                </div>
                                <div>
                                    <label style={{ display: "block", marginBottom: "0.6rem", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", letterSpacing: "1px" }}>CATEGORY</label>
                                    <select value={newProduct.category} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })} style={{ height: "3.5rem" }}>
                                        <option value="raw_material">RAW MATERIAL</option>
                                        <option value="spare_part">SPARE PART (HARDWARE)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex justify-end mt-1">
                                <button type="submit" disabled={loading} style={{ height: "3.8rem", padding: "0 2.5rem", fontWeight: 900, fontSize: "0.85rem", letterSpacing: "1px" }}>
                                    {loading ? "PROCESSING..." : "REGISTER ASSET"}
                                </button>
                            </div>
                        </form>
                    </div>
                )}


                <div className="card glass-card" style={{ padding: 0, borderRadius: "16px", overflow: "hidden" }}>
                    <div style={{ padding: "1.5rem 2rem", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <h2 style={{ fontSize: "1.1rem", margin: 0 }}>Product List</h2>
                      <p className="text-muted" style={{ fontSize: "0.75rem", fontWeight: 600 }}>{filteredProducts.length} TOTAL PRODUCTS</p>
                    </div>

                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                            <thead style={{ backgroundColor: "rgba(255,255,255,0.02)" }}>
                                <tr>
                                    <th style={{ padding: "1.25rem 2rem", fontSize: "0.65rem", letterSpacing: "1px", color: "var(--text-muted)" }}>PRODUCT NAME</th>
                                    <th style={{ padding: "1.25rem", fontSize: "0.65rem", letterSpacing: "1px", color: "var(--text-muted)" }}>SKU</th>
                                    <th style={{ padding: "1.25rem", fontSize: "0.65rem", letterSpacing: "1px", color: "var(--text-muted)" }}>CATEGORY</th>
                                    <th style={{ padding: "1.25rem", fontSize: "0.65rem", letterSpacing: "1px", color: "var(--text-muted)" }}>UNIT COST</th>
                                    <th style={{ padding: "1.25rem", fontSize: "0.65rem", letterSpacing: "1px", color: "var(--text-muted)" }}>DETAILS</th>
                                    <th style={{ padding: "1.25rem 2rem", textAlign: "right" }}>CONTROL</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && products.length === 0 ? (
                                    <tr><td colSpan="6" style={{ textAlign: "center", padding: "4rem" }}>LOADING PRODUCT DATA...</td></tr>
                                ) : filteredProducts.length > 0 ? (
                                    filteredProducts.map((p) => (
                                        <tr key={p.id}>
                                            <td style={{ padding: "1.25rem 2rem", fontWeight: 800, color: "var(--primary)", fontSize: "1rem" }}>{p.name}</td>
                                            <td style={{ padding: "1.25rem" }}>
                                                <code style={{ background: "rgba(0,0,0,0.05)", padding: "0.25rem 0.6rem", borderRadius: "4px", fontSize: "0.8rem", color: "var(--primary)", fontWeight: 700 }}>{p.sku}</code>
                                            </td>
                                            <td style={{ padding: "1.25rem" }}>
                                                <span style={{ 
                                                    padding: "0.25rem 0.6rem", borderRadius: "20px", fontSize: "0.65rem", fontWeight: 800,
                                                    backgroundColor: p.category === "spare_part" ? "rgba(99, 102, 241, 0.1)" : "rgba(16, 185, 129, 0.1)",
                                                    color: p.category === "spare_part" ? "#6366f1" : "var(--success)",
                                                    border: `1px solid ${p.category === "spare_part" ? "#6366f1" : "var(--success)"}`
                                                }}>{(p.category || "raw_material").replace(/_/g, " ").toUpperCase()}</span>
                                            </td>
                                            <td style={{ padding: "1.25rem", fontWeight: 700 }}>{formatCurrency(p.cost_per_unit, user?.company)} / {p.unit || 'pcs'}</td>
                                            <td className="text-muted" style={{ padding: "1.25rem", fontSize: "0.85rem", fontWeight: 500 }}>{p.description || "No details provided."}</td>
                                            <td style={{ padding: "1.25rem 2rem", textAlign: "right" }}>
                                                {!isViewer && (
                                                    <div className="flex gap-1 justify-end">
                                                        {/* Admin & Super Admin: UPDATE (Redirect to stock update) + SPECS (Edit Modal) */}
                                                        {(role === "admin" || role === "super_admin") && (
                                                            <>
                                                                <button 
                                                                    className="btn-sm" 
                                                                    onClick={() => navigate(`/admin/stock/updates?product_id=${p.id}`)}
                                                                    style={{ background: "var(--primary)", color: "white", fontWeight: 800 }}
                                                                >
                                                                    UPDATE
                                                                </button>
                                                                <button className="btn-sm" onClick={() => handleEditClick(p)} style={{ background: "rgba(255,255,255,0.05)", fontWeight: 800, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                                                    <IconSettings size={14} /> SPECS
                                                                </button>
                                                            </>
                                                        )}

                                                        {/* Admin: Only DELETE */}
                                                        {(role === "admin" || role === "super_admin") && (
                                                            <button className="btn-sm" onClick={() => handleDelete(p.id)} style={{ background: "rgba(225, 29, 72, 0.1)", color: "var(--accent)", fontWeight: 800, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                                                <IconTrash size={14} /> DELETE
                                                            </button>
                                                        )}
                                                        
                                                        {/* Regular User: Only SPECS */}
                                                        {role === "user" && (
                                                            <button className="btn-sm" onClick={() => handleEditClick(p)} style={{ background: "rgba(255,255,255,0.05)", fontWeight: 800, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                                                <IconSettings size={14} /> SPECS
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan="6" style={{ textAlign: "center", padding: "4rem" }} className="text-muted">NO PRODUCTS FOUND.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {editingProduct && (
                <div style={{
                    position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.85)",
                    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(6px)"
                }}>
                    <div className="card" style={{ width: "100%", maxWidth: "460px", padding: "3rem", backgroundColor: "white" }}>
                        <h2 style={{ letterSpacing: "-1px", fontSize: "1.25rem", marginBottom: "1.5rem", color: "var(--primary)" }}>Edit <span className="text-accent">Product</span></h2>
                        <form onSubmit={handleUpdate} className="flex flex-column gap-1">
                            <div>
                                <label style={{ display: "block", marginBottom: "0.6rem", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)" }}>SKU</label>
                                <input type="text" value={editData.sku} onChange={(e) => setEditData({ ...editData, sku: e.target.value })} required style={{ height: "3.5rem", fontFamily: "monospace" }} />
                            </div>
                            <div>
                                <label style={{ display: "block", marginBottom: "0.6rem", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)" }}>PRODUCT NAME</label>
                                <input type="text" value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} required style={{ height: "3.5rem" }} />
                            </div>
                             <div>
                                <label style={{ display: "block", marginBottom: "0.6rem", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)" }}>PRODUCT DETAILS</label>
                                <textarea value={editData.description} onChange={(e) => setEditData({ ...editData, description: e.target.value })} style={{ height: "80px", resize: "none", padding: "1rem" }} placeholder="Enter product details..." />
                            </div>
                            <div className="flex gap-1">
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: "block", marginBottom: "0.6rem", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)" }}>CATEGORY</label>
                                    <select value={editData.category} onChange={(e) => setEditData({ ...editData, category: e.target.value })} style={{ height: "3.5rem" }}>
                                        <option value="raw_material">RAW MATERIAL</option>
                                        <option value="spare_part">SPARE PART (HARDWARE)</option>
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: "block", marginBottom: "0.6rem", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)" }}>UNIT</label>
                                    <input type="text" value={editData.unit} onChange={(e) => setEditData({ ...editData, unit: e.target.value })} style={{ height: "3.5rem" }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: "block", marginBottom: "0.6rem", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)" }}>COST / UNIT ({getCurrencySymbol(user?.company)})</label>
                                    <input type="number" min="0" step="0.01" value={editData.cost_per_unit} onChange={(e) => setEditData({ ...editData, cost_per_unit: e.target.value })} style={{ height: "3.5rem" }} />
                                </div>
                            </div>
                            <div className="flex gap-1 justify-end mt-2">
                                <button type="button" onClick={() => setEditingProduct(null)} style={{ flex: 1, backgroundColor: "#334155", color: "white" }}>CANCEL</button>
                                <button type="submit" style={{ flex: 1, backgroundColor: "var(--primary)", color: "white" }}>SAVE CHANGES</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </Layout>
    );
};

export default AdminProducts;
