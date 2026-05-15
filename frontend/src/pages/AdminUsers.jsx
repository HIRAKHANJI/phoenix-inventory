import Layout from "../components/Layout";
import { useState, useEffect } from "react";
import api from "../api/axios";
import { toast } from "react-hot-toast";
import { useAuth } from "../context/AuthContext";

const AdminUsers = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [clearanceHours, setClearanceHours] = useState(1);
  const [approvingUser, setApprovingUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState("user");

  const fetchUsers = async () => {
    try {
      const res = await api.get("/users");
      setUsers(res.data);
    } catch (err) {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleStatusUpdate = async (id, status) => {
    try {
      await api.put(`/users/${id}/status`, { status });
      toast.success(`User status: ${status.toUpperCase()}`);
      fetchUsers();
    } catch (err) {
      toast.error("Status change failed.");
    }
  };

  const handleRoleUpdate = async (id, role) => {
    try {
      await api.put(`/users/${id}/role`, { role });
      toast.success(`Role updated: ${role.toUpperCase()}`);
      fetchUsers();
    } catch (err) {
      toast.error("Failed to update role.");
    }
  };

  const handleApprove = async () => {
    try {
      await api.put(`/users/${approvingUser.id}/approve`, { role: selectedRole });
      toast.success(`User Approved as ${selectedRole.toUpperCase()}`);
      setApprovingUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Approval failed.");
    }
  };

  const handleReject = async (id) => {
    if (!window.confirm("Permanently reject this registration?")) return;
    try {
      await api.delete(`/users/${id}/reject`);
      toast.success("Registration rejected.");
      fetchUsers();
    } catch (err) {
      toast.error("Rejection failed.");
    }
  };

  const grantCompanyClearance = async (userId) => {
    try {
      const targetCompany = currentUser.company === 'phoenix' ? 'inpack' : 'phoenix';
      await api.post(`/users/${userId}/clearance`, {
        company: targetCompany,
        hours: clearanceHours
      });
      toast.success(`Extra access granted for ${clearanceHours}hr(s)`);
      fetchUsers();
      setSelectedUser(null);
    } catch (err) {
        toast.error("Failed to grant access.");
    }
  };

  const RoleBadge = ({ role }) => {
    const configs = {
      super_admin: { label: "SUPER ADMIN", bg: "var(--primary)", border: "rgba(225, 29, 72, 0.3)" },
      admin: { label: "ADMIN", bg: "var(--accent)", border: "rgba(249, 115, 22, 0.3)" },
      user: { label: "USER", bg: "#64748b", border: "rgba(100, 116, 139, 0.3)" },
      viewer: { label: "VIEWER", bg: "#94a3b8", border: "rgba(148, 163, 184, 0.3)" },
      pending: { label: "PENDING", bg: "#f59e0b", border: "rgba(245, 158, 11, 0.3)" }
    };
    const config = configs[role] || configs.user;
    return (
      <span style={{
        backgroundColor: config.bg,
        color: "white",
        fontSize: "0.65rem",
        fontWeight: 900,
        padding: "0.3rem 0.8rem",
        borderRadius: "4px",
        letterSpacing: "1.2px",
        boxShadow: `0 4px 10px ${config.border}`,
      }}>
        {config.label}
      </span>
    );
  };

  const pendingUsers = users.filter(u => u.status === 'pending');
  const activeUsers = users.filter(u => u.status !== 'pending');

  return (
    <Layout>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <header className="flex justify-between align-center mb-2">
          <div>
            <h1 style={{ letterSpacing: "-1px" }}>User <span className="text-accent">Management</span></h1>
            <p className="text-muted" style={{ fontWeight: 600, fontSize: "0.8rem", letterSpacing: "1px" }}>MANAGE USER ACCESS</p>
          </div>
        </header>

        {pendingUsers.length > 0 && (
          <div className="mb-4">
            <h2 style={{ fontSize: "1rem", marginBottom: "1rem", color: "var(--accent)" }}>⚠️ Pending Approval Requests ({pendingUsers.length})</h2>
            <div className="card glass-card" style={{ padding: 0, overflow: "hidden", borderRadius: "16px", border: "1px solid var(--accent)" }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                <thead style={{ backgroundColor: "rgba(245, 158, 11, 0.1)" }}>
                  <tr>
                    <th style={{ padding: "1rem 1.5rem", fontSize: "0.7rem", color: "var(--text-muted)", letterSpacing: "1px" }}>NEW USER</th>
                    <th style={{ padding: "1rem 1.5rem", fontSize: "0.7rem", color: "var(--text-muted)", letterSpacing: "1px" }}>REQUEST DATE</th>
                    <th style={{ padding: "1rem 1.5rem", textAlign: "right" }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingUsers.map(u => (
                    <tr key={u.id}>
                      <td style={{ padding: "1rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <div style={{ fontWeight: 800, fontSize: "0.9rem" }}>{u.name}</div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{u.email}</div>
                      </td>
                      <td style={{ padding: "1rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: "0.8rem" }}>
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "1rem 1.5rem", textAlign: "right", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <div className="flex justify-end gap-1">
                          <button className="btn-sm" onClick={() => setApprovingUser(u)} style={{ backgroundColor: "var(--success)", color: "white" }}>APPROVE</button>
                          <button className="btn-sm danger" onClick={() => handleReject(u.id)}>REJECT</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="card glass-card" style={{ padding: 0, overflow: "hidden", borderRadius: "16px" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
            <thead style={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
              <tr>
                <th style={{ padding: "1.5rem", fontSize: "0.7rem", color: "var(--text-muted)", letterSpacing: "1px" }}>USER NAME</th>
                <th style={{ padding: "1.5rem", fontSize: "0.7rem", color: "var(--text-muted)", letterSpacing: "1px" }}>USER ROLE</th>
                <th style={{ padding: "1.5rem", fontSize: "0.7rem", color: "var(--text-muted)", letterSpacing: "1px" }}>EXTRA ACCESS</th>
                <th style={{ padding: "1.5rem", fontSize: "0.7rem", color: "var(--text-muted)", letterSpacing: "1px" }}>STATUS</th>
                <th style={{ padding: "1.5rem", textAlign: "right" }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {activeUsers.map(u => (
                <tr key={u.id} style={{ transition: "background 0.2s" }}>
                  <td style={{ padding: "1.25rem", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>{u.name}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>{u.email}</div>
                  </td>
                  <td style={{ padding: "1.25rem", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <RoleBadge role={u.role} />
                  </td>
                  <td style={{ padding: "1.25rem", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    {u.company_access && Object.keys(u.company_access).length > 0 ? (
                      <div className="flex gap-1">
                        {Object.entries(u.company_access).map(([comp, data]) => (
                          <div key={comp} style={{ 
                            fontSize: "0.6rem", 
                            fontWeight: 800, 
                            backgroundColor: "rgba(255,255,255,0.05)", 
                            padding: "0.2rem 0.5rem", 
                            borderRadius: "4px",
                            border: "1px solid rgba(255,255,255,0.1)"
                          }}>
                            {comp.toUpperCase()} (Expires: {new Date(data.expires_at).getHours()}:00)
                          </div>
                        ))}
                      </div>
                    ) : <span className="text-muted" style={{ fontSize: "0.7rem" }}>Only local access</span>}
                  </td>
                  <td style={{ padding: "1.25rem", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <span style={{ 
                      color: u.status === 'active' ? "var(--success)" : "var(--accent)", 
                      fontSize: "0.75rem", 
                      fontWeight: 800, 
                      textTransform: "uppercase" 
                    }}>
                      ● {u.status}
                    </span>
                  </td>
                  <td style={{ padding: "1.25rem", textAlign: "right", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    {String(currentUser.id) !== String(u.id) && (
                      <div className="flex justify-end gap-1">
                        {/* ONLY Super Admin can grant clearance */}
                        {currentUser.role === 'super_admin' && (
                          <button className="btn-sm" onClick={() => setSelectedUser(u)} style={{ backgroundColor: "var(--primary)", borderColor: "transparent", color: "white", fontSize: "0.65rem", fontWeight: 800 }}>GRANT ACCESS</button>
                        )}

                        {/* Control Actions: Super Admin manages everyone, Admin manages Users only */}
                        {(currentUser.role === 'super_admin' || (currentUser.role === 'admin' && (u.role === 'user' || u.role === 'viewer'))) && (
                          <>
                            <select 
                              className="btn-sm" 
                              value={u.role} 
                              onChange={(e) => handleRoleUpdate(u.id, e.target.value)}
                              style={{ fontSize: "0.65rem", fontWeight: 800, backgroundColor: "#1e293b", color: "white", border: "1px solid rgba(255,255,255,0.1)" }}
                            >
                              <option value="viewer" style={{ backgroundColor: "#1e293b" }}>Viewer</option>
                              <option value="user" style={{ backgroundColor: "#1e293b" }}>User</option>
                              <option value="admin" style={{ backgroundColor: "#1e293b" }}>Admin</option>
                              {currentUser.role === 'super_admin' && <option value="super_admin" style={{ backgroundColor: "#1e293b" }}>Super Admin</option>}
                            </select>
                            <button 
                              className="btn-sm" 
                              onClick={() => handleStatusUpdate(u.id, u.status === 'active' ? 'suspended' : 'active')}
                              style={{ 
                                backgroundColor: u.status === 'active' ? "rgba(225, 29, 72, 0.1)" : "rgba(16, 185, 129, 0.1)",
                                color: u.status === 'active' ? "var(--accent)" : "var(--success)",
                                fontWeight: 800,
                                fontSize: "0.65rem"
                              }}
                            >
                              {u.status === 'active' ? "SUSPEND" : "RESTORE"}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approval Modal */}
      {approvingUser && (
        <div style={{
          position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.8)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)"
        }}>
          <div className="card glass-card" style={{ width: "100%", maxWidth: "400px", padding: "2.5rem" }}>
            <h2 style={{ letterSpacing: "-1px", fontSize: "1.25rem" }}>Approve <span className="text-accent">User</span></h2>
            <p className="text-muted" style={{ fontSize: "0.8rem", marginBottom: "2rem" }}>Select access level for <strong>{approvingUser.name}</strong>.</p>
            
            <div style={{ marginBottom: "2rem" }}>
              <label style={{ display: "block", marginBottom: "0.75rem", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)" }}>USER ROLE</label>
              <select 
                value={selectedRole} 
                onChange={(e) => setSelectedRole(e.target.value)}
                style={{ width: "100%", padding: "0.8rem", borderRadius: "12px", backgroundColor: "#1e293b", color: "white", border: "1px solid var(--border)" }}
              >
                <option value="viewer">Viewer (Read-only)</option>
                <option value="user">User (Standard Access)</option>
                <option value="admin">Admin (Full Access)</option>
              </select>
            </div>

            <div className="flex gap-1">
              <button style={{ flex: 1, backgroundColor: "#334155" }} onClick={() => setApprovingUser(null)}>CANCEL</button>
              <button style={{ flex: 1, backgroundColor: "var(--success)" }} onClick={handleApprove}>APPROVE ACCESS</button>
            </div>
          </div>
        </div>
      )}

      {/* Clearance Modal */}
      {selectedUser && (
        <div style={{
          position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.8)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)"
        }}>
          <div className="card glass-card" style={{ width: "100%", maxWidth: "400px", padding: "2.5rem" }}>
            <h2 style={{ letterSpacing: "-1px", fontSize: "1.25rem" }}>Grant Extra <span className="text-accent">Access</span></h2>
            <p className="text-muted" style={{ fontSize: "0.8rem", marginBottom: "2rem" }}>Give temporary access to other company for <strong>{selectedUser.name}</strong>.</p>
            
            <div style={{ marginBottom: "2rem" }}>
              <label style={{ display: "block", marginBottom: "0.75rem", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)" }}>ACCESS TIME (HOURS)</label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {[1, 4, 8, 24].map(h => (
                  <button key={h} onClick={() => setClearanceHours(h)} style={{ 
                    flex: 1, 
                    backgroundColor: clearanceHours === h ? "var(--primary)" : "rgba(255,255,255,0.05)",
                    border: clearanceHours === h ? "1px solid var(--primary)" : "1px solid rgba(255,255,255,0.1)",
                    color: "white",
                    fontSize: "0.8rem",
                    fontWeight: 800,
                    padding: "0.75rem 0"
                  }}>{h}hr</button>
                ))}
              </div>
            </div>

            <div className="flex gap-1">
              <button style={{ flex: 1, backgroundColor: "#334155" }} onClick={() => setSelectedUser(null)}>CANCEL</button>
              <button style={{ flex: 1, backgroundColor: "var(--accent)" }} onClick={() => grantCompanyClearance(selectedUser.id)}>GIVE ACCESS</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default AdminUsers;
