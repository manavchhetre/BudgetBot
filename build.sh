#!/usr/bin/env bash
# exit on error
set -o errexit

echo "Building Next.js frontend..."
cd frontend
npm install
npm run build
cd ..

echo "Moving static files..."
rm -rf static/*
cp -r frontend/out/* static/

echo "Installing Python dependencies..."
pip install -r requirements.txt
