"""Pydantic schemas for the mock app HTTP API."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel


class CreateSessionRequest(BaseModel):
    user_id: str


class UpdateUserRequest(BaseModel):
    role: Optional[str] = None
    domain: Optional[str] = None
    years_experience: Optional[int] = None
    industry: Optional[str] = None
    bio: Optional[str] = None


class MockUser(BaseModel):
    id: str
    name: str
    role: str
    domain: str
    years_experience: int
    industry: str
    bio: str


class CreateSessionResponse(BaseModel):
    session_id: str
    user: MockUser


class SendMessageRequest(BaseModel):
    content: str
    smart_talk_mode: bool = False


class TraitKeywordSchema(BaseModel):
    value: str
    confidence: float


class TraitDimensionSchema(BaseModel):
    field: str
    keywords: list[TraitKeywordSchema]
    summary: str


class UserModelSchema(BaseModel):
    user_id: str
    profile: dict[str, Any]
    inferred: list[TraitDimensionSchema]
    signal_vocab: list[dict[str, Any]] = []
    updated_at: float


class ClarifyReplyRequest(BaseModel):
    choice: str
