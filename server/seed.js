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

    // 6. Additional Resumes for Hackathon Benchmark Suite (Additively Added)
    const evalResumesData = [
      {
        name: 'Junior Developer (Overclaiming Claims Variant)',
        content: `SUMMARY:
Principal Enterprise Architect & Global AI Director with 2 years of industry tenure. Spearheaded worldwide cloud transformation, designed quantum-ready cryptographic consensus algorithms, and directed engineering divisions across 5 continents.

EXPERIENCE:
Junior Web Assistant | WebStudio (2024 - Present)
- Maintained WordPress templates, styled HTML/CSS landing pages, and wrote vanilla JavaScript form validators.

SKILLS:
- Languages: JavaScript, HTML5, CSS3, Python (basic syntax)
- Claims: Distributed consensus architectures, Petabyte ML pipelines, Global organizational leadership, Quantum crypto`,
      },
      /**
       * =========================================================================================
       * EXPLICIT HARD CASE EXPLANATION:
       * -----------------------------------------------------------------------------------------
       * Why this is the official "Hard Case":
       * 1. This candidate's experience is 100% FACTUALLY ACCURATE and grounded in real-world systems
       *    engineering (Go, Linux kernel TCP tuning, eBPF, Kafka partition mechanics).
       * 2. However, the phrasing uses dense, extreme impact metrics:
       *    "1.2M requests/sec across 4-person pod", "p99 180ms to 4ms via Linux kernel TCP buffer pools",
       *    "100x traffic spike with 0.00% downtime".
       * 3. A naive single-shot LLM or baseline matcher will superficially flag these claims as
       *    "overclaiming", "unrealistic exaggeration", or "phrasing risk" because of the sheer magnitude
       *    of the performance statistics.
       * 4. The Agentic Verifier must correctly inspect the deep evidence, cross-reference the concrete
       *    stack (eBPF, Go, Kafka, TCP buffer tuning), and confirm that the metrics are substantiated,
       *    successfully AVOIDING a false-positive penalty.
       * =========================================================================================
       */
      {
        name: 'High-Velocity Distributed Systems Specialist (Dense Impact Framing - The Hard Case)',
        content: `SUMMARY:
Staff Systems & Distributed Infrastructure Engineer with 6 years of deep systems programming experience. Specializes in microsecond-latency network services, high-throughput message buses, and Linux kernel performance optimization.

CORE PRODUCTION ACHIEVEMENTS:
- Spearheaded the design and production deployment of a multi-region event streaming gateway serving 1.2M requests/second sustained across a lean 4-person infrastructure pod.
- Cut tail latency (p99) from 180ms to 4ms by rewriting core memory-mapped cache layer in Go and optimizing Linux kernel TCP buffer pools.
- Scaled real-time order matching engine across Black Friday 100x traffic spike with 0.00% downtime and zero message loss via Kafka cluster partition tuning.
- Implemented kernel-level eBPF packet filter preventing DDoS amplification attacks on production edge proxies.

SKILLS:
- Languages: Go (Golang), C++, Rust, SQL, Python
- Systems & Network: Linux eBPF, TCP/IP socket tuning, Epoll, gRPC, Memory-Mapped I/O
- Distributed Infrastructure: Apache Kafka (deep tuning), Redis, PostgreSQL, Docker, Kubernetes, AWS`,
      },
    ];

    const evalResumeRows = [];
    for (const r of evalResumesData) {
      const res = await pool.query(
        `INSERT INTO resumes (user_id, name, content)
         VALUES ($1, $2, $3)
         RETURNING id, name`,
        [user.id, r.name, r.content]
      );
      evalResumeRows.push(res.rows[0]);
      console.log(`Created eval resume: ${r.name} (ID: ${res.rows[0].id})`);
    }

    const [overclaimingResume, hardCaseResume] = evalResumeRows;

    // 7. Seed 18 Benchmark Evaluation Application Cases
    const evalApplicationsData = [
      // --- 10 Straightforward Matches / Mismatches ---
      {
        resume_id: fullstackResume.id,
        company_name: 'Shopify (Eval Case 1)',
        role_title: 'Senior Full Stack Developer - Commerce Platform',
        job_description: 'Looking for a Full Stack Engineer with 4+ years experience in React, TypeScript, Node.js, Express, and PostgreSQL to scale storefront checkout.',
        platform: 'direct',
        applied_at: daysAgo(5),
        status: 'applied',
      },
      {
        resume_id: backendResume.id,
        company_name: 'Confluent (Eval Case 2)',
        role_title: 'Backend Event Streaming Engineer',
        job_description: 'We need a backend specialist with Go, Kafka, Redis, and distributed systems architecture experience to build high-throughput data pipelines.',
        platform: 'wellfound',
        applied_at: daysAgo(6),
        status: 'applied',
      },
      {
        resume_id: devopsResume.id,
        company_name: 'AWS / Amazon (Eval Case 3)',
        role_title: 'Site Reliability & Kubernetes Specialist',
        job_description: 'Seeking a DevOps Engineer with deep Terraform, Kubernetes cluster orchestration, AWS infrastructure, and Prometheus observability expertise.',
        platform: 'linkedin',
        applied_at: daysAgo(7),
        status: 'applied',
      },
      {
        resume_id: fullstackResume.id,
        company_name: 'Vercel Frontend (Eval Case 4)',
        role_title: 'Junior React Frontend Developer',
        job_description: 'Join our team building UI components in React, TypeScript, HTML5, and Tailwind CSS. REST API integration experience required.',
        platform: 'direct',
        applied_at: daysAgo(8),
        status: 'applied',
      },
      {
        resume_id: backendResume.id,
        company_name: 'OpenAI ML (Eval Case 5)',
        role_title: 'Research Scientist - PyTorch & CUDA Models',
        job_description: 'Requires PhD or 5+ years deep research in PyTorch, CUDA kernel programming, transformer architectures, and training LLMs at scale.',
        platform: 'linkedin',
        applied_at: daysAgo(9),
        status: 'applied',
      },
      {
        resume_id: devopsResume.id,
        company_name: 'Apple Embedded (Eval Case 6)',
        role_title: 'Firmware & Embedded Hardware Engineer',
        job_description: 'Low-level RTOS, ARM microcontroller assembly, oscilloscope debugging, and C firmware development for consumer hardware devices.',
        platform: 'direct',
        applied_at: daysAgo(10),
        status: 'applied',
      },
      {
        resume_id: fullstackResume.id,
        company_name: 'Airbnb Mobile (Eval Case 7)',
        role_title: 'Staff iOS & Swift Application Architect',
        job_description: 'Lead our native iOS team with 7+ years Swift, UIKit, CoreData, Xcode Instruments, and App Store release lifecycle experience.',
        platform: 'linkedin',
        applied_at: daysAgo(11),
        status: 'applied',
      },
      {
        resume_id: backendResume.id,
        company_name: 'Cockroach Labs (Eval Case 8)',
        role_title: 'Distributed Database Engine Engineer',
        job_description: 'Work on distributed consensus (Raft), transactional MVCC storage engines, SQL query planning, and Go distributed systems.',
        platform: 'wellfound',
        applied_at: daysAgo(12),
        status: 'applied',
      },
      {
        resume_id: devopsResume.id,
        company_name: 'CrowdStrike (Eval Case 9)',
        role_title: 'Cloud Security & Infrastructure Compliance Engineer',
        job_description: 'Manage AWS/GCP security controls, IAM policies, Secrets Vault, SOC2 compliance automation, and Terraform IaC pipelines.',
        platform: 'direct',
        applied_at: daysAgo(13),
        status: 'applied',
      },
      {
        resume_id: fullstackResume.id,
        company_name: 'Snowflake Core (Eval Case 10)',
        role_title: 'Low-Level Rust Engine Developer',
        job_description: 'Requires 6+ years systems programming in Rust and C++ for SIMD vector execution engines and columnar file format parsers.',
        platform: 'linkedin',
        applied_at: daysAgo(14),
        status: 'applied',
      },

      // --- 4 Deliberate Overclaiming Cases ---
      {
        resume_id: overclaimingResume.id,
        company_name: 'Google Cloud (Eval Case 11 - Overclaim)',
        role_title: 'Principal Cloud Systems Architect',
        job_description: 'Looking for a Principal Architect to lead enterprise migration strategies for Fortune 500 companies across multi-cloud setups.',
        platform: 'direct',
        applied_at: daysAgo(15),
        status: 'applied',
      },
      {
        resume_id: overclaimingResume.id,
        company_name: 'DeepMind (Eval Case 12 - Overclaim)',
        role_title: 'Staff Quantum Computing & AI Research Lead',
        job_description: 'Lead quantum error correction and distributed quantum-classical hybrid algorithms for frontier intelligence exploration.',
        platform: 'wellfound',
        applied_at: daysAgo(16),
        status: 'applied',
      },
      {
        resume_id: overclaimingResume.id,
        company_name: 'Palantir Defense (Eval Case 13 - Overclaim)',
        role_title: 'Director of Global Cyber Warfare & Exploitation',
        job_description: 'Direct offensive cyber security teams, zero-day discovery programs, and national infrastructure defense architectures.',
        platform: 'linkedin',
        applied_at: daysAgo(17),
        status: 'applied',
      },
      {
        resume_id: overclaimingResume.id,
        company_name: 'Citadel Securities (Eval Case 14 - Overclaim)',
        role_title: 'Managing Director of High-Frequency Trading Desk',
        job_description: 'Direct trading strategies processing tens of billions in daily volume with sub-microsecond algorithmic execution.',
        platform: 'direct',
        applied_at: daysAgo(18),
        status: 'applied',
      },

      // --- 3 Sparse / Vague Job Descriptions ---
      {
        resume_id: fullstackResume.id,
        company_name: 'Stealth Startup Alpha (Eval Case 15 - Sparse JD)',
        role_title: 'Rockstar Software Ninja',
        job_description: 'We are looking for a rockstar coder who wants to build awesome web products fast. Must have good vibes and work hard.',
        platform: 'wellfound',
        applied_at: daysAgo(19),
        status: 'applied',
      },
      {
        resume_id: backendResume.id,
        company_name: 'Stealth AI Beta (Eval Case 16 - Sparse JD)',
        role_title: 'Backend Engineer',
        job_description: 'Backend engineer needed for high-growth stealth AI startup. Modern tech stack. Competitive salary and equity.',
        platform: 'direct',
        applied_at: daysAgo(20),
        status: 'applied',
      },
      {
        resume_id: devopsResume.id,
        company_name: 'Stealth Cloud Gamma (Eval Case 17 - Sparse JD)',
        role_title: 'Cloud Infrastructure Wizard',
        job_description: 'Looking for a cloud wizard to handle our servers and infrastructure. Join our fast paced dynamic team.',
        platform: 'linkedin',
        applied_at: daysAgo(21),
        status: 'applied',
      },

      // --- 1 Explicitly Hard Case ---
      {
        resume_id: hardCaseResume.id,
        company_name: 'Cloudflare / Edge (Eval Case 18 - The Hard Case)',
        role_title: 'Principal Edge Infrastructure & Performance Engineer',
        job_description: 'Seeking a senior systems engineer to scale multi-region edge proxies handling >1M requests/sec in Go/C++, Linux kernel network socket tuning, eBPF DDoS mitigation, and high-throughput Kafka ingestion with sub-10ms p99 latency.',
        platform: 'direct',
        applied_at: daysAgo(22),
        status: 'applied',
      },
    ];

    for (const app of evalApplicationsData) {
      await pool.query(
        `INSERT INTO applications (
          user_id, resume_id, company_name, role_title, job_description,
          platform, applied_at, status, last_status_check
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          user.id,
          app.resume_id,
          app.company_name,
          app.role_title,
          app.job_description,
          app.platform,
          app.applied_at,
          app.status,
        ]
      );
    }
    console.log(`Inserted ${evalApplicationsData.length} evaluation benchmark applications.`);

    console.log('--- Database Seeding Completed Successfully ---');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seed();
