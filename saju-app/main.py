"""
Saju (사주) Reading App — FastAPI Backend

Combines deterministic Four Pillars calculation with Claude AI interpretation.
"""

import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from models import BirthInput, ReadingRequest, ReadingResponse
from saju_engine import calculate_saju
from interpreter import generate_reading

load_dotenv()

app = FastAPI(
    title="Saju Reading App (사주 리딩)",
    description="Korean Four Pillars of Destiny reading powered by deterministic calculation + Claude AI interpretation",
    version="1.0.0",
)

STATIC_DIR = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/")
async def serve_index():
    return FileResponse(str(STATIC_DIR / "index.html"))


@app.post("/api/chart")
async def get_chart(birth: BirthInput):
    """Calculate and return the Saju chart without interpretation."""
    try:
        chart = calculate_saju(birth)
        return chart
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/reading")
async def get_reading(request: ReadingRequest):
    """Calculate chart and generate a full AI-powered reading."""
    try:
        chart = calculate_saju(request.birth)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Chart calculation error: {e}")

    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(
            status_code=500,
            detail="ANTHROPIC_API_KEY is not configured. Set it in your .env file.",
        )

    try:
        reading = await generate_reading(chart, request.reading_type, request.language)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reading generation error: {e}")

    return ReadingResponse(
        chart=chart,
        reading=reading,
        reading_type=request.reading_type,
        language=request.language,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
