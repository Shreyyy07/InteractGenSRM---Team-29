from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database import db
from models import AnalyticsEvent, SummarizeRequest, SimplifyRequest, RelatedRequest
import asyncio
import google.generativeai as genai
from dotenv import load_dotenv
import os

# --- Configuration ---
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    print("⚠️ WARNING: GEMINI_API_KEY not found in environment variables.")

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('models/gemini-2.5-flash')

# In-memory storage for demo fallback
mock_events = []
USE_MOCK_DB = False

@asynccontextmanager
async def lifespan(app: FastAPI):
    global USE_MOCK_DB
    # Startup
    try:
        await db.connect_db()
        # Test connection
        await db.get_db().command('ping')
        print("✅ Connected to Real MongoDB")
    except Exception as e:
        print(f"⚠️ MongoDB Connection Failed: {e}")
        print("⚠️ Switching to IN-MEMORY MOCK DB (Events will reset on restart)")
        USE_MOCK_DB = True
    
    yield
    
    # Shutdown
    if not USE_MOCK_DB:
        await db.close_db()

app = FastAPI(title="AdaptiveWeb Backend", version="1.0.0", lifespan=lifespan)

# CORS Configuration
origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    mode = "Mock DB" if USE_MOCK_DB else "Real MongoDB"
    return {"message": "AdaptiveWeb Intelligence Layer Active", "status": "online", "mode": mode}

@app.get("/health")
async def health():
    return {"status": "ok"}

# --- Summarization API ---
@app.post("/api/suggest")
async def suggest_content(request: SummarizeRequest):
    """
    Generate Actionable Suggestions based on page context.
    """
    print(f"📥 Suggest Request received: {len(request.text)} chars")
    if not request.text:
        raise HTTPException(status_code=400, detail="No text provided")

    try:
        # Prompt for Actionable Advice
        prompt = (
            "You are an intelligent browsing assistant. The user is on a webpage and seems hesitant. "
            "Based on the following page text, suggest 3 specific, short, actionable steps they might want to take next. "
            "Examples: 'Compare Prices', 'Read Reviews', 'Add to Cart', 'Sign up for Newsletter'. "
            "Also provide a 1-sentence summary of why they might want to do these things. "
            "Return the response in this structure: "
            "Summary: [Reasoning]\n"
            "1. [Action 1]\n"
            "2. [Action 2]\n"
            "3. [Action 3]\n\n"
            f"Page Text:\n{request.text[:5000]}"
        )
        
        response = await asyncio.to_thread(model.generate_content, prompt)
        content = response.text
        
        # Parse Response (Simple heuristic parsing)
        lines = content.split('\n')
        summary_text = "Here are some ideas for you."
        suggestions = []
        
        for line in lines:
            line = line.strip()
            if line.startswith("Summary:"):
                summary_text = line.replace("Summary:", "").strip()
            elif line.startswith(("1.", "2.", "3.", "-")):
                # Remove numbering
                clean_line = line.lstrip("1234567890.- ").strip()
                if clean_line:
                    suggestions.append(clean_line)
                    
        # Fallback if parsing failed
        if not suggestions:
            suggestions = ["Explore features", "Read more details", "Contact support"]

        print(f"📤 Sending Suggestions: {suggestions}")
        return {
            "summary": summary_text,
            "suggestions": suggestions[:3],
            "method": "gemini_context_aware"
        }
        
    except Exception as e:
        print(f"❌ Gemini Suggest Error: {e}")
        return {
            "summary": "Could not generate smart suggestions.",
            "suggestions": ["Reload page", "Continue reading", "Search site"],
            "method": "fallback_error"
        }

# --- Shortcuts API ---
@app.post("/api/shortcuts")
async def get_shortcuts(request: SummarizeRequest):
    """
    Generate Keyboard Shortcuts for the current website.
    """
    print(f"📥 Shortcuts Request received for context around: {request.text[:50]}...")
    
    try:
        # Prompt for Shortcuts
        prompt = (
            "You are an expert in web accessibility and productivity. "
            "Identify user-specific 'Power User' keyboard shortcuts for the website described by this text. "
            "Focus on NAVIGATION and ACTIONS (e.g. 'Go to Cart', 'Search', 'Next Page', 'Like'). "
            "Avoid generic browser shortcuts like 'Space' or 'Page Down' unless the site has custom behavior. "
            "If it's a popular site (Amazon, YouTube, Gmail, GitHub), provide the REAL shortcuts. "
            "Return a JSON-like list of exactly 5 key shortcuts. "
            "Format: Key - Action. "
            "Example:\n"
            "/ - Search\n"
            "C - Compose\n"
            "G then H - Go Home\n"
            "Shift + ? - Show Help\n"
            "Ctrl + Enter - Submit\n\n"
            f"Page Context:\n{request.text[:5000]}"
        )
        
        response = await asyncio.to_thread(model.generate_content, prompt)
        content = response.text
        
        # Parse logic
        lines = content.split('\n')
        shortcuts = []
        for line in lines:
            if " - " in line:
                parts = line.split(" - ")
                if len(parts) >= 2:
                    key = parts[0].strip().replace("-", "").replace("*", "").strip()
                    action = parts[1].strip()
                    shortcuts.append({"key": key, "action": action})
        
        # Fallback
        if len(shortcuts) < 2:
            shortcuts = [
                {"key": "?", "action": "Show Shortcuts"},
                {"key": "/", "action": "Search Site"},
                {"key": "Home", "action": "Scroll Top"},
                {"key": "Alt+Left", "action": "Go Back"},
                {"key": "Ctrl+D", "action": "Bookmark"}
            ]
            
        return {"shortcuts": shortcuts[:5]}

    except Exception as e:
        print(f"❌ Shortcuts Error: {e}")
        return {"shortcuts": []}

