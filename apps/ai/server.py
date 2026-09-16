from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


def load_env() -> None:
    for candidate in (Path(__file__).resolve().parents[2] / ".env", Path.cwd() / ".env"):
        if not candidate.exists():
            continue
        for line in candidate.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env()


def clamp(n: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, n))


def heuristic_analyze(payload: dict[str, Any]) -> dict[str, Any]:
    market = payload.get("market") or {}
    name = payload.get("name") or "Asset"
    symbol = str(payload.get("symbol") or "?").upper()
    timeframe = payload.get("timeframe") or "1d"
    categories = payload.get("categories") or []
    risk = payload.get("risk_engine") or {}

    c24 = float(market.get("change24h") or 0)
    c7 = float(market.get("change7d") or 0)
    c30 = float(market.get("change30d") or 0)
    price = float(market.get("price") or 0)
    vol = float(market.get("volume24h") or 0)
    mcap = float(market.get("marketCap") or 1) or 1
    drawdown = float(market.get("athChange") or 0)
    vol_ratio = vol / mcap

    risk_score = float(risk.get("riskScore") if risk.get("riskScore") is not None else 50)
    liq = risk.get("liquidityScore")
    hold = risk.get("holderScore")
    creator = risk.get("creatorScore")
    sell = risk.get("sellPressure")
    vol_anom = risk.get("volumeAnomaly")
    contract = risk.get("contractRisk")

    momentum = 0.45 * c24 + 0.35 * (c7 / 3) + 0.20 * (c30 / 6)
    liquidity_boost = 8 if vol_ratio > 0.12 else 3 if vol_ratio > 0.05 else -2
    recovery_penalty = -6 if drawdown < -70 else -2 if drawdown < -40 else 2
    risk_penalty = (risk_score - 50) * 0.25
    score = round(clamp(50 + momentum + liquidity_boost + recovery_penalty - risk_penalty, 0, 100), 1)

    if score >= 60:
        sentiment = "bullish"
    elif score <= 40:
        sentiment = "bearish"
    else:
        sentiment = "neutral"

    support = float(market.get("low24h") or price * 0.97)
    resistance = float(market.get("high24h") or price * 1.03)
    cats = ", ".join(categories[:3]) if categories else "general crypto"

    catalysts = [
        "Sustained volume expansion with higher highs would reinforce upside.",
        "Broader market risk-on (BTC/SOL strength) often lifts correlated assets.",
        "Clear narrative fit within listed categories can attract speculative flow.",
    ]
    if sentiment == "bearish":
        catalysts[0] = "A reclaim of the 24h high with rising volume would be the first repair signal."

    risk_lines = [
        "Crypto markets are highly volatile; this is not financial advice.",
        f"Risk Engine score {risk_score:.0f}/100 (deterministic — not LLM).",
    ]
    if liq is not None:
        risk_lines.append(f"Liquidity {float(liq):.0f}/100.")
    if hold is not None:
        risk_lines.append(f"Holder concentration {float(hold):.0f}/100.")
    if creator is not None and float(creator) >= 10:
        risk_lines.append(f"Creator holdings {float(creator):.0f}/100.")
    if sell is not None and float(sell) >= 55:
        risk_lines.append(f"Sell pressure {float(sell):.0f}/100.")
    if contract is not None and float(contract) >= 25:
        risk_lines.append(f"Contract risk {float(contract):.0f}/100.")

    thesis_bits = [
        f"Short-term momentum is {'positive' if momentum > 0 else 'negative'}.",
        f"24h volume is ~{vol_ratio * 100:.1f}% of market cap.",
        f"Distance from ATH is {drawdown:.1f}%.",
    ]
    if risk:
        thesis_bits.append(
            f"Risk Engine: riskScore {risk_score:.0f}, liquidityScore {float(liq or 0):.0f}, "
            f"holderScore {float(hold or 0):.0f}"
            + (f", sellPressure {float(sell):.0f}" if sell is not None else "")
            + "."
        )

    return {
        "sentiment": sentiment,
        "score": score,
        "summary": (
            f"{name} ({symbol}) looks {sentiment} on a {timeframe} horizon. "
            f"Price ${price:,.4f} with 24h {c24:+.2f}% / 7d {c7:+.2f}%. "
            f"Heuristic score {score}/100 in the {cats} segment. "
            f"Risk Engine {risk_score:.0f}/100."
        ),
        "thesis": " ".join(thesis_bits),
        "risks": risk_lines,
        "catalysts": catalysts,
        "keyLevels": {"support": round(support, 6), "resistance": round(resistance, 6)},
        "mode": "heuristic",
        "riskEngine": risk or None,
    }


