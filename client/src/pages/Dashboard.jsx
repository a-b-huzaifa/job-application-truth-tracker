import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';

function getStatusBadge(status) {
  switch (status) {
    case 'interview':
      return <span className="brutalist-badge brutalist-badge-green">Interview</span>;
    case 'response_received':
      return <span className="brutalist-badge brutalist-badge-cyan">Response</span>;
    case 'applied':
      return <span className="brutalist-badge brutalist-badge-outline">Applied</span>;
    case 'ghosted':
      return <span className="brutalist-badge brutalist-badge-red">Ghosted</span>;
    case 'rejected':
      return <span className="brutalist-badge brutalist-badge-yellow">Rejected</span>;
    default:
      return <span className="brutalist-badge brutalist-badge-outline">{status}</span>;
  }
}

function getPlatformBadge(platform) {
  switch (platform) {
    case 'linkedin':
      return <span className="brutalist-badge" style={{ background: '#0077b5', color: '#fff' }}>LinkedIn</span>;
    case 'wellfound':
      return <span className="brutalist-badge" style={{ background: '#ff6154', color: '#fff' }}>Wellfound</span>;
    case 'direct':
      return <span className="brutalist-badge" style={{ background: '#000', color: '#fff' }}>Direct</span>;
    case 'micro1':
      return <span className="brutalist-badge" style={{ background: '#6c5ce7', color: '#fff' }}>Micro1</span>;
    default:
      return <span className="brutalist-badge brutalist-badge-outline">{platform}</span>;
  }
}

