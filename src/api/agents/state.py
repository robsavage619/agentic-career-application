from __future__ import annotations

from typing import Any, Literal, TypedDict

AgentMode = Literal[
    "rewrite_resume",
    "draft_cover_letter",
    "draft_linkedin_post",
    "analyze_jd",
    "score_match",
    "interview_prep",
    "explain_fit",
]


class ToolCall(TypedDict):
    name: str
    args: dict[str, Any]
    result: Any


class _RequiredAgentState(TypedDict):
    mode: AgentMode
    rag_tag: str
    user_prompt: str
    job_description: str
    resume_text: str
    extra: dict[str, Any]
    evidence: list[dict]
    tool_calls: list[ToolCall]


class AgentState(_RequiredAgentState, total=False):
    """State carried across LangGraph nodes for a single agent run.

    Required keys are populated by `run_agent`; optional keys (`plan`,
    `output`, `finalized`) accumulate as the graph executes.
    """

    plan: str
    output: str
    finalized: bool
