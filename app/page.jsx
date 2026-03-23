"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
`;

const css = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; }
  body {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    font-size: 13px;
    color: #111827;
    background: #f9fafb;
    -webkit-font-smoothing: antialiased;
  }
  code, .mono { font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 11.5px; }
  button { cursor: pointer; font-family: inherit; }
  input, select, textarea { font-family: inherit; font-size: 13px; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  @keyframes scanPulse {
    0% { box-shadow: 0 0 0 0 rgba(79,70,229,0.4); }
    70% { box-shadow: 0 0 0 8px rgba(79,70,229,0); }
    100% { box-shadow: 0 0 0 0 rgba(79,70,229,0); }
  }
  .fadeIn { animation: fadeIn 0.2s ease forwards; }
`;

const fmt = {
  ts: (iso) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
    });
  },
  duration: (start, end) => {
    if (!start || !end) return "—";
    const s = Math.round((new Date(end) - new Date(start)) / 1000);
    return `${s}s`;
  },
  relative: (iso) => {
    if (!iso) return "—";
    const diff = Date.now() - new Date(iso);
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h > 23) return `${Math.floor(h / 24)}d ago`;
    if (h > 0) return `${h}h ago`;
    return `${m}m ago`;
  },
};

const severityMeta = {
  critical: { label: "Critical", color: "#dc2626", bg: "#fef2f2", border: "#fecaca", dot: "#ef4444" },
  warning:  { label: "Warning",  color: "#d97706", bg: "#fffbeb", border: "#fde68a", dot: "#f59e0b" },
  info:     { label: "Info",     color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", dot: "#3b82f6" },
};

const driftTypeMeta = {
  MISSING:   { icon: "↓" },
  UNMANAGED: { icon: "↑" },
  DRIFTED:   { icon: "≠" },
};

const statusMeta = {
  completed: { label: "Completed", color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
  failed:    { label: "Failed",    color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  running:   { label: "Running",   color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
};

const Badge = ({ severity, label, style = {} }) => {
  const meta = severityMeta[severity] || { label: label || severity, color: "#6b7280", bg: "#f3f4f6", border: "#e5e7eb", dot: "#9ca3af" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "1px 6px", borderRadius: 4, fontSize: 11, fontWeight: 600,
      letterSpacing: "0.02em", textTransform: "uppercase",
      color: meta.color, background: meta.bg, border: `1px solid ${meta.border}`, ...style,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: meta.dot, flexShrink: 0 }} />
      {meta.label || label}
    </span>
  );
};

const StatusBadge = ({ status }) => {
  const meta = statusMeta[status] || { label: status, color: "#6b7280", bg: "#f3f4f6", border: "#e5e7eb" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "1px 6px", borderRadius: 4, fontSize: 11, fontWeight: 600,
      letterSpacing: "0.02em", textTransform: "uppercase",
      color: meta.color, background: meta.bg, border: `1px solid ${meta.border}`,
    }}>
      {status === "running" && (
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: meta.color, animation: "pulse 1.5s infinite" }} />
      )}
      {meta.label}
    </span>
  );
};

const Btn = ({ children, variant = "primary", onClick, disabled, style = {}, size = "md" }) => {
  const variants = {
    primary:   { background: "#4f46e5", color: "#fff", borderColor: "#4338ca" },
    secondary: { background: "#fff", color: "#374151", borderColor: "#e5e7eb" },
    ghost:     { background: "transparent", color: "#374151", borderColor: "transparent" },
    danger:    { background: "#fff", color: "#dc2626", borderColor: "#fecaca" },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        border: "1px solid", borderRadius: 6, fontWeight: 500,
        fontFamily: "inherit", cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.12s ease", opacity: disabled ? 0.5 : 1,
        fontSize: size === "sm" ? 12 : 13,
        padding: size === "sm" ? "4px 10px" : "6px 14px",
        ...variants[variant], ...style,
      }}
      onMouseEnter={e => {
        if (disabled) return;
        if (variant === "primary") e.currentTarget.style.background = "#4338ca";
        else if (variant === "secondary") e.currentTarget.style.background = "#f9fafb";
      }}
      onMouseLeave={e => {
        if (disabled) return;
        e.currentTarget.style.background = variants[variant].background;
      }}
    >
      {children}
    </button>
  );
};

const Input = ({ label, placeholder, value, onChange, type = "text", monospace, helper, error }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
    {label && <label style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>{label}</label>}
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        padding: "7px 10px", borderRadius: 6, fontSize: 13,
        border: `1px solid ${error ? "#fca5a5" : "#d1d5db"}`,
        background: error ? "#fff5f5" : "#fff", color: "#111827", outline: "none",
        fontFamily: monospace ? "'JetBrains Mono', monospace" : "inherit",
      }}
      onFocus={e => { e.target.style.borderColor = "#4f46e5"; e.target.style.boxShadow = "0 0 0 3px rgba(79,70,229,0.08)"; }}
      onBlur={e => { e.target.style.borderColor = error ? "#fca5a5" : "#d1d5db"; e.target.style.boxShadow = "none"; }}
    />
    {helper && <span style={{ fontSize: 11, color: "#9ca3af" }}>{helper}</span>}
    {error && <span style={{ fontSize: 11, color: "#dc2626" }}>{error}</span>}
  </div>
);

const SelectInput = ({ label, value, onChange, options }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
    {label && <label style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>{label}</label>}
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", color: "#111827", outline: "none", cursor: "pointer", fontSize: 13 }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const Spinner = ({ size = 16 }) => (
  <div style={{
    width: size, height: size, borderRadius: "50%",
    border: "2px solid #e5e7eb", borderTopColor: "#4f46e5",
    animation: "spin 0.6s linear infinite", flexShrink: 0,
  }} />
);

const EmptyState = ({ icon, title, body, action }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "56px 24px", gap: 12 }}>
    <div style={{ fontSize: 32, opacity: 0.3 }}>{icon}</div>
    <div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>{title}</div>
    {body && <div style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", maxWidth: 320 }}>{body}</div>}
    {action}
  </div>
);

const ErrorBanner = ({ message, onDismiss }) => (
  <div style={{
    padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca",
    borderRadius: 6, fontSize: 12, color: "#dc2626", display: "flex",
    justifyContent: "space-between", alignItems: "center", marginBottom: 16,
  }}>
    <span>✗ {message}</span>
    {onDismiss && <button onClick={onDismiss} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 14 }}>×</button>}
  </div>
);

