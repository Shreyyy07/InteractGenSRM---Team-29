from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database import db
from models import AnalyticsEvent, SummarizeRequest
import asyncio

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
@app.post("/api/summarize")
async def summarize_content(request: SummarizeRequest):
    """
    Mock AI Summarization.
    """
    print(f"📥 Summarize Request received: {len(request.text)} chars")
    if not request.text:
        raise HTTPException(status_code=400, detail="No text provided")
        
    sentences = request.text.split('.')
    # Logic: Take 3 distinct sentences from the start
    summary_text = ". ".join([s.strip() for s in sentences[:3] if s.strip()]) + "."
    
    # Ensure we return something visible
    if len(summary_text) < 10:
        summary_text = "Content was too short to summarize efficiently, but here is an AI analysis confirmation."
        
    print(f"📤 Sending Summary: {summary_text[:50]}...")
    return {
        "summary": summary_text,
        "method": "mock_heuristic_python"
    }

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
