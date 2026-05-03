from __future__ import annotations

import logging
from typing import Any

from langgraph.graph import END, START, StateGraph

from api.agents import tools
from api.agents.state import AgentMode, AgentState, ToolCall
from api.services import anthropic as ai

log = logging.getLogger(__name__)


# ── Node implementations ────────────────────────────────────────────────────

async def _plan(state: AgentState) -> AgentState:
    """Decide what to look for in the vault for this mode."""
    mode = state["mode"]
    jd = state.get("job_description", "")
    queries = _evidence_queries(mode, jd)
    state["plan"] = " | ".join(queries)
    return state


async def _gather_evidence(state: AgentState) -> AgentState:
    """Vault-everywhere gate: every advisory mode pulls evidence here."""
    mode = state["mode"]
    rag_tag = state.get("rag_tag", "")
    jd = state.get("job_description", "")
    queries = _evidence_queries(mode, jd)

    tool_calls: list[ToolCall] = list(state.get("tool_calls", []))
    evidence: list[dict] = list(state.get("evidence", []))

    for q in queries:
        hits = await tools.call("vault_search", {"query": q, "rag_tag": rag_tag, "limit": 6})
        tool_calls.append({"name": "vault_search", "args": {"query": q, "rag_tag": rag_tag}, "result": hits})
        for h in hits:
            evidence.append(h)

    state["tool_calls"] = tool_calls
    state["evidence"] = evidence
    return state


async def _act(state: AgentState) -> AgentState:
    """Run the LLM with the gathered vault evidence as context."""
    mode = state["mode"]
    persona = _PERSONAS[mode]
    user_prompt = state.get("user_prompt", "")
    rag_context = _format_evidence(state.get("evidence", []))

    output = await ai.complete(
        system_persona=persona,
        rag_context=rag_context,
        user_prompt=user_prompt,
        model=_MODEL_FOR[mode],
        max_tokens=_MAX_TOKENS_FOR[mode],
    )
    state["output"] = output
    return state


async def _finalize(state: AgentState) -> AgentState:
    state["finalized"] = True
    return state


# ── Graph construction ──────────────────────────────────────────────────────

def _build_graph() -> Any:
    g: StateGraph = StateGraph(AgentState)
    g.add_node("plan", _plan)
    g.add_node("gather_evidence", _gather_evidence)
    g.add_node("act", _act)
    g.add_node("finalize", _finalize)

    g.add_edge(START, "plan")
    g.add_edge("plan", "gather_evidence")
    g.add_edge("gather_evidence", "act")
    g.add_edge("act", "finalize")
    g.add_edge("finalize", END)

    return g.compile()


_graph: Any | None = None


def _get_graph() -> Any:
    global _graph
    if _graph is None:
        _graph = _build_graph()
    return _graph


async def run_agent(
    *,
    mode: AgentMode,
    user_prompt: str,
    rag_tag: str = "",
    job_description: str = "",
    resume_text: str = "",
    extra: dict[str, Any] | None = None,
) -> AgentState:
    """Run the agent end-to-end and return the final state."""
    initial: AgentState = {
        "mode": mode,
        "rag_tag": rag_tag,
        "user_prompt": user_prompt,
        "job_description": job_description,
        "resume_text": resume_text,
        "extra": extra or {},
        "evidence": [],
        "tool_calls": [],
    }
    graph = _get_graph()
    final: AgentState = await graph.ainvoke(initial)
    return final


# ── Mode-specific configuration ─────────────────────────────────────────────

def _evidence_queries(mode: AgentMode, jd: str) -> list[str]:
    """What to ask the vault for, per mode."""
    head = jd[:200] if jd else ""
    if mode == "rewrite_resume":
        return [f"resume accomplishments {head}", "metrics outcomes impact"]
    if mode == "draft_cover_letter":
        return [f"cover letter context {head}", "story arc motivation"]
    if mode == "draft_linkedin_post":
        return ["linkedin voice tone", "recent project highlights"]
    if mode == "analyze_jd":
        return [head or "job description requirements"]
    if mode == "score_match":
        return [f"experience evidence {head}", "skills and tools"]
    if mode == "interview_prep":
        return [f"behavioral story {head}", "STAR examples accomplishments"]
    if mode == "explain_fit":
        return [f"fit evidence {head}", "stack overlap"]
    return ["accomplishments"]


def _format_evidence(evidence: list[dict]) -> str:
    if not evidence:
        return ""
    seen: set[str] = set()
    chunks: list[str] = []
    for hit in evidence:
        filename = hit.get("filename", "")
        context = (hit.get("context") or "").strip()
        key = f"{filename}::{context[:60]}"
        if not context or key in seen:
            continue
        seen.add(key)
        chunks.append(f"[{filename}]\n{context}")
    return "\n\n---\n\n".join(chunks)


_PERSONAS: dict[AgentMode, str] = {
    "rewrite_resume": (
        "You are an expert résumé writer. You rewrite numbered résumé bullets "
        "to match a target role using only evidence from the candidate's vault. "
        "Same count, same structure, stronger keywords, no invented metrics. "
        "Return ONLY the numbered list."
    ),
    "draft_cover_letter": (
        "You are a sharp cover-letter writer. Tight, specific, vault-grounded. "
        "Three short paragraphs: hook, evidence, ask. No clichés."
    ),
    "draft_linkedin_post": (
        "You are a LinkedIn content strategist. Authentic, specific, no "
        "corporate gloss. Hook → insight → CTA. Under 1300 chars. Max 3 hashtags."
    ),
    "analyze_jd": (
        "You are a hiring-process analyst. Extract from the JD: must-have "
        "requirements, nice-to-haves, signals about culture/scope/seniority, "
        "and likely interview themes. Return concise bullets, grouped."
    ),
    "score_match": (
        "You are a calibrated fit-scorer. Score 0-100 against vault evidence. "
        "Return: score, three strengths (with vault citation), two gaps "
        "(with concrete next action), and a one-line verdict."
    ),
    "interview_prep": (
        "You are an interview coach. From the JD and vault evidence, draft "
        "the five most likely behavioral/technical questions and a STAR "
        "answer for each, grounded in vault accomplishments only."
    ),
    "explain_fit": (
        "You are a candid career advisor. In three bullets explain why this "
        "role fits, in two bullets name the real risks. Cite vault notes by "
        "filename. No fluff."
    ),
}

_MODEL_FOR: dict[AgentMode, str] = {
    "rewrite_resume": "claude-sonnet-4-6",
    "draft_cover_letter": "claude-sonnet-4-6",
    "draft_linkedin_post": "claude-sonnet-4-6",
    "analyze_jd": "claude-haiku-4-5-20251001",
    "score_match": "claude-sonnet-4-6",
    "interview_prep": "claude-sonnet-4-6",
    "explain_fit": "claude-haiku-4-5-20251001",
}

_MAX_TOKENS_FOR: dict[AgentMode, int] = {
    "rewrite_resume": 4096,
    "draft_cover_letter": 1500,
    "draft_linkedin_post": 700,
    "analyze_jd": 1500,
    "score_match": 1500,
    "interview_prep": 3000,
    "explain_fit": 800,
}
