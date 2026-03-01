"""Pydantic models for the Saju reading app."""

from pydantic import BaseModel, Field
from typing import Optional


class BirthInput(BaseModel):
    year: int = Field(..., ge=1900, le=2100, description="Birth year (solar)")
    month: int = Field(..., ge=1, le=12, description="Birth month (solar)")
    day: int = Field(..., ge=1, le=31, description="Birth day (solar)")
    hour: int = Field(..., ge=0, le=23, description="Birth hour (0-23)")
    minute: int = Field(0, ge=0, le=59, description="Birth minute")
    gender: str = Field(..., pattern="^(male|female)$", description="Gender: male or female")
    name: Optional[str] = Field(None, description="Optional name for the reading")


class GanZhi(BaseModel):
    """A single Heavenly Stem + Earthly Branch pair."""
    stem_idx: int
    branch_idx: int
    stem_kr: str
    stem_cn: str
    stem_en: str
    branch_kr: str
    branch_cn: str
    branch_en: str
    branch_animal_kr: str
    branch_animal_en: str
    element: str
    element_kr: str
    yin_yang: str
    yin_yang_kr: str


class Pillar(BaseModel):
    """A single pillar with GanZhi and Ten Gods."""
    name_en: str
    name_kr: str
    ganzhi: GanZhi
    stem_ten_god: Optional[str] = None
    stem_ten_god_kr: Optional[str] = None
    hidden_stems: list[dict] = []


class ElementBalance(BaseModel):
    wood: int = 0
    fire: int = 0
    earth: int = 0
    metal: int = 0
    water: int = 0
    dominant: str = ""
    weakest: str = ""


class LuckCycle(BaseModel):
    start_age: int
    end_age: int
    stem_kr: str
    stem_cn: str
    branch_kr: str
    branch_cn: str
    branch_animal_kr: str
    element: str
    element_kr: str


class SajuChart(BaseModel):
    """The complete Saju chart."""
    birth_solar: str
    birth_lunar: str
    gender: str
    gender_kr: str
    name: Optional[str] = None

    year_pillar: Pillar
    month_pillar: Pillar
    day_pillar: Pillar
    hour_pillar: Pillar

    day_master: str
    day_master_kr: str
    day_master_element: str
    day_master_element_kr: str
    day_master_yin_yang: str

    element_balance: ElementBalance
    luck_cycles: list[LuckCycle] = []
    symbolic_stars: list[dict] = []


class ReadingRequest(BaseModel):
    birth: BirthInput
    reading_type: str = Field(
        "full",
        pattern="^(full|personality|career|love|yearly)$",
        description="Type of reading"
    )
    language: str = Field("en", pattern="^(en|ko)$", description="Output language")


class ReadingResponse(BaseModel):
    chart: SajuChart
    reading: str
    reading_type: str
    language: str
