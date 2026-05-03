from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, SQLModel, select

from api.db import get_session
from api.models.pipeline import PipelineCard, PipelineStage

router = APIRouter()


class CardCreate(SQLModel):
    profile_id: int
    title: str
    company: str
    stage: PipelineStage = PipelineStage.DISCOVERED
    url: str = ""
    deadline: datetime | None = None
    notes: str = ""
    job_id: int | None = None


class CardUpdate(SQLModel):
    title: str | None = None
    company: str | None = None
    stage: PipelineStage | None = None
    url: str | None = None
    deadline: datetime | None = None
    notes: str | None = None


@router.get("/")
def list_cards(
    profile_id: int,
    session: Session = Depends(get_session),
) -> list[PipelineCard]:
    return list(
        session.exec(
            select(PipelineCard)
            .where(PipelineCard.profile_id == profile_id)
            .order_by(PipelineCard.created_at.desc())  # type: ignore[arg-type]
        ).all()
    )


@router.post("/", status_code=201)
def create_card(
    data: CardCreate,
    session: Session = Depends(get_session),
) -> PipelineCard:
    card = PipelineCard(**data.model_dump())
    session.add(card)
    session.commit()
    session.refresh(card)
    return card


@router.get("/{card_id}")
def get_card(card_id: int, session: Session = Depends(get_session)) -> PipelineCard:
    card = session.get(PipelineCard, card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return card


@router.patch("/{card_id}")
def update_card(
    card_id: int,
    data: CardUpdate,
    session: Session = Depends(get_session),
) -> PipelineCard:
    card = session.get(PipelineCard, card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(card, field, value)
    card.updated_at = datetime.utcnow()
    session.add(card)
    session.commit()
    session.refresh(card)
    return card


@router.delete("/{card_id}", status_code=204)
def delete_card(card_id: int, session: Session = Depends(get_session)) -> None:
    card = session.get(PipelineCard, card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    session.delete(card)
    session.commit()
