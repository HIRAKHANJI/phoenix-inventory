import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import api from "../api/axios";
import { toast } from "react-hot-toast";

const STATUS_META = {
  not_started: { label: "Not Started", color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
  active:      { label: "Active",      color: "#2563eb", bg: "rgba(37,99,235,0.12)" },
  closed:      { label: "Closed",      color: "#16a34a", bg: "rgba(22,163,74,0.12)" },
};

const ManufacturingList = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ machine_name: "", note: "" });
  const [creating, setCreating] = useState(false);

  const fetchProjects = async () => {
    try {
      const res = await api.get("/manufacturing");
      setProjects(res.data.data || []);
    } catch {
      toast.error("Failed to load projects.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await api.post("/manufacturing", form);
      toast.success("Project created.");
      setShowCreate(false);
      setForm({ machine_name: "", note: "" });
      navigate(`/admin/manufacturing/${res.data.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create project.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Layout>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <header className="flex justify-between align-center mb-2" style={{ flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1>Manufacturing <span className="text-red">Projects</span></h1>
            <p className="text-muted">Track machine-level manufacturing jobs and material consumption.</p>
          </div>
          <button onClick={() => setShowCreate(true)}>+ Create Project</button>
        </header>

        {loading ? (
          <div className="card" style={{ textAlign: "center", padding: "4rem" }}>
            <p className="text-muted">Loading projects...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "4rem" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🏭</div>
            <p className="text-muted">No manufacturing projects yet. Create your first one!</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.5rem" }}>
            {projects.map(project => {
              const meta = STATUS_META[project.status] || STATUS_META.not_started;
              return (
                <div
                  key={project.id}
                  className="card"
                  onClick={() => navigate(`/admin/manufacturing/${project.id}`)}
                  style={{ cursor: "pointer", transition: "all 0.2s", borderLeft: `4px solid ${meta.color}` }}
                  onMouseEnter={e => e.currentTarget.style.transform = "translateY(-3px)"}
                  onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
                >
                  <div className="flex justify-between align-center mb-1">
                    <span style={{ fontSize: "0.72rem", fontWeight: 800, padding: "0.25rem 0.7rem", borderRadius: "20px", color: meta.color, background: meta.bg, border: `1px solid ${meta.color}` }}>
                      {meta.label.toUpperCase()}
                    </span>
                    <span className="text-muted" style={{ fontSize: "0.75rem" }}>
                      #{project.id} · {new Date(project.created_at).toLocaleDateString("en-IN")}
                    </span>
                  </div>
                  <h2 style={{ marginBottom: "0.5rem", fontSize: "1.1rem" }}>{project.machine_name}</h2>
                  {project.note && (
                    <p className="text-muted" style={{ fontSize: "0.85rem", marginBottom: "0.75rem", lineHeight: 1.4 }}>
                      {project.note.length > 80 ? project.note.slice(0, 80) + "..." : project.note}
                    </p>
                  )}
                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="text-muted" style={{ fontSize: "0.78rem" }}>Total Cost</span>
                    <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--primary)" }}>
                      ₹ {parseFloat(project.total_cost || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
          <div className="card" style={{ width: "100%", maxWidth: "460px" }}>
            <h2 className="mb-2">New Manufacturing Project</h2>
            <form onSubmit={handleCreate} className="flex flex-column gap-1">
              <div>
                <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)" }}>MACHINE NAME</label>
                <input type="text" value={form.machine_name} onChange={e => setForm({ ...form, machine_name: e.target.value })} required placeholder="e.g. CNC Machine #3" />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)" }}>NOTES (optional)</label>
                <textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} style={{ height: "80px", resize: "vertical" }} placeholder="Project description or work order details..." />
              </div>
              <div className="flex gap-1 justify-end" style={{ marginTop: "0.5rem" }}>
                <button type="button" onClick={() => setShowCreate(false)} style={{ background: "#888", color: "white", border: "none", borderRadius: "10px", padding: "0.7rem 1.25rem", cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={creating}>{creating ? "Creating..." : "Create Project"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default ManufacturingList;
