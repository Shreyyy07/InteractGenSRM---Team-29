from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime

class AnalyticsEvent(BaseModel):
    eventType: str
    domain: str
    timestamp: datetime = Field(default_factory=datetime.now)
    metadata: Optional[Any] = None

class SummarizeRequest(BaseModel):
    text: str
    maxLength: Optional[int] = 200

class AnalyticsResponse(BaseModel):
    success: bool
    data: Optional[Any] = None
