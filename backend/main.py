import os
import subprocess
import tempfile
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, FileResponse
from fastapi.staticfiles import StaticFiles
import httpx

app = FastAPI(title="LDGradnja Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = Path(__file__).parent / "static"
print(f"[startup] STATIC_DIR={STATIC_DIR}, exists={STATIC_DIR.is_dir()}")
if STATIC_DIR.is_dir():
    print(f"[startup] static contents: {list(STATIC_DIR.iterdir())}")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/convert/dwg-to-dxf")
async def convert_dwg_to_dxf(file: UploadFile = File(...)):
    """Convert DWG to DXF using ezdxf (supports DWG R2000-R2018)."""
    if not file.filename or not file.filename.lower().endswith(".dwg"):
        raise HTTPException(400, "Fajl mora biti .dwg format")

    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(413, "Fajl je prevelik (max 50MB)")

    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, "input.dwg")
        output_path = os.path.join(tmpdir, "output.dxf")

        with open(input_path, "wb") as f:
            f.write(content)

        try:
            result = subprocess.run(
                ["dwg2dxf", "-o", output_path, input_path],
                capture_output=True, text=True, timeout=60,
            )
            if result.returncode != 0:
                raise HTTPException(500, f"Konverzija nije uspjela: {result.stderr}")

            with open(output_path, "rb") as f:
                dxf_content = f.read()

            return Response(
                content=dxf_content,
                media_type="application/dxf",
                headers={"Content-Disposition": f"attachment; filename={file.filename.replace('.dwg', '.dxf')}"},
            )
        except subprocess.TimeoutExpired:
            raise HTTPException(500, "Konverzija je istekla (timeout)")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(500, f"Konverzija nije uspjela: {str(e)}")


@app.post("/convert/dwg-to-svg")
async def convert_dwg_to_svg(file: UploadFile = File(...)):
    """Convert DWG to SVG using ezdxf + matplotlib."""
    if not file.filename or not file.filename.lower().endswith(".dwg"):
        raise HTTPException(400, "Fajl mora biti .dwg format")

    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(413, "Fajl je prevelik (max 50MB)")

    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, "input.dwg")

        with open(input_path, "wb") as f:
            f.write(content)

        try:
            # Step 1: Convert DWG to DXF using LibreDWG
            dxf_path = os.path.join(tmpdir, "input.dxf")
            result = subprocess.run(
                ["dwg2dxf", "-o", dxf_path, input_path],
                capture_output=True, text=True, timeout=60,
            )
            if result.returncode != 0:
                raise HTTPException(500, f"DWG→DXF konverzija nije uspjela: {result.stderr}")

            # Step 2: Render DXF to SVG using ezdxf + matplotlib
            import ezdxf
            from ezdxf.addons.drawing import matplotlib as draw_mpl
            import matplotlib
            matplotlib.use("Agg")
            import matplotlib.pyplot as plt

            doc = ezdxf.readfile(dxf_path)
            msp = doc.modelspace()

            fig = plt.figure(figsize=(16, 12))
            ax = fig.add_axes([0, 0, 1, 1])
            ctx = draw_mpl.RenderContext(doc)
            out = draw_mpl.MatplotlibBackend(ax)
            draw_mpl.Frontend(ctx, out).draw_layout(msp)

            svg_path = os.path.join(tmpdir, "output.svg")
            fig.savefig(svg_path, format="svg", bbox_inches="tight", pad_inches=0.1)
            plt.close(fig)

            with open(svg_path, "rb") as f:
                svg_content = f.read()

            return Response(content=svg_content, media_type="image/svg+xml")

        except subprocess.TimeoutExpired:
            raise HTTPException(500, "Konverzija je istekla (timeout)")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(500, f"SVG konverzija nije uspjela: {str(e)}")


@app.api_route("/api/openai/{path:path}", methods=["POST", "GET"])
async def openai_proxy(path: str, request: Request):
    """Proxy requests to OpenAI API using server-side API key."""
    api_key = os.environ.get("OPENAI_API_KEY", "")
    # Fallback: allow client to pass key (for local dev without env var)
    auth = f"Bearer {api_key}" if api_key else request.headers.get("Authorization", "")
    if not auth:
        raise HTTPException(401, "OpenAI API key not configured. Set OPENAI_API_KEY environment variable.")

    body = await request.body()
    headers = {
        "Authorization": auth,
        "Content-Type": request.headers.get("Content-Type", "application/json"),
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            resp = await client.request(
                method=request.method,
                url=f"https://api.openai.com/{path}",
                headers=headers,
                content=body,
            )
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                media_type=resp.headers.get("content-type", "application/json"),
            )
        except httpx.TimeoutException:
            raise HTTPException(504, "OpenAI API timeout")
        except httpx.RequestError as e:
            raise HTTPException(502, f"OpenAI API nedostupan: {str(e)}")


# Serve frontend static files (JS, CSS, images, etc.)
if STATIC_DIR.is_dir():
    # Mount assets directory if it exists
    assets_dir = STATIC_DIR / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve index.html for all non-API routes (SPA client-side routing)."""
        file_path = STATIC_DIR / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        index = STATIC_DIR / "index.html"
        if index.is_file():
            return FileResponse(str(index))
        return {"error": "Frontend not built"}
