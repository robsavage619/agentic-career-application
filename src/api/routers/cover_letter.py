from __future__ import annotations

import io

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, StreamingResponse
from sqlmodel import Session, SQLModel, select

from api.agents import run_agent
from api.db import get_session
from api.models.cover_letter import CoverLetter
from api.models.profile import Profile

router = APIRouter()


class GenerateRequest(SQLModel):
    profile_id: int
    job_title: str
    company: str
    job_description: str
    pipeline_card_id: int | None = None


class UpdateRequest(SQLModel):
    content: str


class LetterOut(SQLModel):
    id: int
    profile_id: int
    pipeline_card_id: int | None
    content: str
    created_at: str


@router.get("/")
def list_letters(
    profile_id: int,
    session: Session = Depends(get_session),
) -> list[LetterOut]:
    rows = session.exec(
        select(CoverLetter)
        .where(CoverLetter.profile_id == profile_id)
        .order_by(CoverLetter.created_at.desc())  # type: ignore[arg-type]
    ).all()
    return [
        LetterOut(
            id=r.id,  # type: ignore[arg-type]
            profile_id=r.profile_id,
            pipeline_card_id=r.pipeline_card_id,
            content=r.content,
            created_at=r.created_at.isoformat(),
        )
        for r in rows
    ]


@router.post("/generate/stream")
async def generate_stream(
    data: GenerateRequest,
    session: Session = Depends(get_session),
) -> StreamingResponse:
    profile = session.get(Profile, data.profile_id)
    rag_tag = profile.rag_tag if profile else "rob"

    user_prompt = (
        f"Write a cover letter for:\n"
        f"Role: {data.job_title}\n"
        f"Company: {data.company}\n\n"
        f"<job_description>\n{data.job_description[:2000]}\n</job_description>"
    )

    async def event_stream():
        final = await run_agent(
            mode="draft_cover_letter",
            user_prompt=user_prompt,
            rag_tag=rag_tag,
            job_description=data.job_description,
        )
        content = final.get("output", "")

        letter = CoverLetter(
            profile_id=data.profile_id,
            pipeline_card_id=data.pipeline_card_id,
            content=content,
        )
        session.add(letter)
        session.commit()

        yield f"data: {content}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.patch("/{letter_id}")
def update_letter(
    letter_id: int,
    data: UpdateRequest,
    session: Session = Depends(get_session),
) -> LetterOut:
    letter = session.get(CoverLetter, letter_id)
    if not letter:
        raise HTTPException(status_code=404, detail="Not found")
    letter.content = data.content
    session.add(letter)
    session.commit()
    session.refresh(letter)
    return LetterOut(
        id=letter.id,  # type: ignore[arg-type]
        profile_id=letter.profile_id,
        pipeline_card_id=letter.pipeline_card_id,
        content=letter.content,
        created_at=letter.created_at.isoformat(),
    )


@router.get("/{letter_id}/download")
def download_letter(letter_id: int, session: Session = Depends(get_session)) -> Response:
    letter = session.get(CoverLetter, letter_id)
    if not letter:
        raise HTTPException(status_code=404, detail="Not found")
    try:
        from docx import Document
        doc = Document()
        for para in letter.content.split("\n\n"):
            doc.add_paragraph(para.strip())
        buf = io.BytesIO()
        doc.save(buf)
        return Response(
            content=buf.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f"attachment; filename=cover_letter_{letter_id}.docx"},
        )
    except Exception:
        return Response(
            content=letter.content.encode(),
            media_type="text/plain",
            headers={"Content-Disposition": f"attachment; filename=cover_letter_{letter_id}.txt"},
        )


@router.delete("/{letter_id}", status_code=204)
def delete_letter(letter_id: int, session: Session = Depends(get_session)) -> None:
    letter = session.get(CoverLetter, letter_id)
    if not letter:
        raise HTTPException(status_code=404, detail="Not found")
    session.delete(letter)
    session.commit()
