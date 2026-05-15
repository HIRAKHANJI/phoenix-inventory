import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import api from "../api/axios";
import { toast } from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { getCurrencySymbol } from "../utils/currency";

const STATUS_META = {
  not_started: { label: "Pending", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.12)", icon: "⏳" },
  active:      { label: "In Progress", color: "#3b82f6", bg: "rgba(59, 130, 246, 0.12)", icon: "⚙️" },
  closed:      { label: "Completed", color: "#10b981", bg: "rgba(16, 185, 129, 0.12)", icon: "✅" },
};

const ManufacturingList = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyMyProjects, setShowOnlyMyProjects] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [form, setForm] = useState({ machine_name: "", note: "", budget: "" });
  const [creating, setCreating] = useState(false);

  const fetchProjects = async () => {
    try {
      const res = await api.get("/manufacturing");
      const data = res.data?.data || [];
      setProjects(data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to synchronize projects.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchProjects(); 
    const interval = setInterval(fetchProjects, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let result = projects;
    
    // Ownership Filter
    if (showOnlyMyProjects) {
      result = result.filter(p => p.created_by === user?.id);
    }

    // Search Filter
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      result = result.filter(p => 
        p.machine_name.toLowerCase().includes(query) || 
        String(p.id).includes(query)
      );
    }
    
    setFilteredProjects(result);
  }, [searchQuery, projects, showOnlyMyProjects, user?.id]);

  const handleOpenCreate = () => {
    setIsEditing(false);
    setForm({ machine_name: "", note: "", budget: "" });
    setShowModal(true);
  };

  const handleOpenEdit = (e, project) => {
    e.stopPropagation();
    setIsEditing(true);
    setSelectedProjectId(project.id);
    setForm({ 
      machine_name: project.machine_name, 
      note: project.note || "",
      budget: project.budget || ""
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      if (isEditing) {
        await api.put(`/manufacturing/${selectedProjectId}`, form);
        toast.success("Project updated.");
        fetchProjects();
      } else {
        const res = await api.post("/manufacturing", form);
        toast.success("Manufacturing project initiated.");
        if (res.data?.data?.id) {
          navigate(`/admin/manufacturing/${res.data.data.id}`);
        } else {
          fetchProjects();
        }
      }
      setShowModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Operational failure.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("CAUTION: This will permanently redact the project and its BOM history. Proceed?")) return;
    try {
      await api.delete(`/manufacturing/${id}`);
      toast.success("Project records purged.");
      fetchProjects();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to redact project.");
    }
  };

  return (
    <Layout>
      <div style={{ maxWidth: "1250px", margin: "0 auto", padding: "2rem" }}>
        
        {/* ── Dashboard Header ── */}
        <header className="flex justify-between align-center mb-4" style={{ flexWrap: "wrap", gap: "2rem" }}>
          <div>
            <h1 style={{ fontSize: "2.8rem", fontWeight: 900, letterSpacing: "-2px", marginBottom: "0.5rem" }}>
              Manufacturing <span style={{ color: "var(--primary)" }}>Console</span>
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
              <span style={{ height: "8px", width: "8px", borderRadius: "50%", background: "var(--success)", boxShadow: "0 0 10px var(--success)" }}></span>
              <p className="text-muted" style={{ fontSize: "0.9rem", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase" }}>
                Inpack Operational Node • System Online
              </p>
            </div>
          </div>
        </header>

        {/* ── Statistics Summary ── */}
        <div className="flex gap-1 mb-4" style={{ flexWrap: "wrap" }}>
          <div className="card" style={{ flex: 1, minWidth: "200px", padding: "1.5rem", borderRadius: "20px" }}>
            <p style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)" }}>TOTAL PROTOCOLS</p>
            <p style={{ fontSize: "1.8rem", fontWeight: 900 }}>{projects.length}</p>
          </div>
          <div className="card" style={{ flex: 1, minWidth: "200px", padding: "1.5rem", borderRadius: "20px" }}>
            <p style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)" }}>ACTIVE SYSTEMS</p>
            <p style={{ fontSize: "1.8rem", fontWeight: 900, color: "var(--primary)" }}>{projects.filter(p => p.status === 'active').length}</p>
          </div>
        </div>

        {/* ── Search & Filters ── */}
        <div className="flex gap-1 mb-4" style={{ flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: "300px" }}>
            <span style={{ position: "absolute", left: "20px", top: "50%", transform: "translateY(-50%)", opacity: 0.4, fontSize: "1.2rem" }}>🔍</span>
            <input 
              type="text" 
              placeholder="Search machine matrix or project IDs..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ 
                paddingLeft: "55px", 
                height: "4.5rem", 
                borderRadius: "20px", 
                border: "2px solid rgba(10,36,99,0.06)",
                background: "white",
                fontSize: "1.05rem",
                width: "100%",
                boxShadow: "0 10px 30px rgba(0,0,0,0.02)"
              }}
            />
          </div>
          {(user?.role === 'admin' || user?.role === 'super_admin') && (
            <button 
              onClick={() => setShowOnlyMyProjects(!showOnlyMyProjects)}
              style={{ height: "4.5rem", padding: "0 2rem", fontWeight: 800, borderRadius: "20px", background: showOnlyMyProjects ? "var(--primary)" : "#e5e7eb", color: showOnlyMyProjects ? "white" : "black" }}
            >
              {showOnlyMyProjects ? "SHOW ALL" : "SHOW MINE"}
            </button>
          )}
          <button 
            onClick={handleOpenCreate}
            style={{ 
              height: "4.5rem", 
              padding: "0 2.5rem", 
              fontWeight: 900, 
              borderRadius: "20px",
              background: "linear-gradient(135deg, var(--primary) 0%, #1e40af 100%)",
              boxShadow: "0 15px 35px rgba(37,99,235,0.25)",
              color: "white"
            }}
          >
            + NEW PROJECT
          </button>
        </div>

        {/* ── Main Operations Grid ── */}
        {loading ? (
          <div className="card glass-card" style={{ textAlign: "center", padding: "8rem 2rem", borderRadius: "32px" }}>
            <div className="spinner-glow" style={{ margin: "0 auto 2rem" }}></div>
            <p style={{ fontWeight: 800, letterSpacing: "3px", color: "var(--primary)", fontSize: "0.8rem" }}>SYNCHRONIZING PRODUCTION CORE</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "8rem 2rem", background: "white", borderRadius: "40px", border: "2px dashed var(--border)" }}>
            <div style={{ fontSize: "5rem", marginBottom: "2rem", opacity: 0.8 }}>🏢</div>
            <h2 style={{ fontSize: "2rem", fontWeight: 900, marginBottom: "1rem" }}>{searchQuery ? "No Matches in Matrix" : "Queue Empty"}</h2>
            <p className="text-muted" style={{ maxWidth: "500px", margin: "0 auto 2.5rem", fontSize: "1.1rem" }}>
              {searchQuery ? `We couldn't find any operational records matching "${searchQuery}". Check your machine identifier.` : "The manufacturing floor is currently clear. Initialize a machine project to begin material tracking."}
            </p>
          </div>
        ) : (
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 360px), 1fr))", 
            gap: "2.5rem" 
          }}>
            {filteredProjects.map(project => {
              const meta = STATUS_META[project.status] || STATUS_META.not_started;
              return (
                <div
                  key={project.id}
                  className="card project-card-premium"
                  onClick={() => navigate(`/admin/manufacturing/${project.id}`)}
                  style={{ 
                    cursor: "pointer", 
                    transition: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)", 
                    position: "relative",
                    padding: "2.5rem",
                    background: "white",
                    borderRadius: "32px",
                    border: "1px solid rgba(10,36,99,0.04)",
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    boxShadow: "0 20px 40px rgba(0,0,0,0.02)"
                  }}
                >
                  <div className="flex justify-between align-center mb-2">
                    <div style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: "0.6rem", 
                      padding: "0.5rem 1.2rem", 
                      borderRadius: "14px", 
                      background: meta.bg, 
                      color: meta.color,
                      fontSize: "0.75rem",
                      fontWeight: 900,
                      border: `1px solid ${meta.color}22`
                    }}>
                      <span>{meta.icon}</span>
                      <span>{meta.label.toUpperCase()}</span>
                    </div>
                    <div className="flex gap-0-5 align-center">
                      {(user?.role === 'admin' || user?.role === 'super_admin' || project.created_by === user?.id) && (
                        <>
                          <button 
                            onClick={(e) => handleOpenEdit(e, project)}
                            className="btn-icon"
                            title="Edit Core Metadata"
                          >
                            ✏️
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(project.id); }}
                            className="btn-icon"
                            style={{ color: "var(--accent)", background: "rgba(225, 29, 72, 0.05)" }}
                            title="Redact Project"
                          >
                            🗑️
                          </button>
                        </>
                      )}
                    </div>
                  </div>


                  <h3 style={{ fontSize: "1.6rem", fontWeight: 900, marginBottom: "0.8rem", color: "var(--text-main)", letterSpacing: "-0.5px" }}>
                    {project.machine_name}
                  </h3>
                  
                  <p className="text-muted" style={{ 
                    fontSize: "0.95rem", 
                    lineHeight: 1.7, 
                    marginBottom: "2rem",
                    flex: 1,
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden"
                  }}>
                    {project.note || "No specific operational protocol provided for this machine run."}
                  </p>
                  
                  <div style={{ position: "absolute", bottom: "1.5rem", right: "2.5rem", fontSize: "0.65rem", fontWeight: 800, color: "var(--text-muted)", opacity: 0.5 }}>
                    ID: {project.id} • {new Date(project.created_at).toLocaleDateString()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Enhanced Modal ── */}
      {showModal && (
        <div style={{ 
          position: "fixed", 
          inset: 0, 
          background: "rgba(10, 36, 99, 0.4)", 
          backdropFilter: "blur(15px)", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          zIndex: 2000,
          padding: "1.5rem"
        }}>
          <div 
            className="card animate-scale-up" 
            style={{ 
              width: "100%", 
              maxWidth: "580px", 
              padding: "3.5rem", 
              borderRadius: "40px",
              boxShadow: "0 40px 100px rgba(0, 0, 0, 0.4)",
              background: "white",
              position: "relative"
            }}
          >
            <button 
              onClick={() => setShowModal(false)} 
              style={{ position: "absolute", top: "2rem", right: "2rem", background: "var(--bg-main)", border: "none", width: "40px", height: "40px", borderRadius: "50%", cursor: "pointer", fontSize: "1.5rem", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              &times;
            </button>

            <header className="mb-3">
              <h2 style={{ fontSize: "2.2rem", fontWeight: 900, marginBottom: "0.75rem", letterSpacing: "-1.5px" }}>
                {isEditing ? <>System <span className="text-primary">Calibration</span></> : <>Commence <span className="text-primary">Batch</span></>}
              </h2>
              <p className="text-muted" style={{ fontSize: "1rem", lineHeight: 1.5 }}>
                {isEditing ? "Modify the operational machine identity, budget allocation, or batch notes." : "Initialize a new manufacturing lifecycle to track resource depletion."}
              </p>
            </header>

            <form onSubmit={handleSubmit} className="flex flex-column gap-2">
              <div>
                <label style={{ display: "block", marginBottom: "0.8rem", fontSize: "0.8rem", fontWeight: 800, color: "var(--primary)", letterSpacing: "1px" }}>SYSTEM IDENTITY</label>
                <input 
                  type="text" 
                  value={form.machine_name} 
                  onChange={e => setForm({ ...form, machine_name: e.target.value })} 
                  required 
                  placeholder="e.g. Inpack Precision Cutter #04" 
                  style={{ padding: "1.4rem", borderRadius: "20px", border: "2px solid rgba(10,36,99,0.08)", fontSize: "1.1rem" }}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "0.8rem", fontSize: "0.8rem", fontWeight: 800, color: "var(--primary)", letterSpacing: "1px" }}>BUDGET ALLOCATION ({getCurrencySymbol(user?.company)})</label>
                <input 
                  type="number" 
                  value={form.budget} 
                  onChange={e => setForm({ ...form, budget: e.target.value })} 
                  placeholder="0.00" 
                  step="0.01"
                  style={{ padding: "1.4rem", borderRadius: "20px", border: "2px solid rgba(10,36,99,0.08)", fontSize: "1.1rem" }}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "0.8rem", fontSize: "0.8rem", fontWeight: 800, color: "var(--primary)", letterSpacing: "1px" }}>OPERATIONAL PROTOCOL</label>
                <textarea 
                  value={form.note} 
                  onChange={e => setForm({ ...form, note: e.target.value })} 
                  style={{ height: "100px", resize: "none", padding: "1.4rem", borderRadius: "20px", border: "2px solid rgba(10,36,99,0.08)", fontSize: "1.1rem" }} 
                  placeholder="Define batch details, work orders, or technician requirements..." 
                />
              </div>

              
              <div className="flex gap-1 justify-end mt-1">
                <button 
                  type="submit" 
                  disabled={creating}
                  style={{ 
                    flex: 1,
                    height: "4.5rem", 
                    borderRadius: "20px", 
                    fontWeight: 900,
                    fontSize: "1.1rem",
                    boxShadow: "0 15px 30px rgba(37,99,235,0.2)"
                  }}
                >
                  {creating ? "INITIALIZING..." : (isEditing ? "UPDATE REPOSITORY" : "CONFIRM & COMMENCE")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <style>{`
        .project-card-premium:hover {
          transform: translateY(-12px) scale(1.02);
          box-shadow: 0 40px 80px rgba(10,36,99,0.08);
          border-color: var(--primary) !important;
        }
        .project-card-premium:hover .arrow-glow {
          transform: translateX(8px);
        }
        .project-card-premium:hover .arrow-glow span {
          opacity: 1 !important;
        }
        .btn-icon {
          background: rgba(10,36,99,0.03);
          border: none;
          padding: 0.6rem;
          border-radius: 10px;
          cursor: pointer;
          transition: 0.2s;
        }
        .btn-icon:hover {
          background: rgba(10,36,99,0.08);
          transform: scale(1.1);
        }
        .spinner-glow {
          width: 60px;
          height: 60px;
          border: 5px solid rgba(37,99,235,0.1);
          border-top-color: var(--primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
          box-shadow: 0 0 20px rgba(37,99,235,0.2);
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleUp { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        .animate-fade-in { animation: fadeIn 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
        .animate-scale-up { animation: scaleUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
      `}</style>
    </Layout>
  );
};

export default ManufacturingList;