def heuristic_chat(message: str) -> dict[str, Any]:
    lower = message.lower()
    if any(k in lower for k in ("solana", "sol ", "wallet")):
        reply = (
            "For Solana wallets, paste an address into the Wallet tab to pull SOL balance, "
            "SPL token holdings, and recent signatures from public RPC. "
            "Pair that with AI analysis on SOL or related tokens for a fuller picture. "
            "This MVP does not custody keys or execute trades."
        )
    elif any(k in lower for k in ("buy", "sell", "trade", "leverage")):
        reply = (
            "I can help with research framing (momentum, risks, catalysts) but I do not give "
            "personalized trade recommendations. Use the Analyze flow on a token for a structured brief."
        )
    elif re.search(r"\b(btc|bitcoin|eth|ethereum|sol)\b", lower):
        reply = (
            "Open the Dashboard for live market context, then run Analyze on BTC, ETH, or SOL "
            "for a scored sentiment brief. Optional: set OPENAI_API_KEY for richer LLM narratives."
        )
    else:
        reply = (
            "I'm the AI Crypto Analyst assistant. Ask about market structure, Solana wallets, "
            "or request an analysis on a specific asset from the Token page. "
            "Without OPENAI_API_KEY I answer with grounded heuristic guidance."
        )
    return {"reply": reply, "mode": "heuristic"}


def openai_chat(messages: list[dict[str, str]], json_mode: bool = False) -> str | None:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return None
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    body: dict[str, Any] = {
        "model": model,
        "temperature": 0.3 if json_mode else 0.4,
        "messages": messages,
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as res:
            payload = json.loads(res.read().decode("utf-8"))
        return payload["choices"][0]["message"]["content"]
    except (urllib.error.URLError, urllib.error.HTTPError, KeyError, IndexError, json.JSONDecodeError):
        return None


def maybe_llm_analyze(payload: dict[str, Any]) -> dict[str, Any] | None:
    content = openai_chat(
        [
            {
                "role": "system",
                "content": (
                    "You are an AI crypto research analyst. Return ONLY valid JSON with keys: "
                    "sentiment (bullish|bearish|neutral), score (0-100 number), summary, thesis, "
                    "risks (array of strings), catalysts (array of strings), "
                    "keyLevels ({support:number, resistance:number}). "
                    "The payload includes risk_engine with deterministic numbers "
                    "(riskScore, liquidityScore, holderScore, creatorScore, sellPressure, "
                    "volumeAnomaly, contractRisk). You MUST use those values as-is. "
                    "Do not invent or recalculate quantitative risk/liquidity/holder metrics. "
                    "Explain why those scores matter. Include not-financial-advice in risks."
                ),
            },
            {"role": "user", "content": json.dumps(payload)},
        ],
        json_mode=True,
    )
    if not content:
        return None
    try:
        data = json.loads(content)
        return {
            "sentiment": data.get("sentiment", "neutral"),
            "score": float(data.get("score", 50)),
            "summary": str(data.get("summary", "")),
            "thesis": str(data.get("thesis", "")),
            "risks": list(data.get("risks") or []),
            "catalysts": list(data.get("catalysts") or []),
            "keyLevels": data.get("keyLevels"),
            "mode": "llm",
            "riskEngine": payload.get("risk_engine") or None,
        }
    except (json.JSONDecodeError, TypeError, ValueError):
        return None


def maybe_llm_chat(message: str) -> dict[str, Any] | None:
    content = openai_chat(
        [
            {
                "role": "system",
                "content": (
                    "You are AI Crypto Analyst. Help users research crypto and Solana. "
                    "No custody, no trade execution, no personalized financial advice. Be concise."
                ),
            },
            {"role": "user", "content": message},
        ]
    )
    if not content:
        return None
    return {"reply": content, "mode": "llm"}


class Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, payload: dict[str, Any]) -> None:
        raw = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self._send(204, {})

    def do_GET(self) -> None:  # noqa: N802
        if self.path.startswith("/health"):
            self._send(
                200,
                {
                    "ok": True,
                    "service": "ai-crypto-analyst-ai",
                    "llmConfigured": bool(os.getenv("OPENAI_API_KEY", "").strip()),
                },
            )
            return
        self._send(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(body.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self._send(400, {"error": "invalid json"})
            return

        if self.path.startswith("/analyze"):
            result = maybe_llm_analyze(payload) or heuristic_analyze(payload)
            self._send(200, result)
            return
        if self.path.startswith("/chat"):
            message = str(payload.get("message") or "")
            result = maybe_llm_chat(message) or heuristic_chat(message)
            self._send(200, result)
            return
        self._send(404, {"error": "not found"})

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"[ai] {self.address_string()} - {fmt % args}")


def main() -> None:
    port = int(os.getenv("AI_PORT") or 8001)
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"AI service listening on http://127.0.0.1:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
