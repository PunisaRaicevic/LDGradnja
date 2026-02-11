import os
import tempfile
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, FileResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="LDGradnja Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = Path(__file__).parent / "static"


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
            import ezdxf
            doc = ezdxf.readfile(input_path)
            doc.saveas(output_path)

            with open(output_path, "rb") as f:
                dxf_content = f.read()

            return Response(
                content=dxf_content,
                media_type="application/dxf",
                headers={"Content-Disposition": f"attachment; filename={file.filename.replace('.dwg', '.dxf')}"},
            )
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
            import ezdxf
            from ezdxf.addons.drawing import matplotlib as draw_mpl
            import matplotlib
            matplotlib.use("Agg")
            import matplotlib.pyplot as plt

            doc = ezdxf.readfile(input_path)
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

        except Exception as e:
            raise HTTPException(500, f"SVG konverzija nije uspjela: {str(e)}")


# Serve frontend static files (JS, CSS, images, etc.)
if STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve index.html for all non-API routes (SPA client-side routing)."""
        file_path = STATIC_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(STATIC_DIR / "index.html")