# --- Summarization API ---
@app.post("/api/summarize")
async def summarize_content(request: SummarizeRequest):
    """
    AI Summarization using Gemini Pro.
    """
    print(f"📥 Summarize Request received: {len(request.text)} chars")
    if not request.text:
        raise HTTPException(status_code=400, detail="No text provided")
        
    try:
        # Real Gemini API Call
        prompt = f"Summarize the following text in 3 concise, impactful bullet points. Keep it under 50 words total:\n\n{request.text}"
        response = await asyncio.to_thread(model.generate_content, prompt)
        summary = response.text
        
        print(f"📤 Sending Summary: {summary[:50]}...")
        return {
            "summary": summary,
            "method": "gemini_pro"
        }
    except Exception as e:
        print(f"❌ Gemini Error: {e}")
        # Fallback to heuristic if API fails
        sentences = request.text.split('.')
        summary_text = ". ".join([s.strip() for s in sentences[:3] if s.strip()]) + "."
        return {
            "summary": "AI Error. Fallback: " + summary_text,
            "method": "fallback"
        }

# --- Publisher API: Reading Difficulty ---
@app.post("/api/simplify")
async def simplify_text(request: SimplifyRequest):
    """
    Mock Feature: Returns a 'simplified' version of the text.
    In production, this would use a fine-tuned LLM.
    """
    if not request.text:
        raise HTTPException(status_code=400, detail="No text provided")
    
    # Mock Logic: Prepend "Simply put: " and truncate
    # Real Logic: OpenAI "Rephrase this at 8th grade reading level"
    simplified = "Simply put: " + request.text[:100] + "... (This is a simplified version)"
    
    return {"original": request.text[:50], "simplified": simplified}

# --- Publisher API: Engaged Reader ---
@app.post("/api/related")
async def get_related_articles(request: RelatedRequest):
    """
    Mock Feature: Returns related articles based on context.
    """
    # Mock Database of Articles
    articles = [
        {"title": "The Future of Digital Media", "url": "#", "image": "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=150"},
        {"title": "Understanding User Intent", "url": "#", "image": "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=150"},
        {"title": "10 Tips for Better UX", "url": "#", "image": "https://images.unsplash.com/photo-1586717791821-3f44a5638d48?w=150"}
    ]
    return {"articles": articles}

# --- Analytics API ---
@app.post("/api/analytics")
async def log_analytics(event: AnalyticsEvent):
    """Log an event to MongoDB or Mock List."""
    print(f"📥 Analytics Event: {event.eventType}")
    try:
        # Pydantic v2 compatibility
        doc = event.model_dump() if hasattr(event, 'model_dump') else event.dict()
        
        if USE_MOCK_DB:
            doc['_id'] = str(len(mock_events) + 1)
            mock_events.append(doc)
            return {"success": True, "id": doc['_id'], "mode": "mock"}
        else:
            new_event = await db.get_db()["analytics"].insert_one(doc)
            return {"success": True, "id": str(new_event.inserted_id), "mode": "real"}
            
    except Exception as e:
        print(f"❌ Error logging analytics: {e}")
        # Don't crash the extension, just log error
        return {"success": False, "error": str(e)}

@app.get("/api/analytics")
async def get_analytics_stats():
    """Fetch aggregated stats."""
    if USE_MOCK_DB:
        total = len(mock_events)
        # Aggregate manually for mock
        counts = {}
        for e in mock_events:
            t = e['eventType']
            counts[t] = counts.get(t, 0) + 1
        
        by_type = [{"_id": k, "count": v} for k, v in counts.items()]
        
        return {
            "success": True,
            "stats": {
                "total": total,
                "byType": by_type
            }
        }
    
    # Real DB
    try:
        collection = db.get_db()["analytics"]
        total = await collection.count_documents({})
        pipeline = [{"$group": {"_id": "$eventType", "count": {"$sum": 1}}}]
        by_type = await collection.aggregate(pipeline).to_list(length=None)
        
        return {
            "success": True,
            "stats": {
                "total": total,
                "byType": by_type
            }
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
