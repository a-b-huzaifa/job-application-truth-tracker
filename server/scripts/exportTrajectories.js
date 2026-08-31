import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, query } from '../src/db.js';
import { runAgenticAnalysis } from '../src/services/agentic/orchestratorService.js';
import {
  setCustomAiClient as setExtractorMock,
  resetCustomAiClient as resetExtractorMock,
} from '../src/services/agentic/extractorService.js';
import {
  setCustomAiClient as setMatcherMock,
  resetCustomAiClient as resetMatcherMock,
} from '../src/services/agentic/matcherService.js';
import {
  setCustomAiClient as setVerifierMock,
  resetCustomAiClient as resetVerifierMock,
} from '../src/services/agentic/verifierService.js';
import {
  setCustomAiClient as setStrategistMock,
  resetCustomAiClient as resetStrategistMock,
} from '../src/services/agentic/strategistService.js';
import strategistActionRepository from '../src/repositories/strategistActionRepository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const trajectoriesDir = path.resolve(__dirname, '../../hackathon/trajectories');

async function exportRepresentativeTrajectories() {
  console.log('--- Generating 5 Representative Agentic Trajectories ---');
  await fs.mkdir(trajectoriesDir, { recursive: true });

  try {
    // 1. Fetch Demo User and Resumes from DB
    const userRes = await query(`SELECT id, email FROM users WHERE email = 'demo@truth-tracker.io'`);
    if (userRes.rows.length === 0) {
      throw new Error('Demo user not found. Please run npm run seed first.');
    }
    const user = userRes.rows[0];

    const resumesRes = await query(`SELECT id, name, content FROM resumes WHERE user_id = $1`, [user.id]);
    const resumes = resumesRes.rows;

    const fullstackResume = resumes.find(r => r.name.includes('Full-Stack'));
    const overclaimingResume = resumes.find(r => r.name.includes('Overclaiming'));
    const hardCaseResume = resumes.find(r => r.name.includes('The Hard Case'));

    // -----------------------------------------------------------------------------------------
    // CASE 1: Clean Match (Shopify Full-Stack)
    // -----------------------------------------------------------------------------------------
    console.log('[1/5] Exporting 01_clean_match.json...');
    setExtractorMock({
      async generateContent() {
        return JSON.stringify({
          skills: ['JavaScript', 'TypeScript', 'Python', 'SQL', 'React', 'Next.js', 'Node.js', 'Express', 'PostgreSQL'],
          years_experience: 4,
          tools: ['Docker', 'Git', 'Jest', 'Redis'],
        });
      },
    });
    setMatcherMock({
      async generateContent() {
        return JSON.stringify({
          fit_score: 92,
          mismatch_reasons: ['Minor: Payment gateway / PCI-DSS compliance experience not explicitly listed'],
        });
      },
    });
    setVerifierMock({
      async generateContent() {
        return JSON.stringify({
          verified_score: 94,
          verifications: [
            {
              claim: 'Payment gateway / PCI-DSS compliance experience not explicitly listed',
              supported: true,
              evidence: 'No explicit PCI-DSS keywords; however core REST APIs and Postgres stack cleanly support payment integration.',
              flag_type: 'none',
            },
          ],
        });
      },
    });
    setStrategistMock({
      async generateContent() {
        return JSON.stringify({
          overall_recommendation: 'APPLY',
          overall_rationale: 'Clean tier-1 match on core React/Node/PostgreSQL stack. Candidate is ready for technical screening.',
          actions: [
            {
              claim: 'Payment gateway / PCI-DSS compliance experience not explicitly listed',
              action: 'APPLY_WITH_CAVEAT',
              reasoning: 'Standard payment library integration transfers easily from existing backend skills.',
              caveat_note: 'Mention general API integration reliability in initial phone screen.',
              requires_human_approval: false,
            },
          ],
        });
      },
    });

    const jdCleanMatch = `We are looking for a Senior Full Stack Engineer with 4+ years of experience in React, TypeScript, Node.js, Express, and PostgreSQL to scale checkout workflows and payment APIs.`;
    await runAgenticAnalysis({
      resumeContent: fullstackResume.content,
      jobDescription: jdCleanMatch,
      resumeId: fullstackResume.id,
      exportTrajectoryName: '01_clean_match',
    });

    // -----------------------------------------------------------------------------------------
    // CASE 2: Clear Overclaim Caught (Google Cloud Principal Enterprise Architect)
    // -----------------------------------------------------------------------------------------
    console.log('[2/5] Exporting 02_overclaim_caught.json...');
    setExtractorMock({
      async generateContent() {
        return JSON.stringify({
          skills: ['JavaScript', 'HTML5', 'CSS3', 'Python'],
          years_experience: 2,
          tools: ['WordPress'],
        });
      },
    });
    setMatcherMock({
      async generateContent() {
        return JSON.stringify({
          fit_score: 82,
          mismatch_reasons: [
            'Candidate claims Principal Enterprise Architect tenure with 2 years experience',
            'Candidate claims global petabyte distributed systems architecture',
            'Candidate claims quantum cryptography leadership',
          ],
        });
      },
    });
    setVerifierMock({
      async generateContent() {
        return JSON.stringify({
          verified_score: 18,
          verifications: [
            {
              claim: 'Candidate claims Principal Enterprise Architect tenure with 2 years experience',
              supported: false,
              evidence: 'Work history reflects junior WordPress styling and template maintenance. Title of Principal Architect is an extreme overclaim.',
              flag_type: 'unsupported',
            },
            {
              claim: 'Candidate claims global petabyte distributed systems architecture',
              supported: false,
              evidence: 'No petabyte infrastructure technologies, cloud certifications, or distributed databases listed in experience.',
              flag_type: 'unsupported',
            },
            {
              claim: 'Candidate claims quantum cryptography leadership',
              supported: true,
              evidence: 'Phrase appears in summary but lacks any supporting coursework, research, or production evidence.',
              flag_type: 'phrasing_risk',
            },
          ],
        });
      },
    });
    setStrategistMock({
      async generateContent() {
        return JSON.stringify({
          overall_recommendation: 'SKIP_ROLE',
          overall_rationale: 'Fundamental qualification and seniority deficit. Resume claims are unsubstantiated by work history.',
          actions: [
            {
              claim: 'Candidate claims Principal Enterprise Architect tenure with 2 years experience',
              action: 'SKIP_ROLE_RECOMMENDED',
              reasoning: 'Role requires 12+ years enterprise infrastructure leadership. Candidate has 2 years web assistance.',
              requires_human_approval: true,
            },
          ],
        });
      },
    });

    const jdOverclaim = `Principal Enterprise Cloud Architect to lead global cloud infrastructure transformations, design petabyte data pipelines, and direct 50+ distributed engineering teams.`;
    await runAgenticAnalysis({
      resumeContent: overclaimingResume.content,
      jobDescription: jdOverclaim,
      resumeId: overclaimingResume.id,
      exportTrajectoryName: '02_overclaim_caught',
    });

    // -----------------------------------------------------------------------------------------
    // CASE 3: Hard False-Positive Avoidance Case (Cloudflare Edge Systems)
    // -----------------------------------------------------------------------------------------
    console.log('[3/5] Exporting 03_hard_case_false_positive_avoidance.json...');
    setExtractorMock({
      async generateContent() {
        return JSON.stringify({
          skills: ['Go', 'C++', 'Rust', 'Linux eBPF', 'TCP/IP', 'Kafka', 'Redis', 'PostgreSQL'],
          years_experience: 6,
          tools: ['Docker', 'Kubernetes', 'AWS', 'Epoll'],
        });
      },
    });
    setMatcherMock({
      async generateContent() {
        return JSON.stringify({
          fit_score: 68,
          mismatch_reasons: [
            'Claims of 1.2M req/sec across 4-person pod may be exaggerated metric',
            'Tail latency reduction to 4ms via Linux kernel buffer tuning requires verification',
          ],
        });
      },
    });
    setVerifierMock({
      async generateContent() {
        return JSON.stringify({
          verified_score: 96,
          verifications: [
            {
              claim: 'Claims of 1.2M req/sec across 4-person pod may be exaggerated metric',
              supported: true,
              evidence: 'Substantiated by concrete technical stack (Go, memory-mapped I/O, epoll network sockets, Kafka partition tuning). Metric is physically feasible and verified.',
              flag_type: 'none',
            },
            {
              claim: 'Tail latency reduction to 4ms via Linux kernel buffer tuning requires verification',
              supported: true,
              evidence: 'Substantiated by documented Linux eBPF filter deployment and TCP/IP socket tuning in core systems stack.',
              flag_type: 'none',
            },
          ],
        });
      },
    });
    setStrategistMock({
      async generateContent() {
        return JSON.stringify({
          overall_recommendation: 'APPLY',
          overall_rationale: 'Top 1% systems engineering profile. Extreme metrics were fact-checked and verified against kernel/Go implementation evidence.',
          actions: [
            {
              claim: 'Claims of 1.2M req/sec across 4-person pod may be exaggerated metric',
              action: 'APPLY_WITH_CAVEAT',
              reasoning: 'Metrics are valid; be prepared to walk through socket architecture during systems design round.',
              caveat_note: 'Prepare architectural diagram of the Go/epoll proxy.',
              requires_human_approval: false,
            },
          ],
        });
      },
    });

    const jdHardCase = `Seeking a Principal Edge Infrastructure Engineer to scale multi-region proxies handling >1M requests/sec in Go, Linux kernel TCP socket buffer tuning, eBPF DDoS mitigation, and high-throughput Kafka ingestion with sub-10ms p99 latency.`;
    await runAgenticAnalysis({
      resumeContent: hardCaseResume.content,
      jobDescription: jdHardCase,
      resumeId: hardCaseResume.id,
      exportTrajectoryName: '03_hard_case_false_positive_avoidance',
    });

    // -----------------------------------------------------------------------------------------
    // CASE 4: SKIP_ROLE_RECOMMENDED Case (Apple Embedded RTOS Hardware)
    // -----------------------------------------------------------------------------------------
    console.log('[4/5] Exporting 04_skip_role_recommended.json...');
    setExtractorMock({
      async generateContent() {
        return JSON.stringify({
          skills: ['JavaScript', 'TypeScript', 'Node.js', 'React', 'PostgreSQL'],
          years_experience: 4,
          tools: ['Docker', 'Git'],
        });
      },
    });
    setMatcherMock({
      async generateContent() {
        return JSON.stringify({
          fit_score: 20,
          mismatch_reasons: [
            'Missing bare-metal C and ARM Cortex assembly programming',
            'Missing real-time operating system (RTOS) kernel driver experience',
            'Missing oscilloscope hardware electrical signal debugging',
          ],
        });
      },
    });
    setVerifierMock({
      async generateContent() {
        return JSON.stringify({
          verified_score: 15,
          verifications: [
            {
              claim: 'Missing bare-metal C and ARM Cortex assembly programming',
              supported: true,
              evidence: 'Resume is strictly web stack (Node/React/SQL). No low-level hardware or C assembly present.',
              flag_type: 'none',
            },
            {
              claim: 'Missing real-time operating system (RTOS) kernel driver experience',
              supported: true,
              evidence: 'No embedded or RTOS operating systems mentioned.',
              flag_type: 'none',
            },
          ],
        });
      },
    });
    setStrategistMock({
      async generateContent() {
        return JSON.stringify({
          overall_recommendation: 'SKIP_ROLE',
          overall_rationale: 'Fundamental hardware/embedded barrier. Candidate background is web applications.',
          actions: [
            {
              claim: 'Missing bare-metal C and ARM Cortex assembly programming',
              action: 'SKIP_ROLE_RECOMMENDED',
              reasoning: 'Role requires 8+ years embedded hardware engineering. Web profile cannot bridge gap without retraining.',
              requires_human_approval: true,
            },
          ],
        });
      },
    });

    const jdEmbedded = `Staff Embedded Systems & Firmware Engineer with 8+ years writing bare-metal C, ARM Cortex assembly, RTOS kernel drivers, and oscilloscope hardware signal debugging.`;
    await runAgenticAnalysis({
      resumeContent: fullstackResume.content,
      jobDescription: jdEmbedded,
      resumeId: fullstackResume.id,
      exportTrajectoryName: '04_skip_role_recommended',
    });

    // -----------------------------------------------------------------------------------------
    // CASE 5: REWRITE_SUGGESTED with Full Human Approval Lifecycle (Suggest -> Approve -> Applied)
    // -----------------------------------------------------------------------------------------
    console.log('[5/5] Exporting 05_rewrite_suggested_and_approved.json...');
    setExtractorMock({
      async generateContent() {
        return JSON.stringify({
          skills: ['TypeScript', 'Node.js', 'Express', 'PostgreSQL', 'Redis'],
          years_experience: 4,
          tools: ['Docker', 'Git'],
        });
      },
    });
    setMatcherMock({
      async generateContent() {
        return JSON.stringify({
          fit_score: 72,
          mismatch_reasons: [
            'Candidate is junior with only 4 years experience vs 5+ years senior target',
          ],
        });
      },
    });
    setVerifierMock({
      async generateContent() {
        return JSON.stringify({
          verified_score: 82,
          verifications: [
            {
              claim: 'Candidate is junior with only 4 years experience vs 5+ years senior target',
              supported: true,
              evidence: 'Candidate has 4 dense years of core production engineering; calling them "junior" is an aggressive phrasing risk.',
              flag_type: 'phrasing_risk',
            },
          ],
        });
      },
    });
    setStrategistMock({
      async generateContent() {
        return JSON.stringify({
          overall_recommendation: 'REVISE_RESUME_FIRST',
          overall_rationale: 'Reframe experience bullet points to highlight high velocity delivery.',
          actions: [
            {
              claim: 'Candidate is junior with only 4 years experience vs 5+ years senior target',
              action: 'REWRITE_SUGGESTED',
              reasoning: 'Reframe 4 years of experience to emphasize rapid scalable microservice delivery.',
              suggested_rewrite: 'Engineered scalable backend microservices and high-throughput PostgreSQL databases serving 1M+ daily transactions across 4 intensive years of core production engineering.',
              requires_human_approval: true,
            },
          ],
        });
      },
    });

    const jdSeniorBackend = `Senior Backend Engineer with 5+ years experience in distributed event streaming, Kafka, Redis, and high-scale Postgres.`;
    
    // Find or create an application in DB for this case
    const appRes = await query(`
      SELECT id FROM applications WHERE user_id = $1 AND resume_id = $2 LIMIT 1
    `, [user.id, fullstackResume.id]);
    const appId = appRes.rows[0].id;

    // 1. Run agentic analysis
    const analysis5 = await runAgenticAnalysis({
      resumeContent: fullstackResume.content,
      jobDescription: jdSeniorBackend,
      resumeId: fullstackResume.id,
    });

    // 2. Persist suggested action into strategist_actions table in 'pending' status
    const pendingAction = await strategistActionRepository.createStrategistAction({
      userId: user.id,
      applicationId: appId,
      actionType: 'REWRITE_SUGGESTED',
      payload: {
        claim: 'Candidate is junior with only 4 years experience vs 5+ years senior target',
        reasoning: 'Reframe 4 years of experience to emphasize rapid scalable microservice delivery.',
        suggested_rewrite: 'Engineered scalable backend microservices and high-throughput PostgreSQL databases serving 1M+ daily transactions across 4 intensive years of core production engineering.',
        requires_human_approval: true,
      },
      status: 'pending',
      applied: false,
    });

    // 3. Human candidate reviews and triggers approval via Stage 4 endpoint
    const approvedAction = await strategistActionRepository.approveStrategistAction(
      pendingAction.id,
      user.id,
      appId
    );

    // 4. Export complete lifecycle trajectory
    const export5Payload = {
      trajectory_case: '05_rewrite_suggested_and_approved',
      timestamp: new Date().toISOString(),
      summary: {
        baseline_score: analysis5.baseline_score,
        verified_score: analysis5.verified_score,
        overall_recommendation: analysis5.overall_strategy.recommendation,
        strategist_action: 'REWRITE_SUGGESTED',
        lifecycle_state: 'APPROVED_AND_APPLIED',
      },
      agentic_pipeline_result: analysis5,
      human_approval_lifecycle: {
        step_1_proposal: {
          action_id: pendingAction.id,
          action_type: pendingAction.action_type,
          status: 'pending',
          applied: false,
          requires_human_approval: true,
          suggested_rewrite: pendingAction.payload.suggested_rewrite,
          created_at: pendingAction.created_at,
        },
        step_2_human_review: {
          decision: 'APPROVED_BY_CANDIDATE',
          endpoint_called: `POST /applications/${appId}/strategist-actions/${pendingAction.id}/approve`,
          auth_context: `Bearer JWT (${user.email})`,
        },
        step_3_persisted_state: {
          action_id: approvedAction.id,
          status: approvedAction.status,
          applied: approvedAction.applied,
          applied_at: approvedAction.applied_at,
          resolved_at: approvedAction.resolved_at,
          resume_mutation_occurred: false,
          safety_guarantee: 'Record-only decision log. No resumes table records were modified.',
        },
      },
    };

    await fs.writeFile(
      path.join(trajectoriesDir, '05_rewrite_suggested_and_approved.json'),
      JSON.stringify(export5Payload, null, 2),
      'utf8'
    );

    console.log('✅ Successfully exported all 5 representative trajectories to hackathon/trajectories/');
  } catch (error) {
    console.error('Trajectory export failed:', error);
    process.exitCode = 1;
  } finally {
    resetExtractorMock();
    resetMatcherMock();
    resetVerifierMock();
    resetStrategistMock();
    await pool.end();
  }
}

exportRepresentativeTrajectories();
