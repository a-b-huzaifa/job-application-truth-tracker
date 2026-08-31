import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';

export default function Profile() {
  const { user } = useAuth();
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const fetchResumes = useCallback(async () => {
    try {
      const data = await apiFetch('/resumes');
      setResumes(data.resumes || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch resumes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResumes();
  }, [fetchResumes]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('resume_file', file);
    formData.append('name', file.name.replace(/\.[^/.]+$/, "")); // strip extension

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/resumes/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to upload resume');
      }

      await fetchResumes();
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (loading) {
    return <div style={{ padding: '20px', fontFamily: 'var(--font-mono)' }}>Loading profile...</div>;
  }

  return (
    <div className="brutalist-container" style={{ maxWidth: '800px', margin: '40px auto' }}>
      <h1 className="brutalist-title">USER PROFILE</h1>

      {error && (
        <div style={{ background: '#ffebe8', color: 'var(--accent-red)', padding: '16px', border: '3px solid var(--accent-red)', marginBottom: '24px', fontWeight: 700 }}>
          Error: {error}
        </div>
      )}

      {/* Profile Details */}
      <div className="brutalist-card" style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '18px', textTransform: 'uppercase', marginBottom: '16px' }}>Account Information</h2>
        <div style={{ display: 'grid', gap: '12px' }}>
          <div><strong>Name:</strong> {user?.name || 'Not provided'}</div>
          <div><strong>Email:</strong> {user?.email}</div>
          <div><strong>Member Since:</strong> {new Date(user?.created_at).toLocaleDateString()}</div>
        </div>
      </div>

      {/* Resumes Section */}
      <div className="brutalist-card">
        <h2 style={{ fontSize: '18px', textTransform: 'uppercase', marginBottom: '16px' }}>My Resumes</h2>

        {/* Upload Area */}
        <div style={{ padding: '20px', border: '2px dashed #000', marginBottom: '24px', textAlign: 'center', background: '#f8f8f8' }}>
          <h3 style={{ marginBottom: '8px' }}>Upload New Resume</h3>
          <p style={{ fontSize: '12px', color: '#666', marginBottom: '16px' }}>Supports PDF (.pdf) and Word (.docx) formats.</p>
          
          <input 
            type="file" 
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
          <button 
            className="brutalist-btn" 
            style={{ background: 'var(--accent-blue)', color: '#fff' }}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'UPLOADING & PARSING...' : 'SELECT FILE TO UPLOAD'}
          </button>
        </div>

        {/* List Resumes */}
        {resumes.length === 0 ? (
          <p style={{ color: '#666', fontStyle: 'italic' }}>No resumes uploaded yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {resumes.map(resume => (
              <div key={resume.id} style={{ border: '2px solid #000', padding: '16px' }}>
                <div style={{ fontWeight: 800, marginBottom: '8px' }}>{resume.name}</div>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>
                  Created: {new Date(resume.created_at).toLocaleDateString()}
                </div>
                <div style={{ 
                  background: '#f1f1f1', 
                  padding: '12px', 
                  fontSize: '11px', 
                  maxHeight: '100px', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis',
                  whiteSpace: 'pre-wrap'
                }}>
                  {resume.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
