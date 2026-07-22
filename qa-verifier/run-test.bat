@echo off
cd /d "%~dp0.."
echo Starting QA verification loop (about 2-4 random tests per hour).
echo Press ESC at any time to stop.
docker-compose run --rm qa-verifier python runner.py
echo.
echo Stopped. Results saved under backend\data\qa-verification\
pause
