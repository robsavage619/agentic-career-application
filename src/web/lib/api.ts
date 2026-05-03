const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export type Profile = {
  id: number;
  name: string;
  accent_color: string;
  avatar_emoji: string;
  rag_tag: string;
  created_at: string;
};

type ProfileUpdate = Partial<Omit<Profile, "id" | "created_at">>;

export type PipelineStage = "DISCOVERED" | "APPLIED" | "SCREENER" | "INTERVIEW" | "OFFER" | "CLOSED";

export type PipelineCard = {
  id: number;
  profile_id: number;
  job_id: number | null;
  stage: PipelineStage;
  title: string;
  company: string;
  url: string;
  deadline: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type CardCreate = {
  profile_id: number;
  title: string;
  company: string;
  stage?: PipelineStage;
  url?: string;
  deadline?: string | null;
  notes?: string;
  job_id?: number | null;
};

export type CardUpdate = Partial<Pick<PipelineCard, "title" | "company" | "stage" | "url" | "deadline" | "notes">>;

export type Job = {
  id: number;
  source: string;
  external_id: string;
  title: string;
  company: string;
  location: string;
  salary_min: number | null;
  salary_max: number | null;
  description: string;
  url: string;
  posted_at: string | null;
  fetched_at: string;
};

export type SavedJob = {
  id: number;
  profile_id: number;
  job_id: number;
  score: number | null;
  dismissed: boolean;
  saved_at: string;
  job: Job;
};

export type FetchRequest = {
  profile_id: number;
  keywords: string;
  location?: string;
  country?: string;
  remote_ok?: boolean;
  salary_min?: number | null;
};

export type LinkedInPost = {
  id: number;
  profile_id: number;
  content: string;
  status: "draft" | "scheduled" | "posted";
  scheduled_at: string | null;
  posted_at: string | null;
  created_at: string;
};

export type LinkedInStatus = {
  connected: boolean;
  urn?: string;
};

export type PanelSession = {
  id: number;
  profile_id: number;
  document_type: string;
  document_snapshot: string;
  reviews_json: string;
  created_at: string;
};

export type CoverLetter = {
  id: number;
  profile_id: number;
  pipeline_card_id: number | null;
  content: string;
  created_at: string;
};

export type BaseResume = {
  id: number;
  profile_id: number;
  name: string;
  uploaded_at: string;
};

export type ResumeVersion = {
  id: number;
  base_resume_id: number;
  pipeline_card_id: number | null;
  jd_snapshot: string;
  created_at: string;
};

// ── Briefing / Fit / Decisions ─────────────────────────────────────────────

export type BriefingJob = {
  saved_job_id: number;
  job_id: number;
  title: string;
  company: string;
  location: string;
  url: string;
  score: number | null;
  saved_at: string;
};

export type BriefingCard = {
  card_id: number;
  title: string;
  company: string;
  stage: PipelineStage;
  url: string;
  deadline: string | null;
  days_since_update: number;
};

export type BriefingFollowUp = {
  card_id: number;
  title: string;
  company: string;
  stage: PipelineStage;
  days_in_stage: number;
  suggested_action: string;
};

export type BriefingCounts = {
  new_jobs: number;
  deadlines_today: number;
  stalled_cards: number;
  follow_ups: number;
  pipeline_open: number;
};

export type Briefing = {
  generated_at: string;
  profile_id: number;
  counts: BriefingCounts;
  new_jobs: BriefingJob[];
  deadlines_today: BriefingCard[];
  stalled_cards: BriefingCard[];
  follow_ups: BriefingFollowUp[];
};

export type FitEvidence = { filename: string; context: string };
export type FitScore = {
  score: number | null;
  verdict: string;
  output: string;
  evidence: FitEvidence[];
};
export type FitExplain = { output: string; evidence: FitEvidence[] };

export type DecisionLogEntry = {
  saved_job_id: number;
  job_id: number;
  title: string;
  company: string;
  decision: "dismissed" | "saved";
  reason: string;
  decided_at: string;
};

export const api = {
  profiles: {
    list: () => request<Profile[]>("/api/profiles/"),
    get: (id: number) => request<Profile>(`/api/profiles/${id}`),
    create: (data: Omit<Profile, "id" | "created_at">) =>
      request<Profile>("/api/profiles/", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: ProfileUpdate) =>
      request<Profile>(`/api/profiles/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  },
  pipeline: {
    list: (profileId: number) => request<PipelineCard[]>(`/api/pipeline/?profile_id=${profileId}`),
    create: (data: CardCreate) =>
      request<PipelineCard>("/api/pipeline/", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: CardUpdate) =>
      request<PipelineCard>(`/api/pipeline/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: number) =>
      fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/pipeline/${id}`, { method: "DELETE" }),
  },
  jobs: {
    list: (profileId: number, dismissed = false) =>
      request<SavedJob[]>(`/api/jobs/?profile_id=${profileId}&dismissed=${dismissed}`),
    fetch: (data: FetchRequest) =>
      request<{ fetched: number; new: number }>("/api/jobs/fetch", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    dismiss: (savedJobId: number) =>
      request<{ ok: boolean }>(`/api/jobs/${savedJobId}/dismiss`, { method: "PATCH" }),
  },
  resume: {
    listBases: (profileId: number) => request<BaseResume[]>(`/api/resume/bases?profile_id=${profileId}`),
    upload: (profileId: number, file: File) => {
      const form = new FormData();
      form.append("file", file);
      return fetch(`${BASE}/api/resume/bases?profile_id=${profileId}`, {
        method: "POST",
        body: form,
      }).then((r) => r.json() as Promise<BaseResume>);
    },
    deleteBase: (id: number) =>
      fetch(`${BASE}/api/resume/bases/${id}`, { method: "DELETE" }),
    listVersions: (baseResumeId: number) =>
      request<ResumeVersion[]>(`/api/resume/versions?base_resume_id=${baseResumeId}`),
    generate: (data: { base_resume_id: number; job_description: string; pipeline_card_id?: number | null }) =>
      request<ResumeVersion>("/api/resume/generate", { method: "POST", body: JSON.stringify(data) }),
    downloadUrl: (versionId: number) => `${BASE}/api/resume/versions/${versionId}/download`,
  },
  letters: {
    list: (profileId: number) => request<CoverLetter[]>(`/api/cover-letter/?profile_id=${profileId}`),
    generateStream: (data: {
      profile_id: number; job_title: string; company: string;
      job_description: string; pipeline_card_id?: number | null;
    }) =>
      fetch(`${BASE}/api/cover-letter/generate/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    update: (id: number, content: string) =>
      request<CoverLetter>(`/api/cover-letter/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ content }),
      }),
    delete: (id: number) =>
      fetch(`${BASE}/api/cover-letter/${id}`, { method: "DELETE" }),
    downloadUrl: (id: number) => `${BASE}/api/cover-letter/${id}/download`,
  },
  panel: {
    list: (profileId: number) => request<PanelSession[]>(`/api/panel/?profile_id=${profileId}`),
    create: (data: { profile_id: number; document_type: string; document_snapshot: string }) =>
      request<PanelSession>("/api/panel/", { method: "POST", body: JSON.stringify(data) }),
    get: (id: number) => request<PanelSession>(`/api/panel/${id}`),
    delete: (id: number) => fetch(`${BASE}/api/panel/${id}`, { method: "DELETE" }),
  },
  linkedin: {
    status: (profileId: number) => request<LinkedInStatus>(`/api/linkedin/status/${profileId}`),
    authUrl: (profileId: number) => `${BASE}/api/linkedin/auth/${profileId}`,
    posts: (profileId: number) => request<LinkedInPost[]>(`/api/linkedin/posts?profile_id=${profileId}`),
    generatePost: (data: { profile_id: number; topic: string; angle?: string }) =>
      request<LinkedInPost>("/api/linkedin/posts/generate", { method: "POST", body: JSON.stringify(data) }),
    updatePost: (id: number, data: { content?: string; status?: string }) =>
      request<LinkedInPost>(`/api/linkedin/posts/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    publishPost: (id: number) =>
      request<LinkedInPost>(`/api/linkedin/posts/${id}/publish`, { method: "POST" }),
    deletePost: (id: number) => fetch(`${BASE}/api/linkedin/posts/${id}`, { method: "DELETE" }),
  },
  dashboard: {
    briefing: (profileId: number) =>
      request<Briefing>(`/api/dashboard/briefing?profile_id=${profileId}`),
    writebackBriefing: (profileId: number) =>
      request<{ written: boolean; path: string }>(
        `/api/dashboard/briefing/writeback?profile_id=${profileId}`,
        { method: "POST" }
      ),
  },
  fit: {
    score: (data: { profile_id: number; job_description: string; job_title?: string; company?: string }) =>
      request<FitScore>(`/api/fit/score`, { method: "POST", body: JSON.stringify(data) }),
    explain: (data: { profile_id: number; job_description: string; job_title?: string; company?: string }) =>
      request<FitExplain>(`/api/fit/explain`, { method: "POST", body: JSON.stringify(data) }),
  },
  decisions: {
    list: (profileId: number, limit = 50) =>
      request<DecisionLogEntry[]>(`/api/jobs/decisions?profile_id=${profileId}&limit=${limit}`),
  },
};
