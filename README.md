# Annotation-Platform — Setup & Run

## Backend (ASP.NET Core)

**Prerequisites:** .NET SDK — version TBD, pin via `global.json` once confirmed (`dotnet --version`). EF Core tools: `dotnet tool install --global dotnet-ef` if not already installed.

```bash
cd backend
```

### Build

```bash
dotnet build
```

### Run migrations (after any entity change)

```bash
dotnet ef migrations add <MigrationName> --project Context --startup-project Api
dotnet ef database update --project Context --startup-project Api
```

### Run the API

```bash
cd Api
dotnet run
```

Console will print the listening URL, e.g. `https://localhost:7123`. API routes live under `/api/...`. If Swagger UI is installed, browse to `/swagger` for an interactive test page.

---

## Frontend (React + Vite)

**Prerequisites:** Node.js — version TBD, pin via `.nvmrc` once confirmed.

```bash
cd frontend
npm install
```

### Run dev server

```bash
npm run dev
```

Opens on `http://localhost:5173`. Backend must be running separately for real (non-mock) data — CORS is already configured in `Program.cs` to allow this origin.

### Build for production

```bash
npm run build
```

---

## Python scripts (`backend/Scripts/`)

**Prerequisites:** Python 3.x, `ffmpeg` + `ffprobe` on system PATH (`ffmpeg -version` to confirm).

Use a virtual environment — do not install packages globally, it causes exactly the kind of dependency drift this README is meant to prevent.

```bash
cd backend/Scripts
python -m venv venv
```

Activate it:

```bash
# macOS/Linux
source venv/bin/activate

# Windows (PowerShell)
venv\Scripts\Activate.ps1

# Windows (cmd)
venv\Scripts\activate.bat
```

Install dependencies:

```bash
pip install -r requirements.txt
```

You'll know it worked if your terminal prompt shows `(venv)` at the start of the line.

### Run a script

```bash
python speech_to_text.py --video path/to/clip.mp4
python video_processing.py --input path/to/clip.mp4 --thumbnail path/to/thumb.jpg
```

When done:

```bash
deactivate
```

### Adding a new script or dependency

If you add a new Python script with new imports, add the package (with a pinned version) to `requirements.txt` under a clearly labeled section for that script — don't leave the file guessing what's actually needed. See the comments already in `requirements.txt` for the expected format.

---
