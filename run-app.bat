@echo off
echo Starting your Dockerized full-stack app...
docker-compose down
docker-compose build
docker-compose up -d
echo App is running! Visit http://localhost:5173
pause
