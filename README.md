# Budget Bot

Budget Bot is a chatbot-first budgeting app. Users can type expenses in plain language, ask for spending summaries, and review analytics without filling long forms.

## Stack

- Backend: FastAPI
- Frontend: vanilla HTML, CSS, and JavaScript
- Database: MongoDB through Motor
- Agent flow: LangGraph
- LLM providers: OpenAI by default, with Gemini and Sarvam adapters available by configuration

## Setup

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Update `.env` with your MongoDB URI and any LLM API keys you want to use. The app still works for local demos without LLM keys by using deterministic parsing for common expense messages.

## Run

```powershell
uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000`.

## Test

```powershell
pytest
```
