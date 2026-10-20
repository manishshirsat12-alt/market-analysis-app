import json
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

load_dotenv()

app = FastAPI(title="Market Lens API", version="0.1.0")

MARKET_DATA = {
    "as_of": "Illustrative sample data",
    "indices": [
        {"name": "S&P 500", "symbol": "SPX", "value": 5928.40, "change_pct": 0.62},
        {"name": "Nasdaq 100", "symbol": "NDX", "value": 21478.12, "change_pct": 0.91},
        {"name": "FTSE 100", "symbol": "UKX", "value": 8346.20, "change_pct": -0.18},
        {"name": "Nikkei 225", "symbol": "NKY", "value": 38617.75, "change_pct": 0.34},
    ],
    "etfs": [
        {"name": "Vanguard S&P 500", "symbol": "VOO", "price": 543.21, "change_pct": 0.58},
        {"name": "Vanguard Total World", "symbol": "VT", "price": 119.84, "change_pct": 0.41},
        {"name": "iShares Core MSCI EAFE", "symbol": "IEFA", "price": 76.32, "change_pct": -0.12},
    ],
    "regions": [
        {"name": "Americas", "status": "Open", "tone": "positive"},
        {"name": "Europe", "status": "Mixed", "tone": "neutral"},
        {"name": "Asia Pacific", "status": "Open", "tone": "positive"},
    ],
}


class AnalysisRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=12, pattern=r"^[A-Za-z0-9.\-^=]+$")
    focus: str = Field(default="stock", pattern=r"^(stock|etf|global)$")


def demo_analysis(symbol: str, focus: str) -> str:
    label = {"stock": "security", "etf": "ETF", "global": "global market"}[focus]
    return (
        f"Demo mode: {symbol.upper()} is queued for a {label} review. "
        "Connect an LLM API key to generate a structured analysis. The market figures "
        "shown here are illustrative and should not be used to make investment decisions."
    )


def request_llm_analysis(symbol: str, focus: str) -> str:
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    payload = {
        "model": os.getenv("ANALYSIS_MODEL", "gpt-4o-mini"),
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are an educational market research assistant. Do not give "
                    "personalized financial advice or invent current prices. The provided "
                    "market data is illustrative. Clearly distinguish facts, uncertainty, "
                    "and risks. Keep the response concise with outlook, key risks, and "
                    "questions to research next."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {"symbol": symbol.upper(), "focus": focus, "sample_market_data": MARKET_DATA}
                ),
            },
        ],
        "temperature": 0.3,
    }
    request = Request(
        f"{base_url}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=45) as response:
            result = json.loads(response.read().decode("utf-8"))
        return result["choices"][0]["message"]["content"]
    except HTTPError as error:
        raise HTTPException(status_code=502, detail=f"LLM provider returned HTTP {error.code}.") from error
    except (URLError, TimeoutError) as error:
        raise HTTPException(status_code=502, detail="Could not reach the LLM provider.") from error
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=502, detail="The LLM provider returned an unexpected response.") from error


@app.get("/api/market")
def get_market_data():
    return MARKET_DATA


@app.post("/api/analyze")
def analyze(request: AnalysisRequest):
    if not os.getenv("OPENAI_API_KEY"):
        return {"symbol": request.symbol.upper(), "focus": request.focus, "mode": "demo", "analysis": demo_analysis(request.symbol, request.focus)}
    analysis = request_llm_analysis(request.symbol, request.focus)
    return {"symbol": request.symbol.upper(), "focus": request.focus, "mode": "llm", "analysis": analysis}


frontend_dir = Path(__file__).resolve().parents[1] / "frontend"
app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")