export default function TechnicianHome() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#f3f4f6",
      padding: "16px"
    }}>
      <h1 style={{
        fontSize: "18px",
        fontWeight: "600",
        marginBottom: "16px"
      }}>
        Technician Tasks
      </h1>
      <div style={{
        background: "#fff",
        padding: "12px",
        borderRadius: "12px",
        marginBottom: "12px"
      }}>
        <div>Client: Test Project</div>
        <button style={{
          marginTop: "10px",
          background: "#111827",
          color: "#fff",
          padding: "10px",
          borderRadius: "8px",
          width: "100%"
        }}>
          Start Visit
        </button>
      </div>
    </div>
  );
}
