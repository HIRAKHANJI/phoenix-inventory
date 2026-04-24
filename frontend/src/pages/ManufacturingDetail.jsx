import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import api from "../api/axios";
import { toast } from "react-hot-toast";

const STATUS_META = {
  not_started: { label: "Not Started", color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
  active:      { label: "Active",      color: "#2563eb", bg: "rgba(37,99,235,0.12)" },
  closed:      { label: "Closed",      color: "#16a34a", bg: "rgba(22,163,74,0.12)" },
};

const ALLOWED_TRANSITIONS = {
  not_started: ["active"],
  active: ["closed"],
  closed: [],
};

const ManufacturingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  // Add item form
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [qtyInput, setQtyInput] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  // Edit BOM item inline
  const [editingBomId, setEditingBomId] = useState(null);
  const [editQty, setEditQty] = useState("");

  // Status
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // PDF
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const fetchProject = useCallback(async () => {
    try {
      const res = await api.get(`/manufacturing/${id}`);
      setProject(res.data.data);
    } catch {
      toast.error("Failed to load project.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  // Debounced search
  useEffect(() => {
    if (!searchTerm.trim()) { setSearchResults([]); setShowDropdown(false); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/inventory-items/search?q=${encodeURIComponent(searchTerm)}`);
        setSearchResults(res.data.data || []);
        setShowDropdown(true);
      } catch { /* silent */ }
    }, 300);
  }, [searchTerm]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setShowDropdown(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectSearchItem = (item) => {
    setSelectedItem(item);
    setSearchTerm(item.name);
    setShowDropdown(false);
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!selectedItem) { toast.error("Select an item from the search dropdown."); return; }
    if (!qtyInput || parseFloat(qtyInput) <= 0) { toast.error("Enter a valid quantity."); return; }
    setAddingItem(true);
    try {
      await api.post(`/manufacturing/${id}/items`, {
        inventory_item_id: selectedItem.id,
        quantity_used: parseFloat(qtyInput),
      });
      toast.success(`${selectedItem.name} added to project.`);
      setSearchTerm(""); setSelectedItem(null); setQtyInput("");
      fetchProject();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add item.");
    } finally {
      setAddingItem(false);
    }
  };

  const handleUpdateBomItem = async (bomItem) => {
    if (!editQty || parseFloat(editQty) <= 0) { toast.error("Enter a valid quantity."); return; }
    try {
      await api.put(`/manufacturing/${id}/items/${bomItem.id}`, { quantity_used: parseFloat(editQty) });
      toast.success("Item updated.");
      setEditingBomId(null);
      fetchProject();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update item.");
    }
  };

  const handleRemoveBomItem = async (bomItem) => {
    if (!window.confirm(`Remove "${bomItem.item_name}" and restore stock?`)) return;
    try {
      await api.delete(`/manufacturing/${id}/items/${bomItem.id}`);
      toast.success(`${bomItem.item_name} removed. Stock restored.`);
      fetchProject();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove item.");
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!window.confirm(`Change status to "${newStatus.replace("_", " ")}"? ${newStatus === "closed" ? "This is permanent and will LOCK the project." : ""}`)) return;
    setUpdatingStatus(true);
    try {
      await api.put(`/manufacturing/${id}/status`, { status: newStatus });
      toast.success(`Status updated to ${newStatus.replace("_", " ")}.`);
      fetchProject();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update status.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const res = await api.get(`/manufacturing/${id}/report`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `inpack-report-${id}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Report downloaded.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to generate report.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) return <Layout><div className="card" style={{ textAlign: "center", padding: "4rem" }}><p className="text-muted">Loading project...</p></div></Layout>;
  if (!project) return <Layout><div className="card" style={{ textAlign: "center", padding: "4rem" }}><p className="text-muted">Project not found.</p></div></Layout>;

  const meta = STATUS_META[project.status] || STATUS_META.not_started;
  const isClosed = project.status === "closed";
  const nextStatuses = ALLOWED_TRANSITIONS[project.status] || [];

  return (
    <Layout>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>

        {/* ── Header */}
        <header className="flex justify-between align-center mb-2" style={{ flexWrap: "wrap", gap: "1rem" }}>
          <div className="flex align-center gap-1">
            <button onClick={() => navigate("/admin/manufacturing")} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: "10px", padding: "0.5rem 1rem", cursor: "pointer", color: "var(--text-muted)", fontWeight: 700, fontSize: "0.8rem" }}>
              ← Back
            </button>
            <div>
              <div className="flex align-center gap-1">
                <h1 style={{ fontSize: "1.5rem" }}>{project.machine_name}</h1>
                <span style={{ padding: "0.25rem 0.75rem", borderRadius: "20px", fontSize: "0.72rem", fontWeight: 800, color: meta.color, background: meta.bg, border: `1px solid ${meta.color}` }}>
                  {meta.label.toUpperCase()}
                </span>
              </div>
              <p className="text-muted" style={{ fontSize: "0.85rem" }}>
                Created {new Date(project.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
          </div>
          {project.status === "closed" && (
            <button onClick={handleDownloadPdf} disabled={downloadingPdf} style={{ background: "var(--primary)", color: "white", border: "none", borderRadius: "12px", padding: "0.75rem 1.5rem", fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 15px rgba(10,36,99,0.25)" }}>
              {downloadingPdf ? "Generating..." : "⤓ Download Report"}
            </button>
          )}
        </header>

        {/* ── Info + Status row */}
        <div className="flex gap-1 mb-2" style={{ flexWrap: "wrap" }}>
          {/* Notes card */}
          <div className="card" style={{ flex: 2, minWidth: "280px" }}>
            <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: "0.5rem" }}>NOTES</p>
            <p style={{ lineHeight: 1.6 }}>{project.note || <span className="text-muted">No notes.</span>}</p>
          </div>

          {/* Total cost card */}
          <div className="card" style={{ flex: 1, minWidth: "200px", textAlign: "center", borderLeft: "4px solid var(--primary)" }}>
            <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: "0.5rem" }}>TOTAL PROJECT COST</p>
            <p style={{ fontSize: "2rem", fontWeight: 900, color: "var(--primary)" }}>
              ₹ {parseFloat(project.total_cost || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Status panel */}
          {!isClosed && nextStatuses.length > 0 && (
            <div className="card" style={{ flex: 1, minWidth: "200px" }}>
              <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: "0.75rem" }}>UPDATE STATUS</p>
              {nextStatuses.map(s => {
                const m = STATUS_META[s];
                return (
                  <button key={s} onClick={() => handleStatusChange(s)} disabled={updatingStatus}
                    style={{ width: "100%", padding: "0.65rem", border: `1px solid ${m.color}`, background: m.bg, color: m.color, borderRadius: "10px", fontWeight: 800, cursor: "pointer", fontSize: "0.82rem" }}>
                    {updatingStatus ? "Updating..." : `→ Mark as ${m.label}`}
                  </button>
                );
              })}
            </div>
          )}

          {isClosed && (
            <div className="card" style={{ flex: 1, minWidth: "200px", textAlign: "center", borderLeft: "4px solid #16a34a" }}>
              <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#16a34a", marginBottom: "0.5rem" }}>🔒 PROJECT CLOSED</p>
              <p className="text-muted" style={{ fontSize: "0.82rem" }}>This project is locked. Download the PDF report above.</p>
            </div>
          )}
        </div>

        {/* ── Add Item Section */}
        {!isClosed && (
          <div className="card mb-2" style={{ borderLeft: "4px solid var(--primary)" }}>
            <h2 style={{ marginBottom: "1rem" }}>Add Item to Project</h2>
            <form onSubmit={handleAddItem}>
              <div className="flex gap-1 align-center" style={{ flexWrap: "wrap" }}>
                {/* Search */}
                <div style={{ flex: 2, minWidth: "240px", position: "relative" }} ref={searchRef}>
                  <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>SEARCH INVENTORY ITEM</label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => { setSearchTerm(e.target.value); setSelectedItem(null); }}
                    placeholder="Type item name..."
                  />
                  {showDropdown && searchResults.length > 0 && (
                    <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "white", border: "1px solid var(--border)", borderRadius: "12px", boxShadow: "0 8px 30px rgba(0,0,0,0.12)", zIndex: 200, overflow: "hidden" }}>
                      {searchResults.map(item => (
                        <div key={item.id} onMouseDown={() => selectSearchItem(item)}
                          style={{ padding: "0.75rem 1rem", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", transition: "background 0.15s" }}
                          onMouseEnter={e => e.currentTarget.style.background = "var(--bg-main)"}
                          onMouseLeave={e => e.currentTarget.style.background = "white"}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>{item.name}</div>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{item.category === "spare_part" ? "Spare Part" : "Raw Material"} · {item.unit} · ₹{parseFloat(item.cost_per_unit).toFixed(2)}/unit</div>
                          </div>
                          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: parseFloat(item.quantity) < 10 ? "var(--accent)" : "var(--success)" }}>
                            {parseFloat(item.quantity)} {item.unit} avail.
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {showDropdown && searchResults.length === 0 && searchTerm.trim() && (
                    <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "white", border: "1px solid var(--border)", borderRadius: "12px", padding: "1rem", zIndex: 200, textAlign: "center" }} className="text-muted">
                      No items found.
                    </div>
                  )}
                </div>

                {/* Quantity */}
                <div style={{ flex: 1, minWidth: "140px" }}>
                  <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>
                    QUANTITY {selectedItem ? `(${selectedItem.unit})` : ""}
                  </label>
                  <input
                    type="number" min="0.01" step="0.01"
                    value={qtyInput}
                    onChange={e => setQtyInput(e.target.value)}
                    placeholder="0"
                    max={selectedItem ? selectedItem.quantity : undefined}
                  />
                </div>

                {/* Selected preview */}
                {selectedItem && (
                  <div style={{ padding: "0.5rem 1rem", background: "rgba(10,36,99,0.06)", borderRadius: "10px", fontSize: "0.8rem" }}>
                    <div style={{ fontWeight: 700 }}>{selectedItem.name}</div>
                    <div className="text-muted">₹{parseFloat(selectedItem.cost_per_unit).toFixed(2)}/unit · {parseFloat(selectedItem.quantity)} avail.</div>
                    {qtyInput && <div style={{ fontWeight: 800, color: "var(--primary)", marginTop: "0.25rem" }}>Cost: ₹ {(parseFloat(qtyInput) * parseFloat(selectedItem.cost_per_unit)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>}
                  </div>
                )}

                <div style={{ alignSelf: "flex-end" }}>
                  <button type="submit" disabled={addingItem || !selectedItem} style={{ padding: "0.75rem 1.5rem" }}>
                    {addingItem ? "Adding..." : "Add to Project"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* ── Bill of Materials Table */}
        <div className="card">
          <div className="flex justify-between align-center mb-2">
            <h2>Bill of Materials</h2>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, background: "var(--bg-main)", padding: "0.3rem 0.8rem", borderRadius: "20px" }}>
              {project.items?.length || 0} items
            </span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item Name</th>
                  <th>Category</th>
                  <th style={{ textAlign: "right" }}>Qty Used</th>
                  <th style={{ textAlign: "right" }}>Cost / Unit</th>
                  <th style={{ textAlign: "right" }}>Total Cost</th>
                  {!isClosed && <th style={{ textAlign: "right" }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {!project.items || project.items.length === 0 ? (
                  <tr><td colSpan={isClosed ? 6 : 7} style={{ textAlign: "center", padding: "3rem" }} className="text-muted">
                    No items added yet.
                  </td></tr>
                ) : project.items.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="text-muted" style={{ fontSize: "0.8rem" }}>{idx + 1}</td>
                    <td style={{ fontWeight: 700 }}>{item.item_name}</td>
                    <td>
                      <span style={{ padding: "0.2rem 0.5rem", borderRadius: "15px", fontSize: "0.7rem", fontWeight: 700,
                        background: item.category === "spare_part" ? "rgba(99,102,241,0.1)" : "rgba(16,185,129,0.1)",
                        color: item.category === "spare_part" ? "#6366f1" : "var(--success)" }}>
                        {item.category === "spare_part" ? "Spare Part" : "Raw Material"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {editingBomId === item.id ? (
                        <input type="number" min="0.01" step="0.01" value={editQty} onChange={e => setEditQty(e.target.value)}
                          style={{ width: "90px", textAlign: "right", padding: "0.3rem 0.5rem" }} autoFocus />
                      ) : (
                        <span style={{ fontWeight: 700 }}>{parseFloat(item.quantity_used).toLocaleString("en-IN")} {item.unit}</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>₹ {parseFloat(item.cost_per_unit).toFixed(2)}</td>
                    <td style={{ textAlign: "right", fontWeight: 800, color: "var(--primary)" }}>
                      ₹ {parseFloat(item.cost).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    {!isClosed && (
                      <td style={{ textAlign: "right" }}>
                        <div className="flex justify-end gap-1">
                          {editingBomId === item.id ? (
                            <>
                              <button onClick={() => handleUpdateBomItem(item)} style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", background: "var(--success)", color: "white", border: "none", borderRadius: "7px", cursor: "pointer" }}>Save</button>
                              <button onClick={() => setEditingBomId(null)} style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", background: "#888", color: "white", border: "none", borderRadius: "7px", cursor: "pointer" }}>Cancel</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => { setEditingBomId(item.id); setEditQty(item.quantity_used); }} style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", background: "var(--primary)", color: "white", border: "none", borderRadius: "7px", cursor: "pointer" }}>Edit</button>
                              <button onClick={() => handleRemoveBomItem(item)} style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", background: "var(--accent)", color: "white", border: "none", borderRadius: "7px", cursor: "pointer" }}>Remove</button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Grand Total Footer */}
          {project.items && project.items.length > 0 && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem", paddingTop: "1rem", borderTop: "2px solid var(--border)" }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: "0.25rem" }}>GRAND TOTAL</div>
                <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "var(--primary)" }}>
                  ₹ {parseFloat(project.total_cost || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ManufacturingDetail;
