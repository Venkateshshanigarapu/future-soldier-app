#!/bin/bash

# ATMS - Unified Project Start Script
# This script installs dependencies and starts both Backend and Frontend.

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting ATMS Unified Setup...${NC}"

# Function to handle cleanup on exit
cleanup() {
    echo -e "\n${RED}🛑 Shutting down servers...${NC}"
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
        echo -e "${NC}Backend stopped (PID: $BACKEND_PID)${NC}"
    fi
    exit 0
}

# Trap Ctrl+C (SIGINT)
trap cleanup SIGINT

# 1. Dependency Check
echo -e "${BLUE}📦 Checking dependencies...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js v18+ first.${NC}"
    exit 1
fi

# 2. Backend Setup
echo -e "${BLUE}🖥️ Setting up Backend (my-api)...${NC}"
cd my-api
if [ ! -d "node_modules" ]; then
    echo -e "${NC}Installing backend dependencies...${NC}"
    npm install
else
    echo -e "${GREEN}✅ Backend dependencies already installed.${NC}"
fi

echo -e "${BLUE}📡 Starting Backend...${NC}"
npm start &
BACKEND_PID=$!
echo -e "${GREEN}✅ Backend started with PID: $BACKEND_PID${NC}"

cd ..

# 3. Frontend Setup
echo -e "${BLUE}📱 Setting up Frontend (frontend)...${NC}"
cd frontend
if [ ! -d "node_modules" ]; then
    echo -e "${NC}Installing frontend dependencies...${NC}"
    npm install
else
    echo -e "${GREEN}✅ Frontend dependencies already installed.${NC}"
fi

echo -e "${BLUE}✨ Starting Frontend (Expo)...${NC}"
export EXPO_PACKAGER_HOSTNAME=117.251.19.107
export REACT_NATIVE_PACKAGER_HOSTNAME=117.251.19.107
npx expo start --clear

# Wait for frontend to close
wait
