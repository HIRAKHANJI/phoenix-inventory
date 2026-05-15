import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import api from "../api/axios";
import { toast } from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { getCurrencySymbol, formatCurrency } from "../utils/currency";

const STATUS_META = {
  not_started: { label: "Not Started", color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
  active:      { label: "Active",      color: "#2563eb", bg: "rgba(37,99,235,0.12)" },
  closed:      { label: "Closed",      color: "#16a34a", bg: "rgba(22,163,74,0.12)" },
};

const ALLOWED_TRANSITIONS = {
  not_started: ["active", "closed"],
  active:      ["not_started", "closed"],
  closed:      ["active", "not_started"],
};

const ManufacturingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  // Add item form
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [qtyInput, setQtyInput] = useState("");
  const [costInput, setCostInput] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  // Edit BOM item inline
  const [editingBomId, setEditingBomId] = useState(null);
  const [editQty, setEditQty] = useState("");
  const [editCost, setEditCost] = useState("");

  // Status
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // PDF
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Edit Project Info
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ machine_name: "", note: "", budget: "" });
  const [savingProject, setSavingProject] = useState(false);


  const fetchProject = useCallback(async () => {
    try {
      const res = await api.get(`/manufacturing/${id}`);
      const data = res.data.data;
      if (!data) throw new Error("Project data missing");
      setProject(data);
      setEditForm({ 
        machine_name: data.machine_name, 
        note: data.note || "", 
        budget: data.budget || "" 
      });
    } catch (err) {
      toast.error("Project identity could not be verified in the production matrix.");
      navigate("/admin/manufacturing");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  const handleUpdateProject = async (e) => {
    e.preventDefault();
    setSavingProject(true);
    try {
      await api.put(`/manufacturing/${id}`, editForm);
      toast.success("Project updated.");
      setShowEditModal(false);
      fetchProject();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update project.");
    } finally {
      setSavingProject(false);
    }
  };

  // Debounced search
  useEffect(() => {
    if (!searchTerm.trim()) { setSearchResults([]); setShowDropdown(false); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
       if (searchTerm && !selectedItem) {
        api.get(`/inventory-items/search?q=${encodeURIComponent(searchTerm)}`)
          .then(res => {
            setSearchResults(res.data.data || []);
            setShowDropdown(true);
          })
          .catch(() => {
            setSearchResults([]);
            setShowDropdown(false);
          });
      } else {
        setShowDropdown(false);
      }
    }, 300);
  }, [searchTerm, selectedItem]);

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
    if (item.cost_per_unit) setCostInput(item.cost_per_unit);
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!selectedItem) { toast.error("Select an item from the search dropdown."); return; }
    if (!qtyInput || parseFloat(qtyInput) <= 0) { toast.error("Enter a valid quantity."); return; }
    setAddingItem(true);
    try {
      await api.post(`/manufacturing/${id}/items`, {
        product_id: selectedItem.id,
        quantity_used: parseFloat(qtyInput),
        cost: parseFloat(costInput) || 0,
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
      await api.put(`/manufacturing/${id}/items/${bomItem.id}`, { 
        quantity_used: parseFloat(editQty),
        cost: parseFloat(editCost) || 0,
      });
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
    if (!window.confirm(`Change project status to "${newStatus.replace("_", " ")}"?`)) return;
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
  const nextStatuses = Object.keys(STATUS_META).filter(s => s !== project.status);
  const isClosed = project.status === 'closed';
  const hasAccess = user?.role === 'admin' || user?.role === 'super_admin' || project.created_by === user?.id;

  return (
    <Layout>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem" }}>

        {/* ── Top Navigation & Title ── */}
        <header className="flex justify-between align-center mb-3" style={{ flexWrap: "wrap", gap: "1.5rem" }}>
          <div className="flex align-center gap-1-5">
            <button 
              onClick={() => navigate("/admin/manufacturing")} 
              className="btn-icon-back"
              style={{ 
                background: "white", 
                border: "1px solid rgba(10,36,99,0.1)", 
                borderRadius: "14px", 
                width: "45px", 
                height: "45px", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(0,0,0,0.03)"
              }}
            >
              ←
            </button>
            <div>
              <div className="flex align-center gap-1" style={{ flexWrap: "wrap" }}>
                <h1 style={{ fontSize: "2.2rem", fontWeight: 900, letterSpacing: "-1.5px" }}>{project.machine_name}</h1>
                {(user?.role === 'admin' || user?.role === 'super_admin' || project.created_by === user?.id) && (
                  <button onClick={() => setShowEditModal(true)} style={{ background: "rgba(10,36,99,0.04)", border: "none", cursor: "pointer", fontSize: "1rem", padding: "0.5rem", borderRadius: "10px", transition: "0.2s" }} title="Edit Machine Info">
                    ✏️
                  </button>
                )}
                <div style={{ 
                  padding: "0.4rem 1.2rem", 
                  borderRadius: "14px", 
                  fontSize: "0.75rem", 
                  fontWeight: 900, 
                  color: meta.color, 
                  background: meta.bg, 
                  border: `1px solid ${meta.color}22`,
                  letterSpacing: "1px"
                }}>
                  {meta.label.toUpperCase()}
                </div>
              </div>
              <p className="text-muted" style={{ fontSize: "0.9rem", marginTop: "0.4rem", fontWeight: 500 }}>
                Project Manifest • Initialized by <b>{project.creator_name || "System"}</b> on {new Date(project.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
          </div>

          {(project.items?.length > 0) && (
            <button 
              onClick={handleDownloadPdf} 
              disabled={downloadingPdf} 
              style={{ 
                background: "linear-gradient(135deg, var(--primary) 0%, #1e40af 100%)", 
                color: "white", 
                padding: "1rem 2rem", 
                borderRadius: "18px", 
                fontWeight: 800,
                boxShadow: "0 15px 35px rgba(37,99,235,0.25)",
                border: "none",
                cursor: downloadingPdf ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                fontSize: "0.85rem",
                letterSpacing: "0.5px"
              }}
            >
              {downloadingPdf ? "⏳ Generating..." : "⤓ DOWNLOAD PDF REPORT"}
            </button>
          )}
        </header>

        {/* ── Summary Matrix ── */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", 
          gap: "1.5rem", 
          marginBottom: "2.5rem" 
        }}>
          {/* Notes Segment */}
          <div className="card glass-card-premium" style={{ borderLeft: "6px solid #cbd5e1" }}>
            <p className="label-sm">OPERATIONAL PROTOCOL</p>
            <p style={{ fontSize: "1rem", lineHeight: 1.7, color: "var(--text-main)" }}>
              {project.note || <span className="text-muted italic">No specific operational notes recorded for this run.</span>}
            </p>
          </div>

          {/* Budget Segment */}
          <div className="card glass-card-premium" style={{ borderLeft: "6px solid #3b82f6" }}>
            <p className="label-sm">BUDGET ALLOCATION</p>
            <p style={{ fontSize: "1.8rem", fontWeight: 900, color: "var(--primary)" }}>
              {formatCurrency(project.budget, user?.company)}
            </p>
          </div>

          {/* Status Segment */}
          <div className="card glass-card-premium" style={{ borderLeft: `6px solid ${meta.color}` }}>
            <p className="label-sm">LIFECYCLE CONTROL</p>
            <div style={{ marginTop: "1rem" }}>
              {(user?.role === 'admin' || user?.role === 'super_admin' || project.created_by === user?.id) ? (
                nextStatuses.map(s => {
                  const m = STATUS_META[s];
                  return (
                    <button key={s} onClick={() => handleStatusChange(s)} disabled={updatingStatus}
                      className="btn-status-transition"
                      style={{ background: m.bg, color: m.color, border: `1px solid ${m.color}33`, marginRight: "0.5rem", marginBottom: "0.5rem" }}>
                      {updatingStatus ? "Processing..." : `SET TO ${m.label.toUpperCase()}`}
                    </button>
                  );
                })
              ) : (
                <p className="text-muted italic" style={{ fontSize: "0.9rem" }}>Only the creator or an admin can transition status.</p>
              )}
            </div>
          </div>
        </div>

        {/* ── BOM Management Segment ── */}
        <div style={{ display: "grid", gridTemplateColumns: (!(user?.role === 'admin' || user?.role === 'super_admin' || project.created_by === user?.id)) ? "1fr" : "minmax(0, 400px) 1fr", gap: "2rem", alignItems: "start" }}>
          
          {/* Add Item Form (Only if user has access) */}
          {hasAccess && (
            <div className="card" style={{ padding: "2.5rem", borderRadius: "28px", background: "white", position: "sticky", top: "2rem", opacity: isClosed ? 0.6 : 1 }}>
              <div className="flex justify-between align-center mb-1-5">
                <h2 style={{ fontSize: "1.4rem", fontWeight: 900, letterSpacing: "-0.5px" }}>Resource Depletion</h2>
                {isClosed && <span style={{ fontSize: "0.65rem", fontWeight: 900, color: "var(--accent)", background: "rgba(225,29,72,0.1)", padding: "0.3rem 0.8rem", borderRadius: "8px" }}>LOCKED</span>}
              </div>
              
              {isClosed ? (
                <div style={{ padding: "1rem", borderRadius: "14px", background: "rgba(0,0,0,0.03)", border: "1px dashed rgba(0,0,0,0.1)", marginBottom: "1.5rem" }}>
                  <p className="text-muted" style={{ fontSize: "0.85rem", fontWeight: 600 }}>This project is closed. Re-open it to add resources.</p>
                </div>
              ) : null}

              <form onSubmit={handleAddItem} className="flex flex-column gap-1-5" style={{ pointerEvents: isClosed ? "none" : "auto" }}>
                <div style={{ position: "relative" }} ref={searchRef}>
                  <label className="label-sm">SELECT INVENTORY ASSET</label>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: "15px", top: "50%", transform: "translateY(-50%)", opacity: 0.4 }}>🔍</span>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={e => { setSearchTerm(e.target.value); setSelectedItem(null); }}
                      placeholder="Search catalog..."
                      style={{ paddingLeft: "45px", borderRadius: "14px", height: "3.5rem" }}
                    />
                  </div>
                  {showDropdown && (
                    <div className="search-dropdown animate-fade-in">
                      {searchResults.length > 0 ? searchResults.map(item => (
                        <div key={item.id} onMouseDown={() => selectSearchItem(item)} className="search-item">
                          <div>
                            <div className="search-item-title">{item.name}</div>
                            <div className="search-item-meta">{item.category === "spare_part" ? "Spare Part" : "Raw Material"} • {item.unit}</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontWeight: 800, color: parseFloat(item.quantity) < 20 ? "var(--accent)" : "var(--success)" }}>{parseFloat(item.quantity)} {item.unit}</div>
                            <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)" }}>AVAILABLE</div>
                          </div>
                        </div>
                      )) : searchTerm.trim() && (
                        <div style={{ padding: "2rem", textAlign: "center" }} className="text-muted">No assets match your search.</div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="label-sm">DEPLETION QUANTITY {selectedItem ? `(${selectedItem.unit})` : ""}</label>
                  <input
                    type="number" min="0.01" step="0.01"
                    value={qtyInput}
                    onChange={e => setQtyInput(e.target.value)}
                    placeholder="Enter units used..."
                    disabled={!selectedItem}
                    style={{ borderRadius: "14px", height: "3.5rem" }}
                  />
                </div>

                <div>
                  <label className="label-sm">UNIT COST ({getCurrencySymbol(user?.company)})</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={costInput}
                    onChange={e => setCostInput(e.target.value)}
                    placeholder="Enter cost per unit..."
                    disabled={!selectedItem}
                    style={{ borderRadius: "14px", height: "3.5rem" }}
                  />
                </div>
                <button type="submit" disabled={addingItem || !selectedItem} style={{ height: "4rem", borderRadius: "18px", fontWeight: 900, marginTop: "0.5rem" }}>
                  {addingItem ? "Depleting Stock..." : "ADD TO BILL OF MATERIALS"}
                </button>
              </form>
            </div>
          )}

          {/* BOM Table */}
          <div className="card" style={{ padding: "2.5rem", borderRadius: "28px", background: "white" }}>
            <div className="flex justify-between align-center mb-2">
              <h2 style={{ fontSize: "1.4rem", fontWeight: 900, letterSpacing: "-0.5px" }}>Bill of Materials</h2>
              <span style={{ fontSize: "0.75rem", fontWeight: 800, background: "rgba(10,36,99,0.04)", padding: "0.4rem 1rem", borderRadius: "12px", color: "var(--primary)" }}>
                {project.items?.length || 0} RESOURCES REGISTERED
              </span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="bom-table">
                <thead>
                  <tr>
                    <th>ASSET IDENTITY</th>
                    <th style={{ textAlign: "center" }}>UNIT</th>
                    <th style={{ textAlign: "right" }}>QTY USED</th>
                    <th style={{ textAlign: "right" }}>UNIT COST</th>
                    <th style={{ textAlign: "right" }}>AMOUNT</th>
                    {(user?.role === 'admin' || user?.role === 'super_admin' || project.created_by === user?.id) && <th style={{ textAlign: "center" }}>CONTROLS</th>}
                  </tr>
                </thead>
                <tbody>
                  {!project.items || project.items.length === 0 ? (
                    <tr>
                      <td colSpan={(user?.role === 'admin' || user?.role === 'super_admin' || project.created_by === user?.id) ? 6 : 5} style={{ textAlign: "center", padding: "5rem" }}>
                        <div style={{ fontSize: "3rem", marginBottom: "1rem", opacity: 0.2 }}>📦</div>
                        <p className="text-muted" style={{ fontWeight: 600 }}>No materials registered for this project run.</p>
                      </td>
                    </tr>
                  ) : project.items.map((item) => {
                    const qty    = parseFloat(item.quantity_used) || 0;
                    const cost   = parseFloat(item.cost)          || 0;
                    const amount = qty * cost;
                    return (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--text-main)" }}>{item.item_name}</div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginTop: "0.2rem" }}>
                          {item.category?.replace('_', ' ')}
                        </div>
                      </td>
                      {/* Unit */}
                      <td style={{ textAlign: "center" }}>
                        <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-muted)", background: "rgba(10,36,99,0.05)", padding: "0.3rem 0.7rem", borderRadius: "8px" }}>
                          {item.unit || '—'}
                        </span>
                      </td>
                      {/* Qty Used */}
                      <td style={{ textAlign: "right" }}>
                        {editingBomId === item.id ? (
                          <div className="flex flex-column gap-0-5">
                            <input type="number" min="0.01" step="0.01" value={editQty} onChange={e => setEditQty(e.target.value)}
                              className="inline-edit-input" placeholder="Qty" autoFocus />
                            <input type="number" min="0" step="0.01" value={editCost} onChange={e => setEditCost(e.target.value)}
                              className="inline-edit-input" placeholder="Unit Cost" />
                          </div>
                        ) : (
                          <span style={{ fontWeight: 900, color: "var(--primary)", fontSize: "1.05rem" }}>
                            {qty.toLocaleString("en-IN")}
                          </span>
                        )}
                      </td>
                      {/* Unit Cost */}
                      <td style={{ textAlign: "right" }}>
                        <span style={{ fontWeight: 700, color: "var(--text-main)" }}>
                          {cost > 0 ? formatCurrency(cost, user?.company) : <span className="text-muted">—</span>}
                        </span>
                      </td>
                      {/* Amount */}
                      <td style={{ textAlign: "right" }}>
                        <span style={{ fontWeight: 900, color: amount > 0 ? "var(--primary)" : "var(--text-muted)" }}>
                          {amount > 0 ? formatCurrency(amount, user?.company) : "—"}
                        </span>
                      </td>
                      {hasAccess && (
                        <td style={{ textAlign: "center" }}>
                          <div className="flex justify-center gap-0-5">
                            {editingBomId === item.id ? (
                              <>
                                <button onClick={() => handleUpdateBomItem(item)} className="btn-table-success" title="Save Changes">✓</button>
                                <button onClick={() => setEditingBomId(null)} className="btn-table-cancel" title="Cancel Editing">✕</button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => { if(!isClosed) { setEditingBomId(item.id); setEditQty(item.quantity_used); setEditCost(item.cost); } }} className="btn-table-edit" title={isClosed ? "Project Locked" : "Adjust Quantity"} disabled={isClosed} style={{ opacity: isClosed ? 0.3 : 1, cursor: isClosed ? "not-allowed" : "pointer" }}>✏️</button>
                                <button onClick={() => { if(!isClosed) handleRemoveBomItem(item); }} className="btn-table-danger" title={isClosed ? "Project Locked" : "Redact Resource"} disabled={isClosed} style={{ opacity: isClosed ? 0.3 : 1, cursor: isClosed ? "not-allowed" : "pointer" }}>🗑️</button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {project.items && project.items.length > 0 && (
              <div style={{ marginTop: "2rem", paddingTop: "2rem", borderTop: "2px solid rgba(10,36,99,0.04)", display: "flex", justifyContent: "flex-end" }}>
                <div style={{ textAlign: "right" }}>
                  <p className="label-sm">AGGREGATE PROJECT VALUE</p>
                  <p style={{ fontSize: "2.2rem", fontWeight: 950, color: "var(--primary)", letterSpacing: "-1.5px" }}>
                    {formatCurrency(project.total_cost, user?.company)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Edit Project Modal ── */}
        {showEditModal && (
          <div className="modal-overlay">
            <div className="card modal-content animate-scale-up">
              <h2 style={{ fontSize: "1.8rem", fontWeight: 900, marginBottom: "0.5rem", letterSpacing: "-1px" }}>System <span className="text-primary">Configuration</span></h2>
              <p className="text-muted mb-2">Adjust the operational identity, budget, or protocol for this batch.</p>
              
              <form onSubmit={handleUpdateProject} className="flex flex-column gap-2">
                <div>
                  <label className="label-sm">SYSTEM IDENTITY</label>
                  <input type="text" value={editForm.machine_name} onChange={e => setEditForm({ ...editForm, machine_name: e.target.value })} required style={{ borderRadius: "14px", height: "3.5rem" }} />
                </div>
                <div>
                  <label className="label-sm">BUDGET ALLOCATION ({getCurrencySymbol(user?.company)})</label>
                  <input type="number" step="0.01" value={editForm.budget} onChange={e => setEditForm({ ...editForm, budget: e.target.value })} style={{ borderRadius: "14px", height: "3.5rem" }} />
                </div>
                <div>
                  <label className="label-sm">OPERATIONAL PROTOCOL</label>
                  <textarea value={editForm.note} onChange={e => setEditForm({ ...editForm, note: e.target.value })} style={{ height: "120px", borderRadius: "14px" }} />
                </div>

                <div className="flex gap-1 justify-end mt-1">
                  <button type="button" onClick={() => setShowEditModal(false)} className="btn-ghost">ABORT</button>
                  <button type="submit" disabled={savingProject} style={{ padding: "1rem 2rem", borderRadius: "14px", fontWeight: 900 }}>
                    {savingProject ? "SAVING..." : "UPDATE PROJECT"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .label-sm { font-size: 0.7rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 0.75rem; display: block; }
        .glass-card-premium { background: rgba(255,255,255,0.7); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.4); border-radius: 28px; padding: 2rem; box-shadow: 0 10px 30px rgba(0,0,0,0.02); }
        .btn-status-transition { width: 100%; padding: 0.8rem; border-radius: 14px; font-weight: 900; cursor: pointer; transition: 0.3s; font-size: 0.8rem; letter-spacing: 0.5px; }
        .btn-status-transition:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(0,0,0,0.05); filter: brightness(1.05); }
        .search-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: white; border-radius: 18px; box-shadow: 0 20px 50px rgba(0,0,0,0.15); z-index: 1000; overflow: hidden; margin-top: 8px; border: 1px solid rgba(0,0,0,0.05); }
        .search-item { padding: 1rem 1.5rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer; border-bottom: 1px solid rgba(0,0,0,0.03); transition: 0.2s; }
        .search-item:hover { background: var(--bg-main); }
        .search-item-title { font-weight: 800; color: var(--text-main); font-size: 0.95rem; }
        .search-item-meta { font-size: 0.7rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; margin-top: 0.2rem; }
        .selected-item-preview { padding: 1.5rem; background: rgba(10,36,99,0.04); border-radius: 18px; border: 1px dashed rgba(10,36,99,0.1); }
        .bom-table { width: 100%; border-collapse: separate; border-spacing: 0; }
        .bom-table th { padding: 1.25rem 1rem; border-bottom: 2px solid rgba(10,36,99,0.05); font-size: 0.7rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; }
        .bom-table td { padding: 1.5rem 1rem; border-bottom: 1px solid rgba(10,36,99,0.03); vertical-align: middle; }
        .bom-table tr:last-child td { border-bottom: none; }
        .inline-edit-input { width: 100px; padding: 0.5rem; border-radius: 8px; border: 2px solid var(--primary); text-align: right; font-weight: 900; outline: none; }
        .btn-table-edit { background: rgba(10,36,99,0.05); border: none; padding: 0.6rem; border-radius: 10px; cursor: pointer; transition: 0.2s; }
        .btn-table-danger { background: rgba(225, 29, 72, 0.05); border: none; padding: 0.6rem; border-radius: 10px; cursor: pointer; color: var(--accent); transition: 0.2s; }
        .btn-table-success { background: var(--success); color: white; border: none; padding: 0.6rem; border-radius: 10px; cursor: pointer; }
        .btn-table-cancel { background: #888; color: white; border: none; padding: 0.6rem; border-radius: 10px; cursor: pointer; }
        .btn-table-edit:hover, .btn-table-danger:hover { transform: scale(1.15); }
        .modal-overlay { position: fixed; inset: 0; background: rgba(10,36,99,0.4); backdrop-filter: blur(15px); display: flex; alignItems: center; justifyContent: center; z-index: 2000; padding: 1.5rem; }
        .modal-content { width: 100%; maxWidth: 500px; padding: 3rem; borderRadius: 32px; background: white; box-shadow: 0 40px 100px rgba(0,0,0,0.3); }
        .btn-ghost { background: none; border: none; color: var(--text-muted); font-weight: 800; cursor: pointer; padding: 1rem 1.5rem; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleUp { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-fade-in { animation: fadeIn 0.4s ease-out; }
        .animate-scale-up { animation: scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
      `}</style>
    </Layout>
  );
};

export default ManufacturingDetail;
