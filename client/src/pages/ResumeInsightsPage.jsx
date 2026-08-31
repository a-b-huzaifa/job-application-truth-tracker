import React from 'react';
import { useParams } from 'react-router-dom';

export default function ResumeInsightsPage() {
  const { id } = useParams();

  return (
    <div>
      <div className="brutalist-card">
        <div className="brutalist-card-header">
          <h1 className="brutalist-card-title">Resume Memory Insights — ID: {id}</h1>
          <span className="brutalist-badge brutalist-badge-red">Memory Service</span>
        </div>
        <p style={{ marginBottom: '16px' }}>
          Persistent historical pattern warnings across all automated evaluations for this specific resume variant.
        </p>

        <div className="brutalist-alert brutalist-alert-danger">
          <strong>Memory Warning:</strong> 2 claims have been repeatedly flagged as unsupported ATS screener hallucinations across past job applications.
        </div>

        <table className="brutalist-table" style={{ marginTop: '20px' }}>
          <thead>
            <tr>
              <th>Flag Type</th>
              <th>Claimed Mismatch</th>
              <th>Frequency</th>
              <th>Actionable Pattern Warning</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span className="brutalist-badge brutalist-badge-red">unsupported</span></td>
              <td>Candidate lacks containerization / Docker experience</td>
              <td><strong>3x</strong></td>
              <td>Evaluator frequently hallucinated Docker as missing. Make Docker more prominent in Skills section.</td>
            </tr>
            <tr>
              <td><span className="brutalist-badge brutalist-badge-yellow">phrasing_risk</span></td>
              <td>Candidate is completely unqualified in seniority</td>
              <td><strong>2x</strong></td>
              <td>Phrasing in years of experience triggers reviewer skepticism. Consider reframing high-velocity impact.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
