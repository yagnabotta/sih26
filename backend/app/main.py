from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base, ensure_emergency_schema
from .config import settings
from .routers import (
    auth,
    reports,
    analysis,
    sif_intelligence,
    feedback,
    dashboard,
    weak_signals,
    sif_precursors,
    emergency
)
from .seed_data import seed_sample_data

# Ensure Database Tables & Migrations
ensure_emergency_schema()

# Create FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Hyperlocal Emergency Response & Safety Intelligence Platform",
    version="2.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Authentication Routers (mounted on /api/auth and /auth)
app.include_router(auth.router)
app.include_router(auth.root_auth_router)

# Register Existing Domain Routers
app.include_router(reports.router)
app.include_router(analysis.router)
app.include_router(analysis.ai_analysis_router)
app.include_router(sif_intelligence.router)
app.include_router(feedback.router)
app.include_router(dashboard.router)
app.include_router(weak_signals.router)
app.include_router(sif_precursors.router)

# Register Hyperlocal Emergency Platform Routers
app.include_router(emergency.api_router)   # /api/incidents, /api/responders, /api/notifications
app.include_router(emergency.root_router)  # /incidents, /responders, /notifications

@app.on_event("startup")
def startup_event():
    ensure_emergency_schema()
    seed_sample_data()

@app.get("/")
def root():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "tagline": settings.TAGLINE,
        "api_docs": "/docs",
        "roles_supported": ["USER", "RESPONDER", "ADMIN"]
    }
