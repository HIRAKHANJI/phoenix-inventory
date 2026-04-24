import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import api from "../api/axios";
import { toast } from "react-hot-toast";

const CATEGORIES = [
  { value: "spare_part", label: "Spare Part" },
  { value: "raw_material", label: "Raw Material" },
];

const EMPTY_FORM = { name: "", category: "spare_part", quantity: "", unit: "pcs", cost_per_unit: "" };

const InventoryItems = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null); // null = create mode
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchItems = async () => {
    try {
      const res = await api.get("/inventory-items");
      setItems(res.data.data || []);
    } catch {
      toast.error("Failed to load inventory items.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (item) => {
    setEditing(item);
    setForm({ name: item.name, category: item.category, quantity: item.quantity, unit: item.unit, cost_per_unit: item.cost_per_unit });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/inventory-items/${editing.id}`, form);
        toast.success("Item updated.");
      } else {
        await api.post("/inventory-items", form);
        toast.success("Item created.");
      }
      setShowModal(false);
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save item.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/inventory-items/${item.id}`);
      toast.success("Item deleted.");
      fetchItems();
    } catch {
      toast.error("Failed to delete item.");
    }
  };

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.category.includes(search.toLowerCase())
  );

  const categoryStyle = (cat) => cat === "spare_part"
    ? { background: "rgba(99,102,241,0.1)", color: "#6366f1", border: "1px solid #6366f1" }
    : { background: "rgba(16,185,129,0.1)", color: "var(--success)", border: "1px solid var(--success)" };

  return (
    <Layout>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <header className="flex justify-between align-center mb-2" style={{ flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1>Inventory <span className="text-red">Items</span></h1>
            <p className="text-muted">Manage raw materials and spare parts used in manufacturing.</p>
          </div>
          <div className="flex gap-1 align-center" style={{ flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Search items..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: "220px" }}
            />
            <button onClick={openCreate}>+ New Item</button>
          </div>
        </header>

        <div className="card">
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th style={{ textAlign: "right" }}>Quantity</th>
                  <th style={{ textAlign: "right" }}>Cost / Unit (₹)</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" style={{ textAlign: "center", padding: "3rem" }}>Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan="7" style={{ textAlign: "center", padding: "3rem" }} className="text-muted">No items found.</td></tr>
                ) : filtered.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="text-muted" style={{ fontSize: "0.8rem" }}>{idx + 1}</td>
                    <td style={{ fontWeight: 700 }}>{item.name}</td>
                    <td>
                      <span style={{ padding: "0.25rem 0.6rem", borderRadius: "20px", fontSize: "0.72rem", fontWeight: 700, ...categoryStyle(item.category) }}>
                        {item.category === "spare_part" ? "Spare Part" : "Raw Material"}
                      </span>
                    </td>
                    <td>{item.unit}</td>
                    <td style={{ textAlign: "right", fontWeight: 800, color: item.quantity < 10 ? "var(--accent)" : "inherit" }}>
                      {parseFloat(item.quantity).toLocaleString("en-IN")}
                    </td>
                    <td style={{ textAlign: "right" }}>₹ {parseFloat(item.cost_per_unit).toFixed(2)}</td>
                    <td style={{ textAlign: "right" }}>
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(item)} style={{ padding: "0.3rem 0.75rem", fontSize: "0.78rem", background: "var(--primary)", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}>Edit</button>
                        <button onClick={() => handleDelete(item)} style={{ padding: "0.3rem 0.75rem", fontSize: "0.78rem", background: "var(--accent)", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
          <div className="card" style={{ width: "100%", maxWidth: "480px" }}>
            <h2 className="mb-2">{editing ? "Edit Item" : "New Inventory Item"}</h2>
            <form onSubmit={handleSave} className="flex flex-column gap-1">
              <div>
                <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)" }}>ITEM NAME</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Steel Rod" />
              </div>
              <div className="flex gap-1">
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)" }}>CATEGORY</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)" }}>UNIT</label>
                  <input type="text" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="pcs, kg, liters" />
                </div>
              </div>
              <div className="flex gap-1">
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)" }}>QUANTITY</label>
                  <input type="number" min="0" step="0.01" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} placeholder="0" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)" }}>COST / UNIT (₹)</label>
                  <input type="number" min="0" step="0.01" value={form.cost_per_unit} onChange={e => setForm({ ...form, cost_per_unit: e.target.value })} placeholder="0.00" />
                </div>
              </div>
              <div className="flex gap-1 justify-end" style={{ marginTop: "0.5rem" }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ background: "#888", color: "white", border: "none", borderRadius: "10px", padding: "0.7rem 1.25rem", cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={saving}>{saving ? "Saving..." : editing ? "Update Item" : "Create Item"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default InventoryItems;