const DiffView = ({ expected, actual }) => {
  if (!expected && !actual) return null;
  const left = expected ? JSON.stringify(expected, null, 2).split("\n") : [];
  const right = actual ? JSON.stringify(actual, null, 2).split("\n") : [];
  const maxLen = Math.max(left.length, right.length);
  const lines = [];
  for (let i = 0; i < maxLen; i++) {
    const l = left[i], r = right[i];
    if (l !== r) {
      if (l !== undefined) lines.push({ type: "remove", text: l });
      if (r !== undefined) lines.push({ type: "add", text: r });
    } else {
      lines.push({ type: "same", text: l });
    }
  }
  return (
    <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, overflow: "hidden", fontSize: 11.5 }}>
      <div style={{ padding: "6px 12px", background: "#161b22", borderBottom: "1px solid #21262d", display: "flex", gap: 8 }}>
        <span style={{ color: "#8b949e", fontFamily: "monospace", fontSize: 11 }}>config.diff</span>
        {expected && <span style={{ color: "#f85149", fontSize: 11 }}>− expected</span>}
        {actual && <span style={{ color: "#3fb950", fontSize: 11 }}>+ actual</span>}
      </div>
      <div style={{ padding: "8px 0", maxHeight: 200, overflowY: "auto" }}>
        {lines.map((line, i) => (
          <div key={i} style={{ display: "flex", padding: "1px 12px", background: line.type === "remove" ? "rgba(248,81,73,0.12)" : line.type === "add" ? "rgba(63,185,80,0.12)" : "transparent" }}>
            <span style={{ width: 14, flexShrink: 0, color: line.type === "remove" ? "#f85149" : line.type === "add" ? "#3fb950" : "#30363d", userSelect: "none" }}>
              {line.type === "remove" ? "−" : line.type === "add" ? "+" : " "}
            </span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: line.type === "remove" ? "#ffa198" : line.type === "add" ? "#7ee787" : "#e6edf3", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {line.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "▦" },
  { id: "scans",     label: "Scan History", icon: "◷" },
  { id: "drift",     label: "Drift Items", icon: "⊘" },
  { id: "settings",  label: "Settings", icon: "⊞" },
];

const Sidebar = ({ page, setPage, scanning, onScan, lastScan, openDriftCount, org }) => (
  <aside style={{
    width: 240, flexShrink: 0, height: "100vh", position: "sticky", top: 0,
    background: "#fff", borderRight: "1px solid #e5e7eb",
    display: "flex", flexDirection: "column", overflow: "hidden",
  }}>
    <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #f3f4f6" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#fff", fontWeight: 700, fontFamily: "monospace", flexShrink: 0 }}>D</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#111827", letterSpacing: "-0.01em" }}>DriftWatch</div>
          <div style={{ fontSize: 10, color: "#9ca3af", letterSpacing: "0.02em" }}>{org?.name || "Loading..."} · {org?.plan || "—"}</div>
        </div>
      </div>
    </div>
    <nav style={{ padding: "8px 10px", flex: 1 }}>
      {NAV_ITEMS.map(item => {
        const active = page === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 9,
              padding: "7px 10px", borderRadius: 5, border: "none", cursor: "pointer",
              background: active ? "#f5f3ff" : "transparent",
              color: active ? "#4f46e5" : "#6b7280",
              fontWeight: active ? 600 : 400, fontSize: 13, textAlign: "left",
              marginBottom: 1, transition: "all 0.1s",
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#f9fafb"; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
          >
            <span style={{ width: 16, textAlign: "center", fontSize: 14, opacity: active ? 1 : 0.6 }}>{item.icon}</span>
            {item.label}
            {item.id === "drift" && openDriftCount > 0 && (
              <span style={{ marginLeft: "auto", background: "#dc2626", color: "#fff", borderRadius: 10, fontSize: 10, padding: "0 5px", fontWeight: 700, minWidth: 18, textAlign: "center" }}>
                {openDriftCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
    <div style={{ padding: "12px", borderTop: "1px solid #f3f4f6" }}>
      <button
        onClick={onScan}
        disabled={scanning}
        style={{
          width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid",
          fontWeight: 600, fontSize: 13, cursor: scanning ? "default" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          background: scanning ? "#f5f3ff" : "#4f46e5",
          borderColor: scanning ? "#c4b5fd" : "#4338ca",
          color: scanning ? "#4f46e5" : "#fff",
          transition: "all 0.2s",
          animation: scanning ? "scanPulse 1.5s infinite" : "none",
        }}
      >
        {scanning ? <><Spinner size={13} />Scanning...</> : <>⊙ Run Scan</>}
      </button>
      <div style={{ marginTop: 8, fontSize: 11, color: "#9ca3af", textAlign: "center" }}>
        {lastScan ? `Last scan: ${fmt.relative(lastScan.started_at)}` : "No scans yet"}
      </div>
    </div>
  </aside>
);

const PageHeader = ({ title, subtitle, right }) => (
  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
    <div>
      <h1 style={{ fontSize: 17, fontWeight: 700, color: "#111827", letterSpacing: "-0.01em" }}>{title}</h1>
      {subtitle && <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{subtitle}</p>}
    </div>
    {right}
  </div>
);

const StatCard = ({ label, value, sub, accent, loading }) => (
  <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "14px 16px", flex: 1, minWidth: 120 }}>
    <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 700, color: loading ? "#e5e7eb" : (accent || "#111827"), letterSpacing: "-0.02em", lineHeight: 1 }}>
      {loading ? "—" : value}
    </div>
    {sub && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 5 }}>{sub}</div>}
  </div>
);

const DriftTable = ({ items, loading, compact, scanMap }) => {
  const [expanded, setExpanded] = useState(null);

  if (loading) return (
    <div style={{ padding: "32px", display: "flex", justifyContent: "center" }}>
      <Spinner size={20} />
    </div>
  );

  if (!items || items.length === 0) {
    return <EmptyState icon="✓" title="No drift detected" body="All resources match their Terraform state. Your infrastructure is clean." />;
  }

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ background: "#f9fafb", borderBottom: "1px solid #f3f4f6" }}>
          {["Severity", "Type", "Resource Type", "Resource ID", "Summary", compact ? null : "Detected"].filter(Boolean).map(h => (
            <th key={h} style={{ padding: "7px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
          ))}
          <th style={{ width: 24 }} />
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => (
          <>
            <tr
              key={item.id}
              onClick={() => setExpanded(expanded === item.id ? null : item.id)}
              style={{ borderBottom: expanded === item.id ? "none" : "1px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#f9fafb", cursor: "pointer" }}
              onMouseEnter={e => e.currentTarget.style.background = "#f5f3ff"}
              onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#f9fafb"}
            >
              <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}><Badge severity={item.severity} /></td>
              <td style={{ padding: "8px 12px" }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: item.drift_type === "MISSING" ? "#dc2626" : item.drift_type === "UNMANAGED" ? "#d97706" : "#2563eb", fontFamily: "monospace" }}>
                  {driftTypeMeta[item.drift_type]?.icon} {item.drift_type}
                </span>
              </td>
              <td style={{ padding: "8px 12px" }}>
                <code style={{ fontSize: 11.5, color: "#374151", background: "#f3f4f6", padding: "1px 5px", borderRadius: 3 }}>{item.resource_type}</code>
              </td>
              <td style={{ padding: "8px 12px" }}>
                <code style={{ fontSize: 11.5, color: "#4f46e5" }}>{item.resource_id}</code>
              </td>
              <td style={{ padding: "8px 12px", fontSize: 11.5, color: "#6b7280", maxWidth: 220 }}>
                {item.diff_summary || (item.drift_type === "MISSING" ? "Resource not found in AWS" : item.drift_type === "UNMANAGED" ? "Not tracked in Terraform state" : "Configuration changed")}
              </td>
              {!compact && (
                <td style={{ padding: "8px 12px", fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap" }}>
                  {scanMap?.[item.scan_id] ? fmt.relative(scanMap[item.scan_id].started_at) : "—"}
                </td>
              )}
              <td style={{ padding: "8px 12px", color: "#9ca3af", fontSize: 12 }}>
                {expanded === item.id ? "▾" : "▸"}
              </td>
            </tr>
            {expanded === item.id && (
              <tr key={`${item.id}-exp`} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td colSpan={compact ? 6 : 7} style={{ padding: "12px 16px", background: "#fafafa" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 16px", marginBottom: 10 }}>
                    <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>Resource ID</span>
                    <code style={{ fontSize: 11.5, color: "#4f46e5" }}>{item.resource_id}</code>
                    <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>Type</span>
                    <code style={{ fontSize: 11.5 }}>{item.resource_type}</code>
                    <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>Scan ID</span>
                    <code style={{ fontSize: 11.5, color: "#6b7280" }}>{item.scan_id}</code>
                    {item.created_at && <>
                      <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>Detected</span>
                      <code style={{ fontSize: 11.5, color: "#6b7280" }}>{fmt.ts(item.created_at)}</code>
                    </>}
                  </div>
                  <DiffView expected={item.expected_config} actual={item.actual_config} />
                </td>
              </tr>
            )}
          </>
        ))}
      </tbody>
    </table>
  );
};

const ScansTable = ({ scans, loading, compact }) => {
  const [expanded, setExpanded] = useState(null);
  const [scanDrift, setScanDrift] = useState({});
  const [loadingDrift, setLoadingDrift] = useState({});

  const loadDriftForScan = async (scanId) => {
    if (scanDrift[scanId] || loadingDrift[scanId]) return;
    setLoadingDrift(p => ({ ...p, [scanId]: true }));
    const { data } = await supabase.from("drift_items").select("*").eq("scan_id", scanId).order("severity");
    setScanDrift(p => ({ ...p, [scanId]: data || [] }));
    setLoadingDrift(p => ({ ...p, [scanId]: false }));
  };

  const toggle = (scanId) => {
    if (compact) return;
    const next = expanded === scanId ? null : scanId;
    setExpanded(next);
    if (next) loadDriftForScan(next);
  };

  if (loading) return <div style={{ padding: "32px", display: "flex", justifyContent: "center" }}><Spinner size={20} /></div>;
  if (!scans || scans.length === 0) return <EmptyState icon="◷" title="No scans yet" body="Run your first scan to see results here." />;

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ background: "#f9fafb", borderBottom: "1px solid #f3f4f6" }}>
          {["Scan ID", "Started", "Duration", "Resources", "Drift", "Status"].map(h => (
            <th key={h} style={{ padding: "7px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
          ))}
          {!compact && <th style={{ width: 24 }} />}
        </tr>
      </thead>
      <tbody>
        {scans.map((scan, i) => (
          <>
            <tr
              key={scan.id}
              onClick={() => toggle(scan.id)}
              style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#f9fafb", cursor: compact ? "default" : "pointer" }}
              onMouseEnter={e => { if (!compact) e.currentTarget.style.background = "#f5f3ff"; }}
              onMouseLeave={e => { if (!compact) e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#f9fafb"; }}
            >
              <td style={{ padding: "8px 12px" }}><code style={{ fontSize: 11.5, color: "#4f46e5" }}>{scan.id.slice(0, 18)}…</code></td>
              <td style={{ padding: "8px 12px", fontSize: 12, color: "#374151", whiteSpace: "nowrap" }}>{fmt.ts(scan.started_at)}</td>
              <td style={{ padding: "8px 12px" }}><code style={{ fontSize: 11.5, color: "#6b7280" }}>{fmt.duration(scan.started_at, scan.completed_at)}</code></td>
              <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 500, color: "#111827" }}>{scan.resources_checked || "—"}</td>
              <td style={{ padding: "8px 12px" }}>
                {scan.drift_count > 0 ? (
                  <div style={{ display: "flex", gap: 4 }}>
                    {scan.critical_count > 0 && <Badge severity="critical" label={`${scan.critical_count}`} />}
                    {scan.warning_count > 0 && <Badge severity="warning" label={`${scan.warning_count}`} />}
                    {scan.info_count > 0 && <Badge severity="info" label={`${scan.info_count}`} />}
                  </div>
                ) : (
                  <span style={{ fontSize: 12, color: "#059669", fontWeight: 500 }}>✓ Clean</span>
                )}
              </td>
              <td style={{ padding: "8px 12px" }}><StatusBadge status={scan.status} /></td>
              {!compact && <td style={{ padding: "8px 12px", color: "#9ca3af", fontSize: 12 }}>{expanded === scan.id ? "▾" : "▸"}</td>}
            </tr>
            {!compact && expanded === scan.id && (
              <tr key={`${scan.id}-exp`} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td colSpan={7} style={{ padding: "12px 16px", background: "#fafafa" }}>
                  {scan.error_message ? (
                    <div style={{ padding: "10px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, fontSize: 12, color: "#dc2626", fontFamily: "monospace" }}>✗ {scan.error_message}</div>
                  ) : loadingDrift[scan.id] ? (
                    <div style={{ display: "flex", justifyContent: "center", padding: 16 }}><Spinner /></div>
                  ) : (scanDrift[scan.id] || []).length > 0 ? (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Drift items from this scan</div>
                      <DriftTable items={scanDrift[scan.id]} compact />
                    </>
                  ) : (
                    <div style={{ fontSize: 12, color: "#059669", padding: "8px 0" }}>✓ No drift detected — all {scan.resources_checked} resources match Terraform state</div>
                  )}
                </td>
              </tr>
            )}
          </>
        ))}
      </tbody>
    </table>
  );
};

const DashboardPage = ({ orgId, onRunScan, scanning, setPage }) => {
  const [scans, setScans] = useState([]);
  const [drift, setDrift] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const [{ data: scansData, error: scansErr }, { data: driftData, error: driftErr }] = await Promise.all([
        supabase.from("scans").select("*").eq("org_id", orgId).order("started_at", { ascending: false }).limit(10),
        supabase.from("drift_items").select("*").eq("org_id", orgId).is("resolved_at", null).order("severity").limit(50),
      ]);
      if (scansErr) throw new Error(scansErr.message);
      if (driftErr) throw new Error(driftErr.message);
      setScans(scansData || []);
      setDrift(driftData || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!scanning) load(); }, [scanning, load]);

  const latestScan = scans[0];
  const critical = drift.filter(d => d.severity === "critical");
  const warning  = drift.filter(d => d.severity === "warning");
  const info     = drift.filter(d => d.severity === "info");

  const totalScans = scans.length;
  const successRate = totalScans > 0
    ? Math.round((scans.filter(s => s.status === "completed").length / totalScans) * 100)
    : null;

  return (
    <div className="fadeIn">
      <PageHeader
        title="Dashboard"
        subtitle={latestScan ? `Last scan ${fmt.relative(latestScan.started_at)} · ${latestScan.resources_checked} resources checked` : "No scans yet"}
        right={latestScan && <StatusBadge status={latestScan.status} />}
      />
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <StatCard label="Resources Tracked" value={latestScan?.resources_checked ?? "—"} sub="latest scan" loading={loading} />
        <StatCard label="Open Drift Items" value={drift.length} sub="unresolved" accent={drift.length > 0 ? "#d97706" : "#059669"} loading={loading} />
        <StatCard label="Critical" value={critical.length} sub="requires action" accent={critical.length > 0 ? "#dc2626" : "#059669"} loading={loading} />
        <StatCard label="Scan Success Rate" value={successRate !== null ? `${successRate}%` : "—"} sub="last 10 scans" accent={successRate >= 80 ? "#059669" : "#d97706"} loading={loading} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
        {[
          { sev: "critical", count: critical.length, label: "Critical", desc: "Missing or security-critical resource drift" },
          { sev: "warning",  count: warning.length,  label: "Warning",  desc: "Configuration drift that may cause incidents" },
          { sev: "info",     count: info.length,     label: "Info",     desc: "Minor tag or config deviations" },
        ].map(({ sev, count, label, desc }) => {
          const meta = severityMeta[sev];
          return (
            <div key={sev} onClick={() => setPage("drift")} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px 14px", cursor: "pointer", borderLeft: `3px solid ${meta.color}`, transition: "border 0.1s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = meta.color}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#e5e7eb"}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: meta.color, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
                <span style={{ fontSize: 22, fontWeight: 700, color: loading ? "#e5e7eb" : count > 0 ? meta.color : "#9ca3af" }}>{loading ? "—" : count}</span>
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.4 }}>{desc}</div>
            </div>
          );
        })}
      </div>
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Recent Drift Items</span>
          <Btn variant="ghost" size="sm" onClick={() => setPage("drift")}>View all →</Btn>
        </div>
        <DriftTable items={drift.slice(0, 6)} loading={loading} compact />
      </div>
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Recent Scans</span>
          <Btn variant="ghost" size="sm" onClick={() => setPage("scans")}>View all →</Btn>
        </div>
        <ScansTable scans={scans.slice(0, 4)} loading={loading} compact />
      </div>
    </div>
  );
};

