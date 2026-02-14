import { useEffect, useMemo, useState } from 'react';
import { getSummary, getFilePreview } from './api';

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = Number(bytes || 0);
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

function formatDate(value) {
  if (!value) return 'n/a';
  return new Date(value).toLocaleString();
}

function StatusPill({ status }) {
  const text = status || 'unknown';
  return <span className={`pill pill-${text}`}>{text.toUpperCase()}</span>;
}

function SummaryCard({ label, value }) {
  return (
    <article className="card">
      <p className="label">{label}</p>
      <p className="value">{value}</p>
    </article>
  );
}

function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState(null);
  const [selectedFile, setSelectedFile] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getSummary();
      setPayload(data);
      if (!selectedFile && data.files?.length) {
        setSelectedFile(data.files[0].file_name);
      }
    } catch (err) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!selectedFile) {
      setPreview(null);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setPreviewLoading(true);
      try {
        const next = await getFilePreview(selectedFile, 20);
        if (!cancelled) {
          setPreview(next);
        }
      } catch (err) {
        if (!cancelled) {
          setPreview({ error: err.message });
        }
      } finally {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [selectedFile]);

  const summary = payload?.summary || {};
  const files = payload?.files || [];
  const checks = payload?.checks || [];

  const passing = useMemo(() => checks.filter((c) => c.status === 'pass').length, [checks]);
  const warn = useMemo(() => checks.filter((c) => c.status === 'warn').length, [checks]);
  const fail = useMemo(() => checks.filter((c) => c.status === 'fail').length, [checks]);
  const checkRate = checks.length === 0 ? 0 : Math.round((passing / checks.length) * 100);

  return (
    <main className="container">
      <header className="topbar">
        <div>
          <h1>Raw Data Inventory</h1>
          <p>Synthetic data readiness against PRD checks</p>
        </div>
        <button onClick={refresh} className="primary" disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </header>

      {error && <p className="error">{error}</p>}

      <section className="summary-grid">
        <SummaryCard label="Total Files" value={summary.total_files || 0} />
        <SummaryCard label="CSV Files" value={summary.csv_files || 0} />
        <SummaryCard label="Total Rows" value={(summary.total_rows || 0).toLocaleString()} />
        <SummaryCard label="Total Size" value={formatBytes(summary.total_size_bytes || 0)} />
        <SummaryCard label="Checks Passing" value={`${passing}/${checks.length} (${checkRate}%)`} />
        <SummaryCard label="Checks Warn/Fail" value={`${warn} / ${fail}`} />
        <SummaryCard label="Last Scan" value={formatDate(summary.scanned_at)} />
      </section>

      <section className="grid">
        <article className="card wide">
          <h2>Data Files</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Rows</th>
                  <th>Columns</th>
                  <th>Size</th>
                  <th>Modified</th>
                  <th>Null Ratio</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => {
                  const selected = file.file_name === selectedFile;
                  return (
                    <tr
                      key={file.file_name}
                      className={selected ? 'selected' : ''}
                      onClick={() => setSelectedFile(file.file_name)}
                    >
                      <td>{file.file_name}</td>
                      <td>{file.rows ?? 'n/a'}</td>
                      <td>{file.columns ?? 'n/a'}</td>
                      <td>{formatBytes(file.file_size_bytes)}</td>
                      <td>{formatDate(file.last_modified)}</td>
                      <td>{file.overall_missing_ratio != null ? `${(file.overall_missing_ratio * 100).toFixed(2)}%` : 'n/a'}</td>
                      <td>{file.is_csv ? 'CSV' : 'Other'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>

        <article className="card">
          <h2>PRD Conformance</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Check</th>
                  <th>File</th>
                  <th>Observed</th>
                  <th>Expected</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {checks.map((check) => (
                  <tr key={`${check.file}-${check.id}`}>
                    <td><StatusPill status={check.status} /></td>
                    <td>{check.title}</td>
                    <td>{check.file}</td>
                    <td>
                      <pre>{JSON.stringify(check.observed, null, 2)}</pre>
                    </td>
                    <td>
                      <pre>{JSON.stringify(check.expected, null, 2)}</pre>
                    </td>
                    <td>{check.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <article className="card">
        <h2>File Preview</h2>
        {selectedFile ? (
          <>
            <p className="muted">Source: {selectedFile}</p>
            {previewLoading ? (
              <p className="muted">Loading preview...</p>
            ) : preview?.error ? (
              <p className="error">{preview.error}</p>
            ) : (
              <pre>{JSON.stringify(preview?.preview_rows ?? [], null, 2)}</pre>
            )}
          </>
        ) : (
          <p className="muted">Select a file from the table to view a preview.</p>
        )}
      </article>
    </main>
  );
}

export default App;
