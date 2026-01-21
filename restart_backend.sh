#!/bin/bash
echo "Stopping existing backend..."
pkill -f "uvicorn main:app" || true
sleep 2
echo "Starting backend..."
cd backend
nohup python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000 > ../backend.log 2>&1 &
echo "Backend started! Logs in backend.log"