const ScansPage = ({ orgId }) => {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [range, setRange] = useState("30");

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - parseInt(range));
    supabase.from("scans").select("*").eq("org_id", orgId).gte("started_at", since.toISOString()).order("started_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setScans(data || []);
        setLoading(false);
      });
  }, [orgId, range]);

  return (
    <div className="fadeIn">
      <PageHeader
        title="Scan History"
        subtitle="All infrastructure scans — expand rows to view drift details"
        right={
          <SelectInput value={range} onChange={setRange} options={[
            { value: "7", label: "Last 7 days" },
            { value: "30", label: "Last 30 days" },
            { value: "90", label: "Last 90 days" },
          ]} />
        }
      />
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
        <ScansTable scans={scans} loading={loading} />
      </div>
    </div>
  );
};

const DriftPage = ({ orgId }) => {
  const [drift, setDrift] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sevFilter, setSevFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [scanMap, setScanMap] = useState({});

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    supabase.from("drift_items").select("*").eq("org_id", orgId).is("resolved_at", null).order("severity").order("created_at", { ascending: false })
      .then(async ({ data, error }) => {
        if (error) { setError(error.message); setLoading(false); return; }
        const items = data || [];
        setDrift(items);
        const scanIds = [...new Set(items.map(d => d.scan_id))];
        if (scanIds.length > 0) {
          const { data: scans } = await supabase.from("scans").select("id, started_at").in("id", scanIds);
          const map = {};
          (scans || []).forEach(s => { map[s.id] = s; });
          setScanMap(map);
        }
        setLoading(false);
      });
  }, [orgId]);

  const filtered = drift.filter(d => {
    if (sevFilter !== "all" && d.severity !== sevFilter) return false;
    if (typeFilter !== "all" && d.drift_type !== typeFilter) return false;
    return true;
  });

  const resourceTypes = [...new Set(drift.map(d => d.resource_type))];

  return (
    <div className="fadeIn">
      <PageHeader
        title="Drift Items"
        subtitle={`${drift.length} open items — expand any row to view config diff`}
        right={<Btn variant="secondary" size="sm" onClick={() => {
          const rows = [["severity","drift_type","resource_type","resource_id","summary","detected"]];
          drift.forEach(d => rows.push([d.severity, d.drift_type, d.resource_type, d.resource_id, d.diff_summary || "", d.created_at || ""]));
          const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
          const a = document.createElement("a");
          a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
          a.download = "drift-items.csv";
          a.click();
        }}>↓ Export CSV</Btn>}
      />
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {["all", "critical", "warning", "info"].map(sev => {
          const active = sevFilter === sev;
          const meta = severityMeta[sev];
          return (
            <button key={sev} onClick={() => setSevFilter(sev)} style={{
              padding: "4px 12px", borderRadius: 5, border: "1px solid",
              fontSize: 12, fontWeight: 500, cursor: "pointer",
              background: active ? (meta?.bg || "#f5f3ff") : "#fff",
              color: active ? (meta?.color || "#4f46e5") : "#6b7280",
              borderColor: active ? (meta?.border || "#c4b5fd") : "#e5e7eb",
            }}>
              {sev === "all" ? "All" : sev.charAt(0).toUpperCase() + sev.slice(1)}
            </button>
          );
        })}
        <SelectInput value={typeFilter} onChange={setTypeFilter} options={[
          { value: "all", label: "All types" },
          { value: "MISSING", label: "Missing" },
          { value: "UNMANAGED", label: "Unmanaged" },
          { value: "DRIFTED", label: "Drifted" },
        ]} />
        {resourceTypes.length > 0 && (
          <SelectInput value="all" onChange={() => {}} options={[
            { value: "all", label: "All resource types" },
            ...resourceTypes.map(t => ({ value: t, label: t })),
          ]} />
        )}
      </div>
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", background: "#f9fafb", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "#6b7280" }}>Showing {filtered.length} of {drift.length} items</span>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>Click any row to expand diff →</span>
        </div>
        <DriftTable items={filtered} loading={loading} scanMap={scanMap} />
      </div>
    </div>
  );
};