export default function Dashboard() {
  const { isAuthenticated, user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState(null);

  // Modal / Form state for adding a custom application
  const [showAddModal, setShowAddModal] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [platform, setPlatform] = useState('linkedin');
  const [jobUrl, setJobUrl] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [newResumeName, setNewResumeName] = useState('Full-Stack Engineer');
  const [newResumeContent, setNewResumeContent] = useState('Specialized in React, Node.js, TypeScript, PostgreSQL, and Docker. 4+ years software development experience.');
  const [autoTailor, setAutoTailor] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const [appsData, resumesData] = await Promise.all([
        apiFetch('/applications'),
        apiFetch('/resumes').catch(() => ({ resumes: [] })),
      ]);
      setApplications(appsData.applications || []);
      setResumes(resumesData.resumes || []);
      if (resumesData.resumes && resumesData.resumes.length > 0) {
        setSelectedResumeId(resumesData.resumes[0].id);
      }
    } catch (err) {
      setError(err.message || 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // One-click starter pack for new registered users
  const handleLoadStarterData = async () => {
    setSeeding(true);
    setError(null);
    try {
      // 1. Create a primary resume variant
      const resume1 = await apiFetch('/resumes', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Full-Stack & Cloud Engineer',
          content: `Senior Full Stack Software Engineer with 4+ years experience designing web platforms and distributed APIs. Core skills: JavaScript, TypeScript, React, Next.js, Node.js, Express, PostgreSQL, Redis, Docker, AWS, Git, CI/CD pipelines.`,
        }),
      });

      // 2. Create sample applications
      await apiFetch('/applications', {
        method: 'POST',
        body: JSON.stringify({
          resume_id: resume1.resume.id,
          company_name: 'Stripe',
          role_title: 'Senior Full Stack Engineer',
          platform: 'direct',
          job_url: 'https://stripe.com/jobs/1',
          job_description: 'Looking for a Senior Full Stack Engineer with strong React, Node.js, TypeScript, and Postgres experience to scale checkout payment APIs.',
          applied_at: new Date().toISOString(),
        }),
      });

      await apiFetch('/applications', {
        method: 'POST',
        body: JSON.stringify({
          resume_id: resume1.resume.id,
          company_name: 'Shopify',
          role_title: 'Backend Platform Engineer',
          platform: 'linkedin',
          job_url: 'https://linkedin.com/jobs/2',
          job_description: 'We are seeking a backend engineer experienced in scalable microservices, relational databases (PostgreSQL), Redis caching, and Docker containers.',
          applied_at: new Date().toISOString(),
        }),
      });

      await apiFetch('/applications', {
        method: 'POST',
        body: JSON.stringify({
          resume_id: resume1.resume.id,
          company_name: 'Google Cloud',
          role_title: 'Principal Cloud Enterprise Architect',
          platform: 'wellfound',
          job_url: 'https://wellfound.com/jobs/3',
          job_description: 'Enterprise Cloud Architect requiring 10+ years tenure, quantum encryption systems, and petabyte distributed database architecture.',
          applied_at: new Date().toISOString(),
        }),
      });

      await fetchData();
    } catch (err) {
      setError(err.message || 'Failed to seed starter data');
    } finally {
      setSeeding(false);
    }
  };

  // Add custom application submit
  const handleAddApplication = async (e) => {
    e.preventDefault();
    if (!companyName || !roleTitle || !jobDescription) {
      alert('Company, Role, and Job Description are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      let targetResumeId = selectedResumeId;

      // If user has no resume yet, create one on the fly
      if (!targetResumeId) {
        const createdResume = await apiFetch('/resumes', {
          method: 'POST',
          body: JSON.stringify({
            name: newResumeName || 'Default Resume',
            content: newResumeContent || 'Full Stack Engineer with React, Node.js, SQL, and Docker.',
          }),
        });
        targetResumeId = createdResume.resume.id;
      }

      // If auto-tailor is checked, call the agentic tailor endpoint
      if (autoTailor && targetResumeId) {
        const tailoredRes = await apiFetch(`/resumes/${targetResumeId}/tailor`, {
          method: 'POST',
          body: JSON.stringify({
            job_description: jobDescription,
            role_title: roleTitle,
            company_name: companyName,
          })
        });
        // The endpoint returns { resume: { id, name, content } }
        targetResumeId = tailoredRes.resume.id;
      }

      await apiFetch('/applications', {
        method: 'POST',
        body: JSON.stringify({
          resume_id: targetResumeId,
          company_name: companyName,
          role_title: roleTitle,
          platform: platform,
          job_url: jobUrl || null,
          job_description: jobDescription,
          applied_at: new Date().toISOString(),
        }),
      });

      setShowAddModal(false);
      setCompanyName('');
      setRoleTitle('');
      setJobUrl('');
      setJobDescription('');
      await fetchData();
    } catch (err) {
      alert(`Failed to add application: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="brutalist-card brutalist-card-lg" style={{ textAlign: 'center', margin: '40px auto', maxWidth: '640px' }}>
        <div className="brutalist-card-header" style={{ justifyContent: 'center' }}>
          <h1 className="brutalist-card-title">Truth Tracker Mission Control</h1>
        </div>
        <p style={{ margin: '20px 0', fontSize: '15px', color: 'var(--text-muted)' }}>
          Please authenticate to view your tracked applications, inspect AI match verifications, and run agentic fit audits.
        </p>
        <Link to="/login" className="brutalist-btn brutalist-btn-primary" style={{ fontSize: '15px', padding: '12px 28px' }}>
          Sign In to Access Dashboard &rarr;
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Overview Stats Bar */}
      <div className="brutalist-card" style={{ marginBottom: '28px' }}>
        <div className="brutalist-card-header">
          <div>
            <h1 className="brutalist-card-title">Applications Dashboard</h1>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Authenticated as <strong>{user?.email}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="brutalist-btn brutalist-btn-primary brutalist-btn-sm"
            >
              ➕ Track New Application
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginTop: '16px' }}>
          <div className="brutalist-card" style={{ margin: 0, background: '#ffffff' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>Total Tracked</div>
            <div style={{ fontSize: '28px', fontWeight: 800, margin: '6px 0' }}>{applications.length}</div>
            <span className="brutalist-badge brutalist-badge-outline">Live Registry</span>
          </div>

          <div className="brutalist-card" style={{ margin: 0, background: '#ffebe8' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>Ghosted Applications</div>
            <div style={{ fontSize: '28px', fontWeight: 800, margin: '6px 0', color: 'var(--accent-red)' }}>
              {applications.filter((a) => a.status === 'ghosted').length}
            </div>
            <span className="brutalist-badge brutalist-badge-red">&gt;21 Days Stale</span>
          </div>

          <div className="brutalist-card" style={{ margin: 0, background: '#e8f9ff' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>Interviews & Responses</div>
            <div style={{ fontSize: '28px', fontWeight: 800, margin: '6px 0' }}>
              {applications.filter((a) => a.status === 'interview' || a.status === 'response_received').length}
            </div>
            <span className="brutalist-badge brutalist-badge-cyan">Active Pipeline</span>
          </div>
        </div>

        {/* Resume Variants Memory Links */}
        {resumes.length > 0 && (
          <div style={{ marginTop: '20px', borderTop: '2px solid var(--border-color)', paddingTop: '16px' }}>
            <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>
              Resume Memory Insights:
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {resumes.map((r) => (
                <Link
                  key={r.id}
                  to={`/resumes/${r.id}/insights`}
                  className="brutalist-btn brutalist-btn-sm"
                  style={{ background: '#fdfcee' }}
                >
                  ⚡ {r.name} Insights &rarr;
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal to Track Custom Application */}
      {showAddModal && (
        <div className="brutalist-card brutalist-card-lg" style={{ background: '#fffcee', marginBottom: '28px' }}>
          <div className="brutalist-card-header">
            <h2 className="brutalist-card-title">Track a New Job Application</h2>
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="brutalist-btn brutalist-btn-sm"
            >
              ✕ Close
            </button>
          </div>

          <form onSubmit={handleAddApplication}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Company Name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Netflix"
                  style={{ width: '100%', padding: '10px', border: '2px solid #000', fontFamily: 'var(--font-mono)' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Role Title
                </label>
                <input
                  type="text"
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  placeholder="e.g. Senior Backend Engineer"
                  style={{ width: '100%', padding: '10px', border: '2px solid #000', fontFamily: 'var(--font-mono)' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Platform
                </label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  style={{ width: '100%', padding: '10px', border: '2px solid #000', fontFamily: 'var(--font-mono)' }}
                >
                  <option value="linkedin">LinkedIn</option>
                  <option value="direct">Direct Career Page</option>
                  <option value="wellfound">Wellfound / AngelList</option>
                  <option value="micro1">Micro1</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Job URL (Optional)
                </label>
                <input
                  type="url"
                  value={jobUrl}
                  onChange={(e) => setJobUrl(e.target.value)}
                  placeholder="https://company.com/job/123"
                  style={{ width: '100%', padding: '10px', border: '2px solid #000', fontFamily: 'var(--font-mono)' }}
                />
              </div>
            </div>

            {/* Resume Selection */}
            {resumes.length > 0 ? (
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Select Resume Variant
                </label>
                <select
                  value={selectedResumeId}
                  onChange={(e) => setSelectedResumeId(e.target.value)}
                  style={{ width: '100%', padding: '10px', border: '2px solid #000', fontFamily: 'var(--font-mono)' }}
                >
                  {resumes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div style={{ marginBottom: '14px', background: '#ffffff', border: '2px solid #000', padding: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>
                  Initial Resume Profile Content
                </div>
                <input
                  type="text"
                  value={newResumeName}
                  onChange={(e) => setNewResumeName(e.target.value)}
                  placeholder="Resume Name (e.g. Full-Stack Resume)"
                  style={{ width: '100%', padding: '8px', border: '2px solid #000', marginBottom: '8px', fontFamily: 'var(--font-mono)' }}
                />
                <textarea
                  value={newResumeContent}
                  onChange={(e) => setNewResumeContent(e.target.value)}
                  rows={3}
                  placeholder="Paste your skills, experience, and tools..."
                  style={{ width: '100%', padding: '8px', border: '2px solid #000', fontFamily: 'var(--font-mono)' }}
                />
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' }}>
                Job Description
              </label>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                rows={4}
                placeholder="Paste the job description or requirement bullets here..."
                style={{ width: '100%', padding: '10px', border: '2px solid #000', fontFamily: 'var(--font-mono)' }}
                required
              />
            </div>

            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                id="autoTailor" 
                checked={autoTailor}
                onChange={(e) => setAutoTailor(e.target.checked)}
                style={{ width: '16px', height: '16px', border: '2px solid #000' }}
              />
              <label htmlFor="autoTailor" style={{ fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                Auto-Tailor Resume for this Role (Uses AI)
              </label>
            </div>

            <button type="submit" disabled={isSubmitting} className="brutalist-btn brutalist-btn-primary">
              {isSubmitting ? 'Processing...' : 'Save Application &rarr;'}
            </button>
          </form>
        </div>
      )}

      {/* Loading & Error States */}
      {loading && (
        <div className="brutalist-card" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontWeight: 800, fontSize: '16px' }}>FETCHING APPLICATIONS FROM DATABASE...</div>
        </div>
      )}

      {error && (
        <div className="brutalist-alert brutalist-alert-danger">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Empty State with Quick Starter Pack */}
      {!loading && !error && applications.length === 0 && (
        <div className="brutalist-card brutalist-card-lg" style={{ textAlign: 'center', padding: '40px 24px', background: '#fdfcee' }}>
          <h2 style={{ fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>
            Welcome to Truth Tracker, {user?.email}!
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', maxWidth: '560px', margin: '0 auto 24px auto' }}>
            Your personal application registry is ready. You can track your real job applications or load a starter candidate pack to immediately test the 4-stage Agentic Pipeline!
          </p>

          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleLoadStarterData}
              disabled={seeding}
              className="brutalist-btn brutalist-btn-primary"
              style={{ padding: '12px 24px' }}
            >
              {seeding ? '⚡ Seeding Candidate Pack...' : '⚡ Load Starter Candidate Pack (3 Applications)'}
            </button>

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="brutalist-btn"
              style={{ padding: '12px 24px' }}
            >
              ➕ Track Custom Job Application
            </button>
          </div>
        </div>
      )}

      {/* Applications Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
        {applications.map((app) => {
          const hasScore = typeof app.fit_score === 'number' || typeof app.baseline_score === 'number';
          const score = app.fit_score ?? app.baseline_score;

          return (
            <div key={app.id} className="brutalist-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', margin: 0 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.5px' }}>
                    {app.company_name}
                  </h2>
                  {getStatusBadge(app.status)}
                </div>

                <div style={{ fontSize: '14px', fontWeight: 700, color: '#333333', marginBottom: '14px' }}>
                  {app.role_title}
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center' }}>
                  {getPlatformBadge(app.platform)}
                  {app.job_url && (
                    <a
                      href={app.job_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: '11px', color: 'var(--accent-blue)', fontWeight: 600, textDecoration: 'underline' }}
                    >
                      View Job Post
                    </a>
                  )}
                  {app.applied_at && (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                      Applied: {app.applied_at.split('T')[0]}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ borderTop: '2px solid var(--border-color)', paddingTop: '12px', marginTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Baseline Fit Score:
                  </span>
                  {hasScore ? (
                    <span
                      className="brutalist-badge"
                      style={{
                        background: score >= 80 ? 'var(--accent-green)' : score >= 50 ? 'var(--accent-yellow)' : 'var(--accent-red)',
                        color: score < 50 ? '#ffffff' : '#000000',
                        fontSize: '13px',
                      }}
                    >
                      {score}%
                    </span>
                  ) : (
                    <span className="brutalist-badge brutalist-badge-outline" style={{ color: '#888' }}>
                      Not Analyzed
                    </span>
                  )}
                </div>

                <Link
                  to={`/applications/${app.id}`}
                  className="brutalist-btn brutalist-btn-sm"
                  style={{ width: '100%', textAlign: 'center' }}
                >
                  Inspect Application Fit &rarr;
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
