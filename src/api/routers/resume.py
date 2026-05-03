from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import Response
from sqlmodel import Session, SQLModel, select

from api.db import get_session
from api.models.profile import Profile
from api.models.resume import BaseResume, ResumeVersion
from api.services import resume_engine

router = APIRouter()


# ── Base resumes ────────────────────────────────────────────────────────────

class BaseResumeOut(SQLModel):
    id: int
    profile_id: int
    name: str
    uploaded_at: str


@router.get("/bases")
def list_base_resumes(
    profile_id: int,
    session: Session = Depends(get_session),
) -> list[BaseResumeOut]:
    rows = session.exec(
        select(BaseResume).where(BaseResume.profile_id == profile_id)
    ).all()
    return [
        BaseResumeOut(
            id=r.id,  # type: ignore[arg-type]
            profile_id=r.profile_id,
            name=r.name,
            uploaded_at=r.uploaded_at.isoformat(),
        )
        for r in rows
    ]


@router.post("/bases", status_code=201)
async def upload_base_resume(
    profile_id: int,
    file: UploadFile,
    session: Session = Depends(get_session),
) -> BaseResumeOut:
    if not file.filename or not file.filename.endswith(".docx"):
        raise HTTPException(status_code=400, detail="Only .docx files are accepted")
    content = await file.read()
    resume = BaseResume(profile_id=profile_id, name=file.filename, docx_bytes=content)
    session.add(resume)
    session.commit()
    session.refresh(resume)
    return BaseResumeOut(
        id=resume.id,  # type: ignore[arg-type]
        profile_id=resume.profile_id,
        name=resume.name,
        uploaded_at=resume.uploaded_at.isoformat(),
    )


@router.delete("/bases/{resume_id}", status_code=204)
def delete_base_resume(resume_id: int, session: Session = Depends(get_session)) -> None:
    r = session.get(BaseResume, resume_id)
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    session.delete(r)
    session.commit()


# ── Versions ────────────────────────────────────────────────────────────────

class VersionOut(SQLModel):
    id: int
    base_resume_id: int
    pipeline_card_id: int | None
    jd_snapshot: str
    created_at: str


class GenerateRequest(SQLModel):
    base_resume_id: int
    job_description: str
    pipeline_card_id: int | None = None


@router.get("/versions")
def list_versions(
    base_resume_id: int,
    session: Session = Depends(get_session),
) -> list[VersionOut]:
    rows = session.exec(
        select(ResumeVersion)
        .where(ResumeVersion.base_resume_id == base_resume_id)
        .order_by(ResumeVersion.created_at.desc())  # type: ignore[arg-type]
    ).all()
    return [
        VersionOut(
            id=v.id,  # type: ignore[arg-type]
            base_resume_id=v.base_resume_id,
            pipeline_card_id=v.pipeline_card_id,
            jd_snapshot=v.jd_snapshot[:200],
            created_at=v.created_at.isoformat(),
        )
        for v in rows
    ]


@router.post("/generate")
async def generate_version(
    data: GenerateRequest,
    session: Session = Depends(get_session),
) -> VersionOut:
    base = session.get(BaseResume, data.base_resume_id)
    if not base:
        raise HTTPException(status_code=404, detail="Base resume not found")

    profile = session.get(Profile, base.profile_id)
    rag_tag = profile.rag_tag if profile else "rob"

    new_bytes = await resume_engine.rewrite(
        docx_bytes=base.docx_bytes,
        job_description=data.job_description,
        rag_tag=rag_tag,
    )

    version = ResumeVersion(
        base_resume_id=base.id,  # type: ignore[arg-type]
        pipeline_card_id=data.pipeline_card_id,
        docx_bytes=new_bytes,
        jd_snapshot=data.job_description[:500],
    )
    session.add(version)
    session.commit()
    session.refresh(version)

    return VersionOut(
        id=version.id,  # type: ignore[arg-type]
        base_resume_id=version.base_resume_id,
        pipeline_card_id=version.pipeline_card_id,
        jd_snapshot=version.jd_snapshot,
        created_at=version.created_at.isoformat(),
    )


@router.get("/versions/{version_id}/download")
def download_version(version_id: int, session: Session = Depends(get_session)) -> Response:
    v = session.get(ResumeVersion, version_id)
    if not v:
        raise HTTPException(status_code=404, detail="Not found")
    return Response(
        content=v.docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename=resume_v{version_id}.docx"},
    )


@router.get("/versions/{version_id}/diff")
def diff_version(version_id: int, session: Session = Depends(get_session)) -> dict:
    """Return a line-pair diff between the base resume and this version."""
    from difflib import SequenceMatcher

    from api.models.resume import BaseResume
    from api.services.resume_engine import extract_lines

    v = session.get(ResumeVersion, version_id)
    if not v:
        raise HTTPException(status_code=404, detail="Version not found")
    base = session.get(BaseResume, v.base_resume_id)
    if not base:
        raise HTTPException(status_code=404, detail="Base resume not found")

    base_lines = extract_lines(base.docx_bytes)
    new_lines = extract_lines(v.docx_bytes)

    pairs: list[dict] = []
    matcher = SequenceMatcher(a=base_lines, b=new_lines, autojunk=False)
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            for k in range(i2 - i1):
                pairs.append({"kind": "unchanged", "base": base_lines[i1 + k], "version": new_lines[j1 + k]})
        elif tag == "replace":
            # Pair up changed lines positionally; pad with blanks if lengths differ
            ll = max(i2 - i1, j2 - j1)
            for k in range(ll):
                pairs.append({
                    "kind": "changed",
                    "base": base_lines[i1 + k] if k < (i2 - i1) else "",
                    "version": new_lines[j1 + k] if k < (j2 - j1) else "",
                })
        elif tag == "delete":
            for k in range(i2 - i1):
                pairs.append({"kind": "removed", "base": base_lines[i1 + k], "version": ""})
        elif tag == "insert":
            for k in range(j2 - j1):
                pairs.append({"kind": "added", "base": "", "version": new_lines[j1 + k]})

    changes = sum(1 for p in pairs if p["kind"] != "unchanged")
    return {
        "base_id": base.id,
        "version_id": v.id,
        "created_at": v.created_at.isoformat(),
        "jd_snapshot": v.jd_snapshot,
        "pairs": pairs,
        "changes": changes,
        "total": len(pairs),
    }
