@echo off
SETLOCAL ENABLEEXTENSIONS
title Network Manager App - Silent Uninstall

:: Stop and remove all containers
docker-compose down --volumes --remove-orphans >nul 2>&1

:: Remove Docker images (optional)
docker image rm network-manager-web-frontend network-manager-web-backend -f >nul 2>&1

:: Optional: clean Mongo backups
rmdir /s /q mongo_backups >nul 2>&1

:: Optional: clean log
del setup.log >nul 2>&1
exit /b