const SettingsCard = ({ title, desc, children, action }) => (
  <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: 16, overflow: "hidden" }}>
    <div style={{ padding: "14px 16px", borderBottom: "1px solid #f3f4f6" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{title}</div>
      {desc && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{desc}</div>}
    </div>
    <div style={{ padding: "16px" }}>{children}</div>
    {action && (
      <div style={{ padding: "12px 16px", background: "#f9fafb", borderTop: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {action}
      </div>
    )}
  </div>
);

const ConnectedBadge = ({ connected }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600,
    padding: "2px 8px", borderRadius: 4,
    color: connected ? "#059669" : "#6b7280",
    background: connected ? "#ecfdf5" : "#f3f4f6",
    border: `1px solid ${connected ? "#a7f3d0" : "#e5e7eb"}`,
    textTransform: "uppercase", letterSpacing: "0.04em",
  }}>
    <span style={{ width: 5, height: 5, borderRadius: "50%", background: connected ? "#10b981" : "#9ca3af" }} />
    {connected ? "Connected" : "Not connected"}
  </span>
);

const SettingsPage = ({ orgId, org }) => {
  const [activeTab, setActiveTab] = useState("aws");
  const [awsConn, setAwsConn] = useState(null);
  const [stateBackend, setStateBackend] = useState(null);
  const [slackConn, setSlackConn] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    if (!orgId) return;
    Promise.all([
      supabase.from("aws_connections").select("*").eq("org_id", orgId).maybeSingle(),
      supabase.from("state_backends").select("*").eq("org_id", orgId).maybeSingle(),
      supabase.from("slack_connections").select("*").eq("org_id", orgId).maybeSingle(),
    ]).then(([aws, state, slack]) => {
      setAwsConn(aws.data);
      setStateBackend(state.data);
      setSlackConn(slack.data);
    });
  }, [orgId]);

  const tabs = [
    { id: "aws", label: "AWS Connection" },
    { id: "state", label: "State Backend" },
    { id: "slack", label: "Slack" },
    { id: "schedule", label: "Schedule" },
    { id: "billing", label: "Billing" },
  ];

  return (
    <div className="fadeIn">
      <PageHeader title="Settings" subtitle="Configure integrations, schedule, and billing" />
      {toast && (
        <div style={{ padding: "10px 14px", background: toast.type === "error" ? "#fef2f2" : "#ecfdf5", border: `1px solid ${toast.type === "error" ? "#fecaca" : "#a7f3d0"}`, borderRadius: 6, fontSize: 12, color: toast.type === "error" ? "#dc2626" : "#059669", marginBottom: 16 }}>
          {toast.type === "error" ? "✗" : "✓"} {toast.msg}
        </div>
      )}
      <div style={{ display: "flex", marginBottom: 20, borderBottom: "1px solid #e5e7eb" }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: "8px 16px", border: "none", background: "transparent", cursor: "pointer",
            fontSize: 13, fontWeight: 500, color: activeTab === tab.id ? "#4f46e5" : "#6b7280",
            borderBottom: `2px solid ${activeTab === tab.id ? "#4f46e5" : "transparent"}`,
            marginBottom: -1, transition: "all 0.1s",
          }}>{tab.label}</button>
        ))}
      </div>
      {activeTab === "aws" && <SettingsAWS orgId={orgId} conn={awsConn} onSave={c => { setAwsConn(c); showToast("AWS connection saved"); }} onError={e => showToast(e, "error")} />}
      {activeTab === "state" && <SettingsState orgId={orgId} backend={stateBackend} onSave={b => { setStateBackend(b); showToast("State backend saved"); }} onError={e => showToast(e, "error")} />}
      {activeTab === "slack" && <SettingsSlack orgId={orgId} conn={slackConn} onSave={c => { setSlackConn(c); showToast("Slack connected — test message sent"); }} onError={e => showToast(e, "error")} />}
      {activeTab === "schedule" && <SettingsSchedule orgId={orgId} org={org} onSave={() => showToast("Schedule updated")} onError={e => showToast(e, "error")} />}
      {activeTab === "billing" && <SettingsBilling org={org} />}
    </div>
  );
};

