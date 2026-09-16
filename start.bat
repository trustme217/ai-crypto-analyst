@echo off
cd /d "%~dp0"
echo Starting local PostgreSQL (no Docker)...
call node scripts\postgres.mjs start
if errorlevel 1 (
  echo Failed to start PostgreSQL. Install PostgreSQL locally or set ACA_PG_BIN.
  exit /b 1
)
echo Starting local Redis (no Docker)...
call node scripts\redis.mjs start
if errorlevel 1 (
  echo Failed to start Redis. Set ACA_REDIS_BIN or check apps/api/data/redis.log
  exit /b 1
)
echo Starting AI Crypto Analyst (AI + API + Web)...
call npm run dev