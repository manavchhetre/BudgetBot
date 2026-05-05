Write-Host "Building Next.js frontend..."
cd frontend
npm install
npm run build
cd ..

Write-Host "Moving static files..."
Remove-Item -Recurse -Force static\*
Copy-Item -Recurse -Force frontend\out\* static\

Write-Host "Installing Python dependencies..."
pip install -r requirements.txt
