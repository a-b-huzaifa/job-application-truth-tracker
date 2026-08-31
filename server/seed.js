import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { pool } from './src/db.js';

function computeHash(text) {
  return crypto.createHash('sha256').update(text.trim()).digest('hex');
}

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function daysAgoTimestamp(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

async function seed() {
  console.log('--- Starting Database Seeding ---');
  try {
    // 1. Clean existing data in reverse dependency order
    await pool.query(`
      TRUNCATE TABLE weekly_reports, llm_analyses, applications, resumes, users RESTART IDENTITY CASCADE;
    `);

    // 2. Insert Demo User
    const passwordHash = await bcrypt.hash('password123', 10);
    const userRes = await pool.query(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id, email`,
      ['demo@truth-tracker.io', passwordHash]
    );
    const user = userRes.rows[0];
    console.log(`Created demo user: ${user.email} (ID: ${user.id})`);

    // 3. Insert Demo Resumes (3 Variants)
    const resumesData = [
      {
        name: 'Full-Stack Engineer (React / Node.js / PostgreSQL)',
        content: `SUMMARY:
Full-Stack Software Engineer with 4+ years of experience developing responsive web applications, REST APIs, and microservices using TypeScript, Node.js, Express, React, Next.js, and PostgreSQL.

SKILLS:
- Languages: JavaScript, TypeScript, Python, SQL
- Frontend: React, Next.js, Tailwind CSS, Redux Toolkit, HTML5/CSS3
- Backend: Node.js, Express, NestJS, REST APIs, GraphQL
- Databases: PostgreSQL, Redis, MongoDB
- Tools: Docker, Git, Jest, CI/CD GitHub Actions`,
      },
      {
        name: 'Backend & Distributed Systems Specialist (Go / Node / Kafka / Redis)',
        content: `SUMMARY:
Backend Engineer specialized in high-throughput distributed systems, event-driven architectures, database optimization, and cloud-native services.

SKILLS:
- Languages: Go (Golang), Node.js, TypeScript, Python, SQL
- Distributed Systems: Apache Kafka, RabbitMQ, Redis Streams, gRPC
- Databases: PostgreSQL (partitioning, indexing), TimescaleDB, DynamoDB
- Cloud & Infrastructure: AWS (ECS, S3, RDS), Docker, Kubernetes, Prometheus, Grafana
- Architecture: Microservices, Event Sourcing, CQRS, Domain-Driven Design`,
      },
      {
        name: 'DevOps & Cloud Infrastructure Engineer (AWS / Terraform / K8s)',
        content: `SUMMARY:
DevOps & Infrastructure Engineer with deep expertise in infrastructure-as-code, container orchestration, automated CI/CD pipelines, and cloud security compliance.

SKILLS:
- Cloud Platforms: AWS, GCP
- IaC & Automation: Terraform, Ansible, Pulumi, CloudFormation
- Containers & Orchestration: Docker, Kubernetes, Helm, ArgoCD
- CI/CD & Observability: GitHub Actions, GitLab CI, Datadog, Prometheus, Loki
- Networking & Security: VPC, IAM, TLS/SSL, Secrets Management (Vault)`,
      },
    ];

    const resumeRows = [];
    for (const r of resumesData) {
      const res = await pool.query(
        `INSERT INTO resumes (user_id, name, content)
         VALUES ($1, $2, $3)
         RETURNING id, name`,
        [user.id, r.name, r.content]
      );
      resumeRows.push(res.rows[0]);
      console.log(`Created resume: ${r.name} (ID: ${res.rows[0].id})`);
    }

    const [fullstackResume, backendResume, devopsResume] = resumeRows;

    // 4. Insert Demo Applications (9 Realistic Entries across platforms and statuses)
    const applicationsData = [
      {
        resume_id: fullstackResume.id,
        company_name: 'Stripe',
        role_title: 'Full Stack Engineer, Billing Platform',
        job_description: 'We are looking for a Full Stack Engineer to build intuitive dashboards and billing workflows using React, TypeScript, Node.js, and Postgres. Experience with payment APIs and distributed financial systems is a huge plus.',
        platform: 'direct',
        applied_at: daysAgo(3),
        status: 'applied',
        last_status_check: daysAgoTimestamp(3),
      },
      {
        resume_id: backendResume.id,
        company_name: 'Vercel',
        role_title: 'Senior Backend Infrastructure Engineer',
        job_description: 'Seeking a backend engineer with deep Go and Node.js expertise to scale our edge runtime, high-concurrency event ingestion pipelines, and global caching infrastructure with Redis and Kafka.',
        platform: 'wellfound',
        applied_at: daysAgo(10),
        status: 'interview',
        last_status_check: daysAgoTimestamp(2),
      },
      {
        resume_id: devopsResume.id,
        company_name: 'Datadog',
        role_title: 'Cloud Infrastructure & SRE Engineer',
        job_description: 'Join our SRE team managing multi-region Kubernetes clusters on AWS using Terraform and ArgoCD. Heavy focus on observability, latency SLAs, and disaster recovery.',
        platform: 'linkedin',
        applied_at: daysAgo(14),
        status: 'response_received',
        last_status_check: daysAgoTimestamp(5),
      },
      {
        resume_id: fullstackResume.id,
        company_name: 'Linear',
        role_title: 'Product Engineer - Integrations',
        job_description: 'Linear is looking for product engineers who obsess over UI polish, sync engines, and snappy web applications built with TypeScript, React, Node.js, and GraphQL.',
        platform: 'direct',
        applied_at: daysAgo(21),
        status: 'rejected',
        last_status_check: daysAgoTimestamp(7),
      },
      {
        resume_id: backendResume.id,
        company_name: 'Coinbase',
        role_title: 'Distributed Systems Engineer, Crypto Core',
        job_description: 'Looking for a Senior Distributed Systems Engineer with 6+ years Go/Rust experience, low-latency trading infrastructure, and blockchain protocol familiarity.',
        platform: 'linkedin',
        applied_at: daysAgo(28), // Stale application candidate (>14 days, applied status)
        status: 'applied',
        last_status_check: daysAgoTimestamp(20),
      },
      {
        resume_id: devopsResume.id,
        company_name: 'Scale AI',
        role_title: 'DevOps & Platform Security Engineer',
        job_description: 'Manage ML infrastructure pipelines, GPU cluster provisioning on AWS with Terraform, and implement SOC2 compliant security boundaries.',
        platform: 'wellfound',
        applied_at: daysAgo(35),
        status: 'ghosted',
        last_status_check: daysAgoTimestamp(15),
      },
      {
        resume_id: fullstackResume.id,
        company_name: 'Ramp',
        role_title: 'Software Engineer - Financial Workflows',
        job_description: 'Build fast, delightful web apps using Python, Node, React, and PostgreSQL. Help automate corporate spend management and card issuing.',
        platform: 'micro1',
        applied_at: daysAgo(8),
        status: 'interview',
        last_status_check: daysAgoTimestamp(1),
      },
      {
        resume_id: backendResume.id,
        company_name: 'Supabase',
        role_title: 'Database Platform Engineer',
        job_description: 'Work on PostgreSQL internals, connection pooling (pgbouncer/supavisor), real-time replication engines using Elixir and Go.',
        platform: 'direct',
        applied_at: daysAgo(24), // Stale candidate
        status: 'applied',
        last_status_check: daysAgoTimestamp(22),
      },
      {
        resume_id: fullstackResume.id,
        company_name: 'Notion',
        role_title: 'Full Stack Engineer - Collaboration',
        job_description: 'Build collaborative editing experiences, block-based UI components, and real-time backend sync algorithms in TypeScript and Node.',
        platform: 'linkedin',
        applied_at: daysAgo(30),
        status: 'rejected',
        last_status_check: daysAgoTimestamp(10),
      },
    ];

    const insertedApps = [];
    for (const app of applicationsData) {
      const res = await pool.query(
        `INSERT INTO applications (
          user_id, resume_id, company_name, role_title, job_description, 
          platform, applied_at, status, last_status_check
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, company_name, role_title, status, platform, job_description`,
        [
          user.id,
          app.resume_id,
          app.company_name,
          app.role_title,
          app.job_description,
          app.platform,
          app.applied_at,
          app.status,
          app.last_status_check,
        ]
      );
      insertedApps.push(res.rows[0]);
    }
    console.log(`Inserted ${insertedApps.length} demo applications.`);

    // 5. Insert Cached LLM Analyses for Demonstration
    const sampleAnalyses = [
      {
        appIndex: 0, // Stripe
        fit_score: 92,
        mismatch_reasons: [
          'Strong match on TypeScript, Node.js, Express, React, and PostgreSQL',
          'Minor gap: Resume lacks explicit mention of payment gateways/PCI-DSS compliance',
        ],
      },
      {
        appIndex: 1, // Vercel
        fit_score: 85,
        mismatch_reasons: [
          'Excellent match on Go, Redis Streams, Kafka, and distributed architecture',
          'Edge runtime experience could be highlighted more prominently',
        ],
      },
      {
        appIndex: 4, // Coinbase (Mismatched requirements)
        fit_score: 48,
        mismatch_reasons: [
          'Job requires 6+ years Rust/Go and low-latency trading engine experience; resume reflects 4 years general backend',
          'Missing blockchain protocols and cryptographic key management experience',
        ],
      },
    ];

    for (const analysis of sampleAnalyses) {
      const app = insertedApps[analysis.appIndex];
      const jdHash = computeHash(app.job_description);
      await pool.query(
        `INSERT INTO llm_analyses (application_id, fit_score, mismatch_reasons, job_description_hash)
         VALUES ($1, $2, $3, $4)`,
        [app.id, analysis.fit_score, JSON.stringify(analysis.mismatch_reasons), jdHash]
      );
      console.log(`Inserted cached LLM analysis for ${app.company_name} (Fit Score: ${analysis.fit_score}%)`);
    }

    console.log('--- Database Seeding Completed Successfully ---');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seed();
