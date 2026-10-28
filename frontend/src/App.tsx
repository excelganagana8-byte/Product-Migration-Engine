import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  CloudDownload,
  Database,
  FileCheck2,
  FileText,
  Globe2,
  Layers3,
  Link2,
  LockKeyhole,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Store,
  TriangleAlert,
  Workflow,
  Zap,
} from "lucide-react";
type Connection = {
  id: string;
  name: string;
  platform: "SHOPIFY" | "WOOCOMMERCE";
  storeUrl: string;
};
type Job = {
  id: string;
  status: string;
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  currentActivity?: string;
  createdAt: string;
};
const API = "/api";
function App() {
  const [token, setToken] = useState(sessionStorage.getItem("pme-token") || "");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState("Overview");
  const [showConnect, setShowConnect] = useState(false);
  const [showToken, setShowToken] = useState(
    !sessionStorage.getItem("pme-token"),
  );
  const [platform, setPlatform] = useState<"SHOPIFY" | "WOOCOMMERCE">(
    "SHOPIFY",
  );
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [secretA, setSecretA] = useState("");
  const [secretB, setSecretB] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [scan, setScan] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [loadingLabel, setLoadingLabel] = useState("");
  const headers = useMemo(
    () => ({ "Content-Type": "application/json", "x-pme-admin-token": token }),
    [token],
  );
  async function api(path: string, init: RequestInit = {}) {
    const r = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        ...headers,
        ...((init.headers || {}) as Record<string, string>),
      },
    });
    const data = await r.json().catch(() => ({ error: r.statusText }));
    if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
    return data;
  }
  async function refresh() {
    if (!token) return;
    try {
      const [c, j] = await Promise.all([api("/connections"), api("/jobs")]);
      setConnections(c);
      setJobs(j);
      if (!sourceId && c.find((x: Connection) => x.platform === "SHOPIFY"))
        setSourceId(c.find((x: Connection) => x.platform === "SHOPIFY").id);
      if (!targetId && c.find((x: Connection) => x.platform === "WOOCOMMERCE"))
        setTargetId(c.find((x: Connection) => x.platform === "WOOCOMMERCE").id);
    } catch (e) {
      setNotice((e as Error).message);
      if ((e as Error).message.includes("token")) setShowToken(true);
    }
  }
  useEffect(() => {
    refresh();
  }, [token]);
  useEffect(() => {
    if (!token) return;
    const timer = setInterval(() => refresh(), 5000);
    return () => clearInterval(timer);
  }, [token]);
  async function run(label: string, fn: () => Promise<void>) {
    setBusy(true);
    setLoadingLabel(label);
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
      setLoadingLabel("");
    }
  }
  function saveToken() {
    sessionStorage.setItem("pme-token", token);
    setShowToken(false);
    refresh();
  }
  async function createConn() {
    await run("Testing and saving connection…", async () => {
      const credentials =
        platform === "SHOPIFY"
          ? { accessToken: secretA }
          : { consumerKey: secretA, consumerSecret: secretB };
      const c = await api("/connections", {
        method: "POST",
        body: JSON.stringify({ name, platform, storeUrl: url, credentials }),
      });
      await api(`/connections/${c.id}/test`, { method: "POST" });
      setShowConnect(false);
      setName("");
      setUrl("");
      setSecretA("");
      setSecretB("");
      await refresh();
      setNotice("Connection saved and tested successfully.");
    });
  }
  async function scanSource() {
    await run("Scanning Shopify catalog…", async () => {
      setScan(
        await api("/scan", {
          method: "POST",
          body: JSON.stringify({ sourceConnectionId: sourceId }),
        }),
      );
      setPage("Migration workspace");
    });
  }
  async function previewMigration() {
    await run("Preparing read-only preview…", async () => {
      setPreview(
        await api("/preview", {
          method: "POST",
          body: JSON.stringify({
            sourceConnectionId: sourceId,
            destinationConnectionId: targetId,
          }),
        }),
      );
      setPage("Migration workspace");
    });
  }
  async function startMigration() {
    await run("Queueing migration…", async () => {
      const job = await api("/jobs", {
        method: "POST",
        body: JSON.stringify({
          sourceConnectionId: sourceId,
          destinationConnectionId: targetId,
        }),
      });
      setActiveJob(job);
      setPage("Activity");
      await refresh();
      setNotice("Migration queued. Worker will process it in the background.");
    });
  }
  async function testConn(id: string) {
    await run("Testing connection…", async () => {
      await api(`/connections/${id}/test`, { method: "POST" });
      setNotice("Connection test passed.");
    });
  }
  const active = jobs.filter((j) =>
    ["QUEUED", "RUNNING", "PAUSED"].includes(j.status),
  );
  const done = jobs.filter((j) =>
    ["COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED", "CANCELLED"].includes(
      j.status,
    ),
  );
  const fmt = (s: string) => new Date(s).toLocaleString();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Workflow size={21} />
          </div>
          <div>
            <b>
              pme<span>.</span>
            </b>
            <small>PRODUCT MIGRATION ENGINE</small>
          </div>
        </div>
        <div className="workspace-pill">
          <div className="workspace-icon">
            <Layers3 size={16} />
          </div>
          <div>
            <b>Local workspace</b>
            <small>Self-hosted instance</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {[
            ["Overview", Activity],
            ["Migration workspace", Workflow],
            ["Store connections", Link2],
            ["Activity", Clock3],
          ].map(([label, Icon]: any) => (
            <button
              key={label}
              className={`nav-item ${page === label ? "selected" : ""}`}
              onClick={() => setPage(label)}
            >
              <Icon size={17} />
              <span>{label}</span>
              {label === "Activity" && active.length > 0 && (
                <i>{active.length}</i>
              )}
            </button>
          ))}
        </nav>
        <div className="nav-label tools-label">TOOLS</div>
        <button
          className={`nav-item ${page === "Settings" ? "selected" : ""}`}
          onClick={() => setPage("Settings")}
        >
          <Settings2 size={17} />
          <span>Settings</span>
        </button>
        <div className="sidebar-bottom">
          <div className="security-card">
            <div className="secure-icon">
              <ShieldCheck size={17} />
            </div>
            <b>Your data stays yours</b>
            <p>
              Credentials are encrypted at rest and never sent back to the
              browser.
            </p>
            <span>
              <LockKeyhole size={12} /> Self-hosted · Local-first
            </span>
          </div>
          <div className="profile">
            <div className="avatar">PM</div>
            <div>
              <b>Workspace admin</b>
              <small>Single-admin mode</small>
            </div>
            <button aria-label="Settings" onClick={() => setPage("Settings")}>
              <Settings2 size={16} />
            </button>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> <b>{page}</b>
          </div>
          <div className="top-actions">
            <span className="api-status">
              <span className="status-dot" /> API connection
            </span>
            <button className="icon-button" aria-label="Help">
              <CircleHelp size={17} />
            </button>
            <button className="admin-button" onClick={() => setShowToken(true)}>
              <div className="avatar mini">PM</div> Admin{" "}
              <ChevronDown size={14} />
            </button>
          </div>
        </header>
        {notice && (
          <div
            className={`notice ${notice.toLowerCase().includes("success") || notice.toLowerCase().includes("queued") ? "good" : ""}`}
            role="status"
          >
            <span>{notice}</span>
            <button onClick={() => setNotice("")}>×</button>
          </div>
        )}
        {page === "Overview" && (
          <section className="page-content">
            <div className="eyebrow">
              <span className="eyebrow-line" /> MIGRATION CONTROL CENTER
            </div>
            <div className="hero-row">
              <div>
                <h1>
                  Move your catalog.
                  <br />
                  <em>Keep your confidence.</em>
                </h1>
                <p className="lead">
                  A safer way to move products between platforms. Inspect every
                  detail, migrate with control, and know exactly what made it
                  across.
                </p>
              </div>
              <button
                className="primary-button"
                onClick={() => {
                  setPage("Migration workspace");
                  setShowConnect(connections.length < 2);
                }}
              >
                <Plus size={17} /> Start new migration <ArrowRight size={16} />
              </button>
            </div>
            <div className="route-card">
              <div className="route-label">
                <span className="route-live" /> SUPPORTED MIGRATION PATH
              </div>
              <div className="route-flow">
                <div className="platform-box">
                  <div className="platform-logo shopify">
                    <ShoppingBag size={24} />
                  </div>
                  <div>
                    <small>SOURCE PLATFORM</small>
                    <b>Shopify</b>
                    <span>
                      {connections.find((c) => c.platform === "SHOPIFY")
                        ?.name || "Connect your store"}
                    </span>
                  </div>
                  <div className="platform-check">
                    {connections.some((c) => c.platform === "SHOPIFY") ? (
                      <Check size={15} />
                    ) : (
                      <Plus size={15} />
                    )}
                  </div>
                </div>
                <div className="route-connector">
                  <div className="connector-line" />
                  <div className="connector-icon">
                    <ArrowRight size={17} />
                  </div>
                  <span>PRODUCTS + VARIANTS</span>
                </div>
                <div className="platform-box">
                  <div className="platform-logo woo">
                    <Store size={23} />
                  </div>
                  <div>
                    <small>DESTINATION PLATFORM</small>
                    <b>WooCommerce</b>
                    <span>
                      {connections.find((c) => c.platform === "WOOCOMMERCE")
                        ?.name || "Connect your store"}
                    </span>
                  </div>
                  <div className="platform-check woo-check">
                    {connections.some((c) => c.platform === "WOOCOMMERCE") ? (
                      <Check size={15} />
                    ) : (
                      <Plus size={15} />
                    )}
                  </div>
                </div>
              </div>
              <div className="route-footer">
                <span>
                  <ShieldCheck size={15} /> Preview before writing
                </span>
                <span>
                  <RefreshCw size={14} /> Recoverable job state
                </span>
                <span>
                  <FileCheck2 size={15} /> Transparent results
                </span>
                <button
                  onClick={() => {
                    setPage("Store connections");
                    setShowConnect(true);
                  }}
                >
                  Manage connections <ArrowRight size={14} />
                </button>
              </div>
            </div>
            <div className="section-head">
              <div>
                <h2>Workspace overview</h2>
                <p>Real numbers from your migration activity.</p>
              </div>
              <span className="updated">
                <RefreshCw size={13} /> Auto-refreshing
              </span>
            </div>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-top">
                  <span>Total migrations</span>
                  <div className="stat-icon purple">
                    <Workflow size={17} />
                  </div>
                </div>
                <strong>{jobs.length}</strong>
                <small>All recorded jobs</small>
              </div>
              <div className="stat-card">
                <div className="stat-top">
                  <span>In progress</span>
                  <div className="stat-icon blue">
                    <Activity size={17} />
                  </div>
                </div>
                <strong>{active.length}</strong>
                <small>Queued or running</small>
              </div>
              <div className="stat-card">
                <div className="stat-top">
                  <span>Products migrated</span>
                  <div className="stat-icon green">
                    <CloudDownload size={17} />
                  </div>
                </div>
                <strong>
                  {jobs
                    .reduce((n, j) => n + (j.succeeded || 0), 0)
                    .toLocaleString()}
                </strong>
                <small>Successful item records</small>
              </div>
              <div className="stat-card">
                <div className="stat-top">
                  <span>Need attention</span>
                  <div className="stat-icon amber">
                    <TriangleAlert size={17} />
                  </div>
                </div>
                <strong>
                  {jobs
                    .reduce((n, j) => n + (j.failed || 0), 0)
                    .toLocaleString()}
                </strong>
                <small>Failed item records</small>
              </div>
            </div>
            <div className="section-head recent-head">
              <div>
                <h2>Recent migrations</h2>
                <p>Track jobs from queue to completion.</p>
              </div>
              <button
                className="text-button"
                onClick={() => setPage("Activity")}
              >
                View activity <ArrowRight size={14} />
              </button>
            </div>
            <div className="table-card">
              {jobs.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">
                    <Database size={22} />
                  </div>
                  <b>Your migration history starts here</b>
                  <p>
                    Connect your stores to scan a catalog and prepare your first
                    migration.
                  </p>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setPage("Store connections");
                      setShowConnect(true);
                    }}
                  >
                    <Plus size={15} /> Add store connection
                  </button>
                </div>
              ) : (
                <div className="job-list">
                  {jobs.slice(0, 6).map((j) => (
                    <button
                      className="job-row"
                      key={j.id}
                      onClick={() => {
                        setActiveJob(j);
                        setPage("Activity");
                      }}
                    >
                      <div className="job-type-icon">
                        <Workflow size={18} />
                      </div>
                      <div className="job-main">
                        <b>
                          Shopify <ArrowRight size={13} /> WooCommerce
                        </b>
                        <small>
                          {j.id.slice(0, 12)} · {fmt(j.createdAt)}
                        </small>
                      </div>
                      <div className="job-progress">
                        <div className="progress-track">
                          <span
                            style={{
                              width: `${j.total ? Math.min(100, ((j.succeeded + j.failed + j.skipped) / j.total) * 100) : 0}%`,
                            }}
                          />
                        </div>
                        <small>
                          {j.succeeded || 0} of {j.total || 0} processed
                        </small>
                      </div>
                      <span className={`status-pill ${j.status.toLowerCase()}`}>
                        {j.status.replaceAll("_", " ")}
                      </span>
                      <ArrowRight size={15} />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="bottom-note">
              <ShieldCheck size={16} />
              <span>
                <b>Built for careful migrations.</b> PME previews the work
                before it writes to your destination store. No rollback is
                implied—always test with a development store first.
              </span>
              <button onClick={() => setPage("Settings")}>
                Safety notes <ArrowUpRight size={14} />
              </button>
            </div>
          </section>
        )}
        {page === "Store connections" && (
          <section className="page-content">
            <div className="eyebrow">
              <span className="eyebrow-line" /> PLATFORM ACCESS
            </div>
            <div className="page-title-row">
              <div>
                <h1>Store connections</h1>
                <p className="lead">
                  Securely configure the source and destination stores used by
                  your migration jobs.
                </p>
              </div>
              <button
                className="primary-button"
                onClick={() => setShowConnect(true)}
              >
                <Plus size={16} /> Connect a store
              </button>
            </div>
            <div className="connection-grid">
              {(["SHOPIFY", "WOOCOMMERCE"] as const).map((p) => {
                const c = connections.find((x) => x.platform === p);
                return (
                  <div className="connection-card" key={p}>
                    <div className="connection-card-head">
                      <div
                        className={`platform-logo ${p === "SHOPIFY" ? "shopify" : "woo"}`}
                      >
                        {p === "SHOPIFY" ? (
                          <ShoppingBag size={22} />
                        ) : (
                          <Store size={22} />
                        )}
                      </div>
                      <span className="role-tag">
                        {p === "SHOPIFY" ? "SOURCE" : "DESTINATION"}
                      </span>
                    </div>
                    <h3>{p === "SHOPIFY" ? "Shopify" : "WooCommerce"}</h3>
                    <p>
                      {p === "SHOPIFY"
                        ? "Read products, variants, options and image URLs from your catalog."
                        : "Create destination products and attach supported product images."}
                    </p>
                    {c ? (
                      <>
                        <div className="connected-url">
                          <span className="status-dot" />
                          {c.storeUrl}
                        </div>
                        <div className="connection-meta">
                          <span>
                            <Check size={14} /> Saved securely
                          </span>
                          <button
                            className="secondary-button small"
                            onClick={() => testConn(c.id)}
                            disabled={busy}
                          >
                            <RefreshCw size={13} /> Test connection
                          </button>
                        </div>
                        <button
                          className="remove-link"
                          onClick={() =>
                            run("Removing connection…", async () => {
                              await api(`/connections/${c.id}`, {
                                method: "DELETE",
                              });
                              await refresh();
                              setNotice("Connection removed.");
                            })
                          }
                        >
                          Remove connection
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="not-connected">
                          <span className="muted-dot" /> Not connected
                        </div>
                        <button
                          className="secondary-button full"
                          onClick={() => {
                            setPlatform(p);
                            setShowConnect(true);
                          }}
                        >
                          <Plus size={15} /> Connect{" "}
                          {p === "SHOPIFY" ? "Shopify" : "WooCommerce"}
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="info-panel">
              <div className="info-symbol">
                <LockKeyhole size={18} />
              </div>
              <div>
                <b>Credentials stay on your server</b>
                <p>
                  Secrets are encrypted before being stored. The browser never
                  receives saved credentials back. Use dedicated API credentials
                  with only the permissions PME needs.
                </p>
              </div>
            </div>
            <div className="permissions-grid">
              <div>
                <h3>Shopify permissions</h3>
                <p>
                  Start with the minimum product-read scope required by your
                  Shopify app, typically <code>read_products</code>. PME does
                  not need customer/order access for this release.
                </p>
              </div>
              <div>
                <h3>WooCommerce permissions</h3>
                <p>
                  Create a dedicated REST API key with Read/Write permissions
                  for products. Use HTTPS and a development store until
                  live-store behavior has been verified.
                </p>
              </div>
            </div>
          </section>
        )}
        {page === "Migration workspace" && (
          <section className="page-content">
            <div className="eyebrow">
              <span className="eyebrow-line" /> MIGRATION WORKSPACE
            </div>
            <h1>Plan your migration.</h1>
            <p className="lead">
              Choose a connected source and destination, inspect the catalog,
              then preview the planned changes before queueing a job.
            </p>
            <div className="workspace-panel">
              <div className="workspace-panel-head">
                <div>
                  <h2>
                    <span className="step-num">01</span> Select stores
                  </h2>
                  <p>PME currently supports Shopify → WooCommerce.</p>
                </div>
                <span className="step-status">STEP 1 OF 3</span>
              </div>
              <div className="select-grid">
                <label>
                  Source store
                  <select
                    value={sourceId}
                    onChange={(e) => setSourceId(e.target.value)}
                  >
                    <option value="">Select Shopify connection</option>
                    {connections
                      .filter((c) => c.platform === "SHOPIFY")
                      .map((c) => (
                        <option value={c.id} key={c.id}>
                          {c.name} — {c.storeUrl}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="select-arrow">
                  <ArrowRight size={18} />
                </div>
                <label>
                  Destination store
                  <select
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                  >
                    <option value="">Select WooCommerce connection</option>
                    {connections
                      .filter((c) => c.platform === "WOOCOMMERCE")
                      .map((c) => (
                        <option value={c.id} key={c.id}>
                          {c.name} — {c.storeUrl}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              {connections.length < 2 && (
                <div className="inline-warning">
                  <TriangleAlert size={17} />
                  <span>
                    You need one Shopify source and one WooCommerce destination
                    before you can scan.{" "}
                    <button
                      onClick={() => {
                        setPage("Store connections");
                        setShowConnect(true);
                      }}
                    >
                      Connect stores <ArrowRight size={13} />
                    </button>
                  </span>
                </div>
              )}
              <div className="workspace-actions">
                <button
                  className="secondary-button"
                  disabled={!sourceId || busy}
                  onClick={scanSource}
                >
                  <Search size={15} /> Scan source catalog
                </button>
                <button
                  className="secondary-button"
                  disabled={!sourceId || !targetId || busy}
                  onClick={previewMigration}
                >
                  <FileCheck2 size={15} /> Generate preview
                </button>
                <button
                  className="primary-button"
                  disabled={!sourceId || !targetId || busy}
                  onClick={startMigration}
                >
                  <Zap size={15} /> Queue migration <ArrowRight size={15} />
                </button>
              </div>
              {busy && (
                <div className="loading-line">
                  <span className="spinner" />
                  {loadingLabel}
                </div>
              )}
            </div>
            {scan && (
              <div className="results-panel">
                <div className="workspace-panel-head">
                  <div>
                    <h2>
                      <span className="step-num">02</span> Source scan
                    </h2>
                    <p>Live data returned by Shopify, not estimated counts.</p>
                  </div>
                  <span className="step-status">SCAN COMPLETE</span>
                </div>
                <div className="scan-stats">
                  <div>
                    <strong>{scan.productCount}</strong>
                    <small>Products found</small>
                  </div>
                  <div>
                    <strong>{scan.variantCount}</strong>
                    <small>Variants found</small>
                  </div>
                  <div>
                    <strong>{scan.imageCount}</strong>
                    <small>Images found</small>
                  </div>
                  <div>
                    <strong>{scan.warningCount}</strong>
                    <small>Warnings</small>
                  </div>
                </div>
                {scan.truncated && (
                  <p className="subtle">Showing first 100 product summaries.</p>
                )}
                <div className="preview-list">
                  {scan.products.map((p: any) => (
                    <div className="preview-row" key={p.sourceId}>
                      <div>
                        <b>{p.title}</b>
                        <small>
                          {p.variantCount} variants · {p.imageCount} images
                        </small>
                      </div>
                      {p.warnings.length > 0 ? (
                        <span className="warning-label">
                          <TriangleAlert size={13} />
                          {p.warnings.length} warning(s)
                        </span>
                      ) : (
                        <span className="success-label">
                          <Check size={13} /> Looks compatible
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {preview && (
              <div className="results-panel">
                <div className="workspace-panel-head">
                  <div>
                    <h2>
                      <span className="step-num">03</span> Migration preview
                    </h2>
                    <p>
                      Read-only preview. No destination products have been
                      changed.
                    </p>
                  </div>
                  <span className="step-status">DRY RUN</span>
                </div>
                <div className="scan-stats">
                  <div>
                    <strong>{preview.total}</strong>
                    <small>Products to process</small>
                  </div>
                  <div>
                    <strong>{preview.create}</strong>
                    <small>Planned creates</small>
                  </div>
                  <div>
                    <strong>{preview.update}</strong>
                    <small>Updates</small>
                  </div>
                  <div>
                    <strong>{preview.flagged}</strong>
                    <small>Flagged for review</small>
                  </div>
                </div>
                <div className="inline-warning">
                  <TriangleAlert size={17} />
                  <span>{preview.notice}</span>
                </div>
                <div className="preview-list">
                  {preview.products.map((p: any) => (
                    <div className="preview-row" key={p.sourceId}>
                      <div>
                        <b>{p.title}</b>
                        <small>
                          {p.variantCount} variants · {p.imageCount} images
                        </small>
                      </div>
                      {p.warnings.length > 0 ? (
                        <span className="warning-label">
                          <TriangleAlert size={13} />
                          {p.warnings.length} warning(s)
                        </span>
                      ) : (
                        <span className="success-label">
                          <Check size={13} /> Ready to queue
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="workspace-actions">
                  <button
                    className="primary-button"
                    disabled={busy}
                    onClick={startMigration}
                  >
                    <Zap size={15} /> Queue migration job{" "}
                    <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
        {page === "Activity" && (
          <section className="page-content">
            <div className="eyebrow">
              <span className="eyebrow-line" /> JOB MONITOR
            </div>
            <h1>Migration activity</h1>
            <p className="lead">
              Watch persisted job state and inspect outcomes. The worker runs
              separately from browser requests.
            </p>
            {activeJob && (
              <div className="workspace-panel">
                <div className="workspace-panel-head">
                  <div>
                    <h2>Selected job</h2>
                    <p className="mono">{activeJob.id}</p>
                  </div>
                  <span
                    className={`status-pill ${activeJob.status.toLowerCase()}`}
                  >
                    {activeJob.status.replaceAll("_", " ")}
                  </span>
                </div>
                <p>{activeJob.currentActivity || "Waiting for worker…"}</p>
                <div className="job-detail-stats">
                  <div>
                    <b>{activeJob.succeeded || 0}</b>
                    <small>Succeeded</small>
                  </div>
                  <div>
                    <b>{activeJob.failed || 0}</b>
                    <small>Failed</small>
                  </div>
                  <div>
                    <b>{activeJob.skipped || 0}</b>
                    <small>Skipped</small>
                  </div>
                  <div>
                    <b>{activeJob.total || 0}</b>
                    <small>Total</small>
                  </div>
                </div>
                <div className="workspace-actions">
                  <button
                    className="secondary-button"
                    onClick={() =>
                      run("Refreshing job…", async () => {
                        setActiveJob(await api(`/jobs/${activeJob.id}`));
                        await refresh();
                      })
                    }
                  >
                    <RefreshCw size={15} /> Refresh job
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() =>
                      GenDownload(
                        `${API}/jobs/${activeJob.id}/report.json`,
                        token,
                      )
                    }
                  >
                    <FileText size={15} /> Download JSON report
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() =>
                      GenDownload(
                        `${API}/jobs/${activeJob.id}/report.csv`,
                        token,
                      )
                    }
                  >
                    <CloudDownload size={15} /> Download CSV
                  </button>
                  {["QUEUED", "RUNNING"].includes(activeJob.status) && (
                    <button
                      className="danger-button"
                      onClick={() =>
                        run("Requesting cancellation…", async () => {
                          await api(`/jobs/${activeJob.id}/cancel`, {
                            method: "POST",
                          });
                          await refresh();
                        })
                      }
                    >
                      Cancel job
                    </button>
                  )}
                  {activeJob.failed > 0 && (
                    <button
                      className="primary-button"
                      onClick={() =>
                        run("Retrying failed items…", async () => {
                          await api(`/jobs/${activeJob.id}/retry-failed`, {
                            method: "POST",
                          });
                          await refresh();
                        })
                      }
                    >
                      Retry failed items
                    </button>
                  )}
                </div>
              </div>
            )}
            <div className="table-card activity-table">
              <div className="table-heading">
                <b>All jobs</b>
                <span>{jobs.length} recorded</span>
              </div>
              {jobs.length === 0 ? (
                <div className="empty-state compact">
                  <b>No activity yet</b>
                  <p>Queue a migration to see its real status here.</p>
                </div>
              ) : (
                jobs.map((j) => (
                  <button
                    className="job-row"
                    key={j.id}
                    onClick={() => setActiveJob(j)}
                  >
                    <div className="job-type-icon">
                      <Workflow size={18} />
                    </div>
                    <div className="job-main">
                      <b>
                        Shopify <ArrowRight size={13} /> WooCommerce
                      </b>
                      <small>
                        {j.id.slice(0, 14)} · {fmt(j.createdAt)}
                      </small>
                    </div>
                    <div className="job-progress">
                      <div className="progress-track">
                        <span
                          style={{
                            width: `${j.total ? Math.min(100, ((j.succeeded + j.failed + j.skipped) / j.total) * 100) : 0}%`,
                          }}
                        />
                      </div>
                      <small>
                        {j.succeeded || 0} / {j.total || 0} processed ·{" "}
                        {j.failed || 0} failed
                      </small>
                    </div>
                    <span className={`status-pill ${j.status.toLowerCase()}`}>
                      {j.status.replaceAll("_", " ")}
                    </span>
                  </button>
                ))
              )}
            </div>
          </section>
        )}
        {page === "Settings" && (
          <section className="page-content">
            <div className="eyebrow">
              <span className="eyebrow-line" /> CONFIGURATION
            </div>
            <h1>Settings & safety</h1>
            <p className="lead">
              PME is designed to run in your own environment with explicit
              control over connected stores.
            </p>
            <div className="settings-list">
              <div className="settings-item">
                <div className="settings-icon">
                  <LockKeyhole size={19} />
                </div>
                <div>
                  <b>Admin access token</b>
                  <p>
                    The API token is sent with requests from this browser tab.
                    Configure PME_ADMIN_TOKEN on the backend and never share it.
                  </p>
                </div>
                <button
                  className="secondary-button small"
                  onClick={() => setShowToken(true)}
                >
                  Update token
                </button>
              </div>
              <div className="settings-item">
                <div className="settings-icon">
                  <ShieldCheck size={19} />
                </div>
                <div>
                  <b>Credential encryption</b>
                  <p>
                    Stored store credentials use AES-256-GCM.
                    CREDENTIAL_ENCRYPTION_KEY must be a separate 32-byte hex key
                    and backed up securely.
                  </p>
                </div>
                <span className="settings-value">Backend configured</span>
              </div>
              <div className="settings-item">
                <div className="settings-icon">
                  <Globe2 size={19} />
                </div>
                <div>
                  <b>Store URL protection</b>
                  <p>
                    Private/internal addresses are blocked by default to reduce
                    SSRF risk. Allow local addresses only in a trusted
                    development environment.
                  </p>
                </div>
                <span className="settings-value">HTTPS required</span>
              </div>
              <div className="settings-item">
                <div className="settings-icon">
                  <FileCheck2 size={19} />
                </div>
                <div>
                  <b>Migration safety</b>
                  <p>
                    Preview before writing, use development stores first, and
                    inspect the report. PME does not implement full rollback.
                  </p>
                </div>
                <span className="settings-value">Preview first</span>
              </div>
            </div>
            <div className="info-panel">
              <TriangleAlert size={18} />
              <div>
                <b>Important: this is an early implementation</b>
                <p>
                  Variable-product variations and image transfer need end-to-end
                  completion and live test-store verification before production
                  use. Do not use this build on your only copy of a live
                  catalog.
                </p>
              </div>
            </div>
          </section>
        )}
        <footer className="footer">
          <span>
            PME <b>0.1.0</b> · Open-source migration tooling
          </span>
          <span>
            <span className="status-dot" /> Self-hosted workspace
          </span>
        </footer>
      </main>
      {showConnect && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowConnect(false);
          }}
        >
          <div className="modal">
            <div className="modal-head">
              <div>
                <span className="eyebrow">NEW CONNECTION</span>
                <h2>Connect a store</h2>
                <p>
                  Credentials are sent to your PME backend and encrypted before
                  storage.
                </p>
              </div>
              <button
                className="icon-button"
                onClick={() => setShowConnect(false)}
              >
                ×
              </button>
            </div>
            <div className="platform-tabs">
              <button
                className={platform === "SHOPIFY" ? "active" : ""}
                onClick={() => setPlatform("SHOPIFY")}
              >
                <ShoppingBag size={16} /> Shopify <span>Source</span>
              </button>
              <button
                className={platform === "WOOCOMMERCE" ? "active" : ""}
                onClick={() => setPlatform("WOOCOMMERCE")}
              >
                <Store size={16} /> WooCommerce <span>Destination</span>
              </button>
            </div>
            <div className="form-fields">
              <label>
                Connection name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Main store"
                />
              </label>
              <label>
                Store URL
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={
                    platform === "SHOPIFY"
                      ? "https://your-store.myshopify.com"
                      : "https://yourstore.com"
                  }
                />
              </label>
              {platform === "SHOPIFY" ? (
                <label>
                  Admin API access token
                  <input
                    type="password"
                    value={secretA}
                    onChange={(e) => setSecretA(e.target.value)}
                    placeholder="shpat_••••••••••••"
                    autoComplete="off"
                  />
                  <small>
                    Use the minimum required product-read scope. Never paste
                    this into source code.
                  </small>
                </label>
              ) : (
                <>
                  <label>
                    Consumer key
                    <input
                      type="password"
                      value={secretA}
                      onChange={(e) => setSecretA(e.target.value)}
                      placeholder="ck_••••••••••••"
                      autoComplete="off"
                    />
                  </label>
                  <label>
                    Consumer secret
                    <input
                      type="password"
                      value={secretB}
                      onChange={(e) => setSecretB(e.target.value)}
                      placeholder="cs_••••••••••••"
                      autoComplete="off"
                    />
                  </label>
                </>
              )}
              <div className="modal-security">
                <LockKeyhole size={15} />
                <span>
                  Credentials are encrypted at rest and will not be displayed
                  after saving.
                </span>
              </div>
              <button
                className="primary-button full"
                disabled={
                  busy ||
                  !name.trim() ||
                  !url.trim() ||
                  !secretA.trim() ||
                  (platform === "WOOCOMMERCE" && !secretB.trim())
                }
                onClick={createConn}
              >
                {busy ? (
                  <>
                    <span className="spinner" />
                    {loadingLabel}
                  </>
                ) : (
                  <>
                    Test & save connection <ArrowRight size={15} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {showToken && (
        <div className="modal-backdrop">
          <div className="modal token-modal">
            <div className="modal-head">
              <div>
                <span className="eyebrow">LOCAL ADMIN ACCESS</span>
                <h2>Connect to your PME API</h2>
                <p>
                  Enter the PME_ADMIN_TOKEN configured in your local
                  environment. It is stored in this browser tab's session
                  storage.
                </p>
              </div>
            </div>
            <div className="form-fields">
              <label>
                Admin token
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Your local admin token"
                  autoComplete="off"
                />
              </label>
              <button
                className="primary-button full"
                disabled={!token.trim()}
                onClick={saveToken}
              >
                Connect to workspace <ArrowRight size={15} />
              </button>
              <small>
                For local development only. Never expose the API directly to the
                public internet.
              </small>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function GenDownload(path: string, token: string) {
  fetch(path, { headers: { "x-pme-admin-token": token } })
    .then((r) => {
      if (!r.ok) throw new Error("Report download failed");
      return r.blob();
    })
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = path.endsWith(".csv") ? "pme-report.csv" : "pme-report.json";
      a.click();
      URL.revokeObjectURL(url);
    })
    .catch((e) => alert((e as Error).message));
}
export default App;