const SettingsAWS = ({ orgId, conn, onSave, onError }) => {
  const [authMode, setAuthMode] = useState(conn?.auth_mode || "role");
  const [roleArn, setRoleArn] = useState(conn?.role_arn || "");
  const [accessKey, setAccessKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [region, setRegion] = useState(conn?.region || "us-east-1");
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (conn) { setAuthMode(conn.auth_mode || "role"); setRoleArn(conn.role_arn || ""); setRegion(conn.region || "us-east-1"); }
  }, [conn]);

  const verify = async () => {
    setVerifying(true);
    try {
      const res = await fetch("/api/connections/aws", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: orgId, auth_mode: authMode, role_arn: roleArn, region, access_key: accessKey, secret_key: secretKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      onSave({ ...conn, auth_mode: authMode, role_arn: roleArn, region, verified_at: new Date().toISOString() });
    } catch (e) {
      onError(e.message);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <SettingsCard
      title="AWS Authentication"
      desc="DriftWatch uses read-only access to compare live infrastructure against Terraform state."
      action={
        <>
          <ConnectedBadge connected={!!conn?.verified_at} />
          <Btn variant="primary" onClick={verify} disabled={verifying}>
            {verifying ? <><Spinner size={12} />Verifying & saving...</> : conn?.verified_at ? "Re-verify connection" : "Verify & save"}
          </Btn>
        </>
      }
    >
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["role", "keys"].map(m => (
          <button key={m} onClick={() => setAuthMode(m)} style={{
            padding: "5px 14px", borderRadius: 5, border: "1px solid", fontSize: 12, fontWeight: 500, cursor: "pointer",
            background: authMode === m ? "#f5f3ff" : "#fff", color: authMode === m ? "#4f46e5" : "#6b7280",
            borderColor: authMode === m ? "#c4b5fd" : "#e5e7eb",
          }}>
            {m === "role" ? "IAM Role (recommended)" : "Access Keys"}
          </button>
        ))}
      </div>
      {authMode === "role" ? (
        <div style={{ display: "grid", gap: 12 }}>
          <Input label="IAM Role ARN" value={roleArn} onChange={setRoleArn} monospace placeholder="arn:aws:iam::123456789012:role/DriftWatchRole" />
          <div style={{ padding: "10px 12px", background: "#f8f9fa", border: "1px solid #e5e7eb", borderRadius: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Required IAM permissions</div>
            <code style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.8, display: "block" }}>
              ec2:Describe* · rds:Describe* · s3:GetObject · s3:GetBucketVersioning<br />
              lambda:ListFunctions · ecs:Describe* · ecs:List* · iam:GetRole · sts:GetCallerIdentity
            </code>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          <Input label="Access Key ID" monospace placeholder="AKIAIOSFODNN7EXAMPLE" value={accessKey} onChange={setAccessKey} />
          <Input label="Secret Access Key" type="password" monospace placeholder="••••••••••••••••••••••••••••••••••••••••" value={secretKey} onChange={setSecretKey} />
          <div style={{ padding: "8px 10px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 5, fontSize: 11, color: "#92400e" }}>
            ⚠ Credentials are encrypted with AES-256-GCM before storage. IAM roles are recommended for production.
          </div>
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        <SelectInput label="AWS Region" value={region} onChange={setRegion} options={[
          { value: "us-east-1", label: "us-east-1 (N. Virginia)" },
          { value: "us-west-2", label: "us-west-2 (Oregon)" },
          { value: "eu-west-1", label: "eu-west-1 (Ireland)" },
          { value: "eu-central-1", label: "eu-central-1 (Frankfurt)" },
          { value: "ap-southeast-1", label: "ap-southeast-1 (Singapore)" },
          { value: "ap-northeast-1", label: "ap-northeast-1 (Tokyo)" },
        ]} />
      </div>
    </SettingsCard>
  );
};

const SettingsState = ({ orgId, backend, onSave, onError }) => {
  const [bucket, setBucket] = useState(backend?.bucket || "");
  const [key, setKey] = useState(backend?.key || "");
  const [region, setRegion] = useState(backend?.region || "us-east-1");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (backend) { setBucket(backend.bucket || ""); setKey(backend.key || ""); setRegion(backend.region || "us-east-1"); }
  }, [backend]);

  const verify = async () => {
    setVerifying(true);
    try {
      const res = await fetch("/api/connections/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: orgId, bucket, key, region }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      onSave({ ...backend, bucket, key, region, verified_at: new Date().toISOString() });
    } catch (e) {
      onError(e.message);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <SettingsCard
      title="Terraform State Backend"
      desc="S3 bucket where your Terraform state file is stored."
      action={
        <>
          <ConnectedBadge connected={!!backend?.verified_at} />
          <Btn variant="primary" onClick={verify} disabled={verifying || !bucket || !key}>
            {verifying ? <><Spinner size={12} />Verifying...</> : backend?.verified_at ? "Re-verify" : "Verify & save"}
          </Btn>
        </>
      }
    >
      <div style={{ display: "grid", gap: 12 }}>
        <Input label="S3 Bucket Name" value={bucket} onChange={setBucket} monospace placeholder="my-terraform-state-bucket" />
        <Input label="State File Key" value={key} onChange={setKey} monospace placeholder="prod/terraform.tfstate" helper="Relative path to the .tfstate file within the bucket" />
        <SelectInput label="Bucket Region" value={region} onChange={setRegion} options={[
          { value: "us-east-1", label: "us-east-1" },
          { value: "us-west-2", label: "us-west-2" },
          { value: "eu-west-1", label: "eu-west-1" },
          { value: "eu-central-1", label: "eu-central-1" },
          { value: "ap-southeast-1", label: "ap-southeast-1" },
        ]} />
      </div>
    </SettingsCard>
  );
};

const SettingsSlack = ({ orgId, conn, onSave, onError }) => {
  const [webhook, setWebhook] = useState("");
  const [channel, setChannel] = useState(conn?.channel || "");
  const [verifying, setVerifying] = useState(false);

  const verify = async () => {
    setVerifying(true);
    try {
      const res = await fetch("/api/connections/slack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: orgId, webhook_url: webhook, channel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      onSave({ ...conn, channel, verified_at: new Date().toISOString() });
    } catch (e) {
      onError(e.message);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <SettingsCard
      title="Slack Notifications"
      desc="Receive drift alerts in your Slack workspace. A test message is sent on save."
      action={
        <>
          <ConnectedBadge connected={!!conn?.verified_at} />
          <Btn variant="primary" onClick={verify} disabled={verifying || !webhook}>
            {verifying ? <><Spinner size={12} />Connecting...</> : conn?.verified_at ? "Update & test" : "Connect & test"}
          </Btn>
        </>
      }
    >
      <div style={{ display: "grid", gap: 12 }}>
        <Input label="Webhook URL" value={webhook} onChange={setWebhook} monospace type="password" placeholder="https://hooks.slack.com/services/..." />
        <Input label="Channel" value={channel} onChange={setChannel} placeholder="#infra-alerts" helper="Optional — for display purposes only" />
        <div style={{ padding: "12px", background: "#0d1117", border: "1px solid #21262d", borderRadius: 6 }}>
          <div style={{ fontSize: 10, color: "#8b949e", fontFamily: "monospace", marginBottom: 8 }}>MESSAGE FORMAT PREVIEW</div>
          <div style={{ fontFamily: "monospace", fontSize: 11, color: "#e6edf3", lineHeight: 1.8 }}>
            <div style={{ fontWeight: 700 }}>🔍 DriftWatch Scan Complete — Your Org</div>
            <div style={{ color: "#8b949e" }}>247 resources scanned • 3 drift items • 1 critical</div>
            <div style={{ marginTop: 4 }}>🔴 MISSING | aws_instance | i-0abc123def456</div>
            <div>🟡 DRIFTED | aws_security_group | sg-0f1a2b3c4d</div>
            <div style={{ color: "#8b949e", marginTop: 4 }}>View full report → your-app.vercel.app/scans/…</div>
          </div>
        </div>
      </div>
    </SettingsCard>
  );
};

const SettingsSchedule = ({ orgId, org, onSave, onError }) => {
  const [freq, setFreq] = useState(org?.scan_schedule || "24h");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (org?.scan_schedule) setFreq(org.scan_schedule); }, [org]);

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("organizations").update({ scan_schedule: freq }).eq("id", orgId);
      if (error) throw new Error(error.message);
      onSave();
    } catch (e) {
      onError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const freqs = [
    { value: "1h",     label: "Every hour",    plan: "Pro" },
    { value: "6h",     label: "Every 6 hours", plan: "Pro" },
    { value: "24h",    label: "Daily",          plan: "Starter" },
    { value: "manual", label: "Manual only",    plan: "Starter" },
  ];

  return (
    <SettingsCard
      title="Scan Schedule"
      desc="How often DriftWatch checks your infrastructure against Terraform state."
      action={
        <>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>Scans run at the top of each interval (UTC)</span>
          <Btn variant="primary" onClick={save} disabled={saving}>
            {saving ? <><Spinner size={12} />Saving...</> : "Save schedule"}
          </Btn>
        </>
      }
    >
      <div style={{ display: "grid", gap: 8 }}>
        {freqs.map(f => (
          <label key={f.value} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 12px", borderRadius: 6, border: "1px solid",
            borderColor: freq === f.value ? "#c4b5fd" : "#e5e7eb",
            background: freq === f.value ? "#f5f3ff" : "#fff",
            cursor: "pointer",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input type="radio" checked={freq === f.value} onChange={() => setFreq(f.value)} style={{ accentColor: "#4f46e5" }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{f.label}</span>
            </div>
            <span style={{ fontSize: 11, color: "#9ca3af" }}>{f.plan} plan+</span>
          </label>
        ))}
      </div>
    </SettingsCard>
  );
};

const SettingsBilling = ({ org }) => {
  const plans = [
    { name: "Starter", price: 29, features: ["1 AWS account", "1 state backend", "Daily scans", "Slack alerts", "30-day history"], key: "starter" },
    { name: "Pro",     price: 99, features: ["5 AWS accounts", "Unlimited backends", "Hourly scans", "Slack + email", "90-day history", "API access"], key: "pro" },
    { name: "Team",    price: 299, features: ["Unlimited accounts", "5-min scans", "SSO", "Custom webhooks", "1-year history", "Priority support"], key: "team" },
  ];
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        {plans.map(plan => {
          const current = org?.plan === plan.key;
          return (
            <div key={plan.name} style={{ background: "#fff", border: `1px solid ${current ? "#4f46e5" : "#e5e7eb"}`, borderRadius: 8, padding: "16px", position: "relative", boxShadow: current ? "0 0 0 1px #4f46e5" : "none" }}>
              {current && <div style={{ position: "absolute", top: -1, right: 12, background: "#4f46e5", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: "0 0 5px 5px", letterSpacing: "0.04em" }}>CURRENT</div>}
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 4 }}>{plan.name}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 12 }}>
                ${plan.price}<span style={{ fontSize: 13, fontWeight: 400, color: "#9ca3af" }}>/mo</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 16 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ fontSize: 12, color: "#6b7280", display: "flex", gap: 6 }}>
                    <span style={{ color: "#059669", flexShrink: 0 }}>✓</span> {f}
                  </div>
                ))}
              </div>
              <Btn variant={current ? "secondary" : "primary"} style={{ width: "100%", justifyContent: "center" }}>
                {current ? "Manage subscription" : "Upgrade"}
              </Btn>
            </div>
          );
        })}
      </div>
      {org && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "14px 16px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Current plan</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 3 }}>Plan</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", textTransform: "capitalize" }}>{org.plan} · ${org.plan === "starter" ? 29 : org.plan === "pro" ? 99 : 299}/mo</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 3 }}>Status</div>
              <StatusBadge status={org.plan_status === "active" ? "completed" : org.plan_status === "trialing" ? "running" : "failed"} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 3 }}>Member since</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{fmt.ts(org.created_at)}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const OnboardingPage = ({ onComplete, orgId }) => {
  const [step, setStep] = useState(0);
  const [stepData, setStepData] = useState({ roleArn: "", region: "us-east-1", bucket: "", key: "", webhook: "", channel: "" });
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState([false, false, false]);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);

  const steps = ["Connect AWS", "State Backend", "Slack Alerts", "First Scan"];

  const verifyStep = async (idx) => {
    setError(null);
    setVerifying(true);
    try {
      let endpoint, payload;
      if (idx === 0) {
        endpoint = "/api/connections/aws";
        payload = { org_id: orgId, auth_mode: "role", role_arn: stepData.roleArn, region: stepData.region };
      } else if (idx === 1) {
        endpoint = "/api/connections/state";
        payload = { org_id: orgId, bucket: stepData.bucket, key: stepData.key, region: stepData.region };
      } else {
        endpoint = "/api/connections/slack";
        payload = { org_id: orgId, webhook_url: stepData.webhook, channel: stepData.channel };
      }
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      setVerified(v => { const n = [...v]; n[idx] = true; return n; });
    } catch (e) {
      setError(e.message);
    } finally {
      setVerifying(false);
    }
  };

  const runFirstScan = async () => {
    setScanning(true);
    setError(null);
    try {
      const res = await fetch("/api/scans/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ org_id: orgId, triggered_by: "manual" }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");
      setScanResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 560 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
          <div style={{ width: 32, height: 32, borderRadius: 7, background: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 16 }}>D</div>
          <span style={{ fontWeight: 700, fontSize: 16, color: "#111827" }}>DriftWatch</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 28 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, background: i < step ? "#4f46e5" : i === step ? "#f5f3ff" : "#fff", borderColor: i <= step ? "#4f46e5" : "#e5e7eb", color: i < step ? "#fff" : i === step ? "#4f46e5" : "#9ca3af", transition: "all 0.2s" }}>
                  {i < step ? "✓" : i + 1}
                </div>
                <span style={{ fontSize: 10, color: i === step ? "#4f46e5" : "#9ca3af", fontWeight: i === step ? 600 : 400, whiteSpace: "nowrap" }}>{s}</span>
              </div>
              {i < steps.length - 1 && <div style={{ flex: 1, height: 1, background: i < step ? "#4f46e5" : "#e5e7eb", margin: "0 8px", marginBottom: 16 }} />}
            </div>
          ))}
        </div>
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
          {step === 0 && (
            <OnboardStep title="Connect AWS Account" desc="Grant DriftWatch read-only access to your AWS account via an IAM role." onVerify={() => verifyStep(0)} verified={verified[0]} verifying={verifying} onNext={() => setStep(1)}>
              <Input label="IAM Role ARN" monospace placeholder="arn:aws:iam::123456789012:role/DriftWatchRole" value={stepData.roleArn} onChange={v => setStepData(d => ({ ...d, roleArn: v }))} helper="Create a role with the permissions listed in README.md" />
              <div style={{ marginTop: 10 }}>
                <SelectInput label="Primary Region" value={stepData.region} onChange={v => setStepData(d => ({ ...d, region: v }))} options={[
                  { value: "us-east-1", label: "us-east-1 (N. Virginia)" },
                  { value: "us-west-2", label: "us-west-2 (Oregon)" },
                  { value: "eu-west-1", label: "eu-west-1 (Ireland)" },
                  { value: "ap-southeast-1", label: "ap-southeast-1 (Singapore)" },
                ]} />
              </div>
            </OnboardStep>
          )}
          {step === 1 && (
            <OnboardStep title="Connect Terraform State" desc="Point DriftWatch to your Terraform state file in S3." onVerify={() => verifyStep(1)} verified={verified[1]} verifying={verifying} onNext={() => setStep(2)}>
              <Input label="S3 Bucket" monospace placeholder="my-terraform-state" value={stepData.bucket} onChange={v => setStepData(d => ({ ...d, bucket: v }))} />
              <div style={{ marginTop: 10 }}>
                <Input label="State File Key" monospace placeholder="prod/terraform.tfstate" value={stepData.key} onChange={v => setStepData(d => ({ ...d, key: v }))} helper="Path to the .tfstate file within the bucket" />
              </div>
            </OnboardStep>
          )}
          {step === 2 && (
            <OnboardStep title="Connect Slack" desc="Get drift alerts delivered to your team's Slack channel." onVerify={() => verifyStep(2)} verified={verified[2]} verifying={verifying} onNext={() => setStep(3)} nextLabel="Run first scan →">
              <Input label="Incoming Webhook URL" monospace type="password" placeholder="https://hooks.slack.com/services/..." value={stepData.webhook} onChange={v => setStepData(d => ({ ...d, webhook: v }))} />
              <div style={{ marginTop: 10 }}>
                <Input label="Channel" placeholder="#infra-alerts" value={stepData.channel} onChange={v => setStepData(d => ({ ...d, channel: v }))} />
              </div>
            </OnboardStep>
          )}
          {step === 3 && (
            <div style={{ padding: "28px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{scanResult ? "✅" : "🔍"}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 6 }}>
                {scanResult ? "First scan complete!" : "Ready to scan your infrastructure"}
              </div>
              <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 24, lineHeight: 1.5 }}>
                {scanResult
                  ? `Found ${scanResult.drift_count} drift item(s) — ${scanResult.critical_count} critical. Head to your dashboard to review.`
                  : "DriftWatch will compare your Terraform state against live AWS resources and report any differences."}
              </div>
              {!scanResult ? (
                <Btn variant="primary" onClick={runFirstScan} disabled={scanning} style={{ justifyContent: "center", padding: "10px 24px" }}>
                  {scanning ? <><Spinner size={14} />Scanning infrastructure...</> : "⊙ Run first scan"}
                </Btn>
              ) : (
                <Btn variant="primary" onClick={onComplete} style={{ justifyContent: "center", padding: "10px 24px" }}>Go to Dashboard →</Btn>
              )}
              {scanning && <div style={{ marginTop: 16, fontSize: 12, color: "#9ca3af" }}>Checking EC2 · RDS · S3 · Lambda · ECS · VPC…</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const OnboardStep = ({ title, desc, children, onVerify, verified, verifying, onNext, nextLabel = "Continue →" }) => (
  <div>
    <div style={{ padding: "20px 24px", borderBottom: "1px solid #f3f4f6" }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{title}</div>
      <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 3 }}>{desc}</div>
    </div>
    <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 0 }}>{children}</div>
    <div style={{ padding: "14px 24px", background: "#f9fafb", borderTop: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Btn variant="secondary" onClick={onVerify} disabled={verifying}>
          {verifying ? <><Spinner size={12} />Verifying...</> : verified ? "✓ Verified" : "Verify connection"}
        </Btn>
        {verified && <span style={{ fontSize: 12, color: "#059669", fontWeight: 500 }}>✓ Connection successful</span>}
      </div>
      <Btn variant="primary" onClick={onNext} disabled={!verified}>{nextLabel}</Btn>
    </div>
  </div>
);

const LandingPage = ({ onGetStarted, onLogin }) => (
  <div style={{ minHeight: "100vh", background: "#fff" }}>
    <nav style={{ borderBottom: "1px solid #e5e7eb", padding: "0 48px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "rgba(255,255,255,0.96)", backdropFilter: "blur(8px)", zIndex: 100 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14 }}>D</div>
        <span style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>DriftWatch</span>
      </div>
      <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
        {["Product", "Pricing", "Docs"].map(l => (
          <span key={l} style={{ fontSize: 13, color: "#6b7280", cursor: "pointer", fontWeight: 500 }}>{l}</span>
        ))}
        <Btn variant="secondary" size="sm" onClick={onLogin}>Sign in</Btn>
        <Btn variant="primary" size="sm" onClick={onGetStarted}>Get started free</Btn>
      </div>
    </nav>
    <section style={{ maxWidth: 920, margin: "0 auto", padding: "80px 48px 64px", textAlign: "center" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 5, background: "#f5f3ff", border: "1px solid #c4b5fd", fontSize: 11, fontWeight: 600, color: "#4f46e5", marginBottom: 24, letterSpacing: "0.04em" }}>
        ● LIVE · Infrastructure drift detection in real-time
      </div>
      <h1 style={{ fontSize: 48, fontWeight: 800, color: "#111827", lineHeight: 1.1, letterSpacing: "-0.03em", marginBottom: 20 }}>
        Terraform drift,<br />caught before it costs you.
      </h1>
      <p style={{ fontSize: 17, color: "#6b7280", lineHeight: 1.6, maxWidth: 560, margin: "0 auto 36px" }}>
        DriftWatch continuously compares your live AWS infrastructure against Terraform state. Catch unauthorized changes, missing resources, and configuration drift — before your 2am incident.
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        <Btn variant="primary" onClick={onGetStarted} style={{ padding: "10px 24px", fontSize: 14 }}>Start free trial →</Btn>
        <Btn variant="secondary" style={{ padding: "10px 24px", fontSize: 14 }}>
          <span style={{ fontFamily: "monospace", fontSize: 12 }}>POST /api/scans/run</span>
        </Btn>
      </div>
      <div style={{ marginTop: 20, fontSize: 12, color: "#9ca3af" }}>No credit card required · 14-day free trial · Setup in 5 minutes</div>
    </section>
    <section style={{ background: "#f9fafb", borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb", padding: "64px 48px" }}>
      <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>How it works</div>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em", marginBottom: 48 }}>Four steps, zero guesswork.</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
          {[
            { n: "01", title: "Connect AWS", body: "Provide an IAM role ARN. DriftWatch assumes it to read your live infrastructure." },
            { n: "02", title: "Point to state", body: "Tell us your S3 bucket and key. We parse the .tfstate JSON directly." },
            { n: "03", title: "Scheduled scans", body: "On your cadence — hourly, daily, or via API — we diff state vs reality." },
            { n: "04", title: "Alert your team", body: "Severity-labeled drift delivered to Slack within seconds of detection." },
          ].map(s => (
            <div key={s.n} style={{ textAlign: "left" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#4f46e5", fontFamily: "monospace", marginBottom: 8 }}>{s.n}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 6 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.6 }}>{s.body}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
    <section style={{ maxWidth: 900, margin: "0 auto", padding: "72px 48px" }}>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>Pricing</div>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em" }}>Simple, transparent pricing.</h2>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {[
          { name: "Starter", price: 29, desc: "For small teams getting started", features: ["1 AWS account", "1 state backend", "Daily scans", "Slack alerts", "30-day history"], cta: "Start free trial" },
          { name: "Pro", price: 99, desc: "For teams that ship infrastructure daily", features: ["5 AWS accounts", "Unlimited backends", "Hourly scans", "Slack + email", "90-day history", "API access"], cta: "Start free trial", highlight: true },
          { name: "Team", price: 299, desc: "For enterprise DevOps organizations", features: ["Unlimited accounts", "5-minute scans", "SSO / SAML", "Custom webhooks", "1-year history", "Priority support"], cta: "Contact sales" },
        ].map(plan => (
          <div key={plan.name} style={{ border: `1px solid ${plan.highlight ? "#4f46e5" : "#e5e7eb"}`, borderRadius: 10, padding: "24px", background: "#fff", boxShadow: plan.highlight ? "0 0 0 1px #4f46e5, 0 4px 16px rgba(79,70,229,0.1)" : "none" }}>
            {plan.highlight && <div style={{ fontSize: 10, fontWeight: 700, color: "#4f46e5", background: "#f5f3ff", border: "1px solid #c4b5fd", borderRadius: 4, padding: "2px 8px", display: "inline-block", marginBottom: 12, letterSpacing: "0.06em" }}>MOST POPULAR</div>}
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{plan.name}</div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2, marginBottom: 16 }}>{plan.desc}</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em", marginBottom: 20 }}>
              ${plan.price}<span style={{ fontSize: 14, fontWeight: 400, color: "#9ca3af" }}>/mo</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              {plan.features.map(f => (
                <div key={f} style={{ display: "flex", gap: 8, fontSize: 12, color: "#374151" }}>
                  <span style={{ color: "#059669", flexShrink: 0 }}>✓</span> {f}
                </div>
              ))}
            </div>
            <Btn variant={plan.highlight ? "primary" : "secondary"} onClick={onGetStarted} style={{ width: "100%", justifyContent: "center" }}>{plan.cta}</Btn>
          </div>
        ))}
      </div>
    </section>
    <footer style={{ borderTop: "1px solid #e5e7eb", padding: "24px 48px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 20, height: 20, borderRadius: 4, background: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 10 }}>D</div>
        <span style={{ fontSize: 12, color: "#6b7280" }}>© 2026 DriftWatch · Built for DevOps teams</span>
      </div>
      <div style={{ display: "flex", gap: 20 }}>
        {["Privacy", "Terms", "Status", "Docs"].map(l => (
          <span key={l} style={{ fontSize: 12, color: "#9ca3af", cursor: "pointer" }}>{l}</span>
        ))}
      </div>
    </footer>
  </div>
);

export default function DriftWatch() {
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState("landing");
  const [page, setPage] = useState("dashboard");
  const [org, setOrg] = useState(null);
  const [orgId, setOrgId] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState(null);
  const [openDriftCount, setOpenDriftCount] = useState(0);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  useEffect(() => {
    if (view !== "app" || !orgId) return;
    supabase.from("scans").select("*").eq("org_id", orgId).order("started_at", { ascending: false }).limit(1)
      .then(({ data }) => { if (data?.[0]) setLastScan(data[0]); });
    supabase.from("drift_items").select("id", { count: "exact", head: true }).eq("org_id", orgId).is("resolved_at", null)
      .then(({ count }) => { setOpenDriftCount(count || 0); });
  }, [view, orgId, scanning]);

  useEffect(() => {
    if (view !== "app") return;
    if (!orgId) {
      supabase.from("organizations").select("*").limit(1).maybeSingle().then(({ data }) => {
        if (data) { setOrg(data); setOrgId(data.id); }
      });
    }
  }, [view, orgId]);

  const runScan = async () => {
    if (scanning || !orgId) return;
    setScanning(true);
    try {
      const res = await fetch("/api/scans/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: orgId, triggered_by: "manual" }),
      });
      const data = await res.json();
      if (res.ok && data.scan) setLastScan(data.scan);
    } catch (e) {
      console.error("Scan failed:", e);
    } finally {
      setScanning(false);
    }
  };

  if (view === "landing") {
    return (
      <>
        <style>{FONTS}{css}</style>
        <LandingPage onGetStarted={() => setView("onboarding")} onLogin={() => setView("app")} />
      </>
    );
  }

  if (view === "onboarding") {
    return (
      <>
        <style>{FONTS}{css}</style>
        <OnboardingPage orgId={orgId} onComplete={() => setView("app")} />
      </>
    );
  }

  return (
    <>
      <style>{FONTS}{css}</style>
      <div style={{ display: "flex", minHeight: "100vh", background: "#f9fafb" }}>
        <Sidebar page={page} setPage={setPage} scanning={scanning} onScan={runScan} lastScan={lastScan} openDriftCount={openDriftCount} org={org} />
        <main style={{ flex: 1, padding: 24, overflowX: "hidden", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid #f3f4f6" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {org && <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>{org.name}</div>}
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#f3f4f6", border: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#374151" }}>
                {org?.name?.slice(0, 2).toUpperCase() || "??"}
              </div>
            </div>
          </div>
          {!orgId && (
            <div style={{ padding: "40px 24px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
              <div style={{ marginBottom: 12, fontSize: 24 }}>⚙</div>
              No organization found. Make sure you've run the database schema and have an org record in Supabase.
            </div>
          )}
          {orgId && page === "dashboard" && <DashboardPage orgId={orgId} scanning={scanning} onRunScan={runScan} setPage={setPage} />}
          {orgId && page === "scans" && <ScansPage orgId={orgId} />}
          {orgId && page === "drift" && <DriftPage orgId={orgId} />}
          {orgId && page === "settings" && <SettingsPage orgId={orgId} org={org} />}
        </main>
      </div>
    </>
  );
}
