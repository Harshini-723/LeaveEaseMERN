import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Palmtree, BriefcaseMedical, ClipboardList, CheckCircle2, Clock3, XCircle, Users } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
const initialBalances = { "Casual Leave": 10, "Medical Leave": 10 };

function App() {
  const [page, setPage] = useState("employee");
  const [leaves, setLeaves] = useState([]);
  const [leaveType, setLeaveType] = useState("Casual Leave");
  const [days, setDays] = useState("1");
  const [reason, setReason] = useState("");
  const [employeeName, setEmployeeName] = useState("Employee");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const loadLeaves = async () => {
    try {
      const response = await fetch(`${API}/api/leaves`);
      if (!response.ok) throw new Error("API unavailable");
      setLeaves(await response.json());
    } catch {
      setMessage("Unable to connect to the server. Check the backend URL and MongoDB connection.");
    } finally { setLoading(false); }
  };

  useEffect(() => { loadLeaves(); }, []);

  const used = useMemo(() => {
    const totals = { "Casual Leave": 0, "Medical Leave": 0 };
    leaves.filter(item => item.status === "Approved").forEach(item => {
      totals[item.leaveType] += Number(item.days || 0);
    });
    return totals;
  }, [leaves]);

  const balance = type => Math.max(0, initialBalances[type] - used[type]);
  const pending = leaves.filter(item => item.status === "Pending Approval").length;
  const approved = leaves.filter(item => item.status === "Approved").length;
  const rejected = leaves.filter(item => item.status === "Rejected").length;

  async function submitLeave(event) {
    event.preventDefault();
    setMessage("");
    try {
      const response = await fetch(`${API}/api/leaves`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaveType, days, reason, employeeName })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to submit request.");
      setReason(""); setDays("1"); setMessage("Leave request submitted successfully.");
      await loadLeaves();
    } catch (error) { setMessage(error.message); }
  }

  async function updateStatus(id, status) {
    try {
      const response = await fetch(`${API}/api/leaves/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Update failed.");
      setLeaves(current => current.map(item => item._id === id ? data : item));
      setMessage(`Request ${status.toLowerCase()}.`);
    } catch (error) { setMessage(error.message); }
  }

  const dateText = date => new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  const statusClass = status => status === "Approved" ? "approved" : status === "Rejected" ? "rejected" : "pending";

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <h1>LeaveEase</h1>
          <p>Employee Leave Management System</p>
        </div>
        <div className="portal-switch">
          <button className={page === "employee" ? "active" : ""} onClick={() => setPage("employee")}>Employee Portal</button>
          <button className={page === "admin" ? "active" : ""} onClick={() => setPage("admin")}>Admin Portal</button>
        </div>
      </header>

      <main className="main-area">
        {page === "employee" ? <>
          <section className="welcome">
            <h2>Welcome, {employeeName || "Employee"}!</h2>
            <p>Apply for leave and manage your leave balance.</p>
          </section>
          <div className="balance-grid">
            <BalanceCard icon={<Palmtree />} label="Casual Leave" value={balance("Casual Leave")} color="blue" />
            <BalanceCard icon={<BriefcaseMedical />} label="Medical Leave" value={balance("Medical Leave")} color="green" />
            <BalanceCard icon={<CalendarDays />} label="Total Available" value={balance("Casual Leave") + balance("Medical Leave")} color="purple" total />
          </div>

          <div className="employee-grid">
            <section className="panel form-panel">
              <div className="panel-heading"><h3>Apply for Leave</h3><p>Fill in the details to submit your request.</p></div>
              <form onSubmit={submitLeave}>
                <label>Employee Name</label>
                <input value={employeeName} onChange={e => setEmployeeName(e.target.value)} placeholder="Enter your name" required />
                <label>Leave Type</label>
                <select value={leaveType} onChange={e => setLeaveType(e.target.value)}>
                  <option>Casual Leave</option><option>Medical Leave</option>
                </select>
                <label>Number of Days</label>
                <input type="number" min="1" max={balance(leaveType)} value={days} onChange={e => setDays(e.target.value)} required />
                <label>Reason for Leave</label>
                <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Enter your reason..." rows="4" required />
                <p className="available">Available: {balance(leaveType)} days</p>
                <button className="primary-btn" type="submit" disabled={Number(days) < 1 || Number(days) > balance(leaveType)}>Submit Leave Request</button>
              </form>
            </section>

            <section className="panel history-panel">
              <div className="panel-heading"><h3>Leave History</h3><p>Your submitted leave applications.</p></div>
              {loading ? <div className="empty-state">Loading applications...</div> :
                leaves.length === 0 ? <div className="empty-state"><ClipboardList size={30}/><strong>No applications yet</strong><span>Your leave requests will appear here.</span></div> :
                <div className="request-list">{leaves.map(item => <RequestCard key={item._id} item={item} dateText={dateText} statusClass={statusClass} />)}</div>}
            </section>
          </div>
        </> : <>
          <section className="welcome"><h2>Admin Dashboard</h2><p>Review employee leave requests and update their status.</p></section>
          <div className="stats-grid">
            <StatCard icon={<Clock3 />} label="Awaiting Approval" value={pending} />
            <StatCard icon={<CheckCircle2 />} label="Approved" value={approved} />
            <StatCard icon={<XCircle />} label="Rejected" value={rejected} />
          </div>
          <section className="panel admin-panel">
            <div className="panel-heading"><h3>Leave Requests</h3><p>Review requests and update their status.</p></div>
            {loading ? <div className="empty-state">Loading requests...</div> : leaves.length === 0 ?
              <div className="empty-state"><Users size={30}/><strong>No leave requests yet</strong></div> :
              <div className="request-list">{leaves.map(item => <div className="admin-request" key={item._id}>
                <div className="request-top"><strong>{item.leaveType}</strong><span className={`status ${statusClass(item.status)}`}>{item.status}</span></div>
                <p className="request-meta">{item.employeeName} · {item.days} day(s) · Applied on {dateText(item.createdAt)}</p>
                <p className="reason"><b>Reason:</b> {item.reason}</p>
                {item.status === "Pending Approval" && <div className="actions">
                  <button className="approve-btn" onClick={() => updateStatus(item._id, "Approved")}><CheckCircle2 size={14}/> Approve</button>
                  <button className="reject-btn" onClick={() => updateStatus(item._id, "Rejected")}><XCircle size={14}/> Reject</button>
                </div>}
              </div>)}</div>}
          </section>
        </>}
        {message && <div className={`notice ${message.includes("successfully") || message.includes("approved") || message.includes("rejected") ? "success" : ""}`}>{message}<button onClick={() => setMessage("")}>×</button></div>}
        <footer>LeaveEase · Employee Leave Management</footer>
      </main>
    </div>
  );
}

function BalanceCard({ icon, label, value, color, total }) {
  return <section className="balance-card">
    <div className={`card-icon ${color}`}>{icon}</div><p>{label}</p>
    <div className="balance-number">{value} <span>days {total ? "" : "left"}</span></div>
    {!total && <div className={`progress ${color}`}><span /></div>}
    {total && <small>Across both leave types</small>}
  </section>;
}
function StatCard({ icon, label, value }) {
  return <section className="stat-card"><div className="stat-label">{icon}<span>{label}</span></div><strong>{value}</strong></section>;
}
function RequestCard({ item, dateText, statusClass }) {
  return <div className="history-item">
    <div className="request-top"><strong>{item.leaveType}</strong><span className={`status ${statusClass(item.status)}`}>{item.status}</span></div>
    <p className="request-meta">{item.days} day(s) · Applied on {dateText(item.createdAt)}</p>
    <p className="reason"><b>Reason:</b> {item.reason}</p>
  </div>;
}
export default App;
