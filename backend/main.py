import os
import subprocess
import tempfile
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

app = FastAPI(title="LDGradnja Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/convert/dwg-to-dxf")
async def convert_dwg_to_dxf(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".dwg"):
        raise HTTPException(400, "Fajl mora biti .dwg format")

    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, "input.dwg")
        output_path = os.path.join(tmpdir, "input.dxf")

        content = await file.read()
        if len(content) > 50 * 1024 * 1024:  # 50MB limit
            raise HTTPException(413, "Fajl je prevelik (max 50MB)")

        with open(input_path, "wb") as f:
            f.write(content)

        result = subprocess.run(
            ["dwg2dxf", input_path],
            capture_output=True,
            text=True,
            timeout=60,
            cwd=tmpdir,
        )

        if not os.path.exists(output_path):
            # Try alternative output naming
            for fname in os.listdir(tmpdir):
                if fname.endswith(".dxf"):
                    output_path = os.path.join(tmpdir, fname)
                    break

        if os.path.exists(output_path):
            with open(output_path, "rb") as f:
                dxf_content = f.read()
            return Response(
                content=dxf_content,
                media_type="application/dxf",
                headers={"Content-Disposition": f"attachment; filename={file.filename.replace('.dwg', '.dxf')}"},
            )

        error_msg = result.stderr or result.stdout or "Nepoznata greska pri konverziji"
        raise HTTPException(500, f"Konverzija nije uspjela: {error_msg}")


@app.post("/convert/dwg-to-svg")
async def convert_dwg_to_svg(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".dwg"):
        raise HTTPException(400, "Fajl mora biti .dwg format")

    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, "input.dwg")
        dxf_path = os.path.join(tmpdir, "input.dxf")

        content = await file.read()
        if len(content) > 50 * 1024 * 1024:
            raise HTTPException(413, "Fajl je prevelik (max 50MB)")

        with open(input_path, "wb") as f:
            f.write(content)

        # Step 1: DWG -> DXF
        subprocess.run(
            ["dwg2dxf", input_path],
            capture_output=True,
            timeout=60,
            cwd=tmpdir,
        )

        if not os.path.exists(dxf_path):
            for fname in os.listdir(tmpdir):
                if fname.endswith(".dxf"):
                    dxf_path = os.path.join(tmpdir, fname)
                    break

        if not os.path.exists(dxf_path):
            raise HTTPException(500, "DWG konverzija u DXF nije uspjela")

        # Step 2: DXF -> SVG using ezdxf
        try:
            import ezdxf
            from ezdxf.addons.drawing import matplotlib as draw_mpl

            doc = ezdxf.readfile(dxf_path)
            msp = doc.modelspace()

            svg_path = os.path.join(tmpdir, "output.svg")

            import matplotlib
            matplotlib.use("Agg")
            import matplotlib.pyplot as plt

            fig = plt.figure(figsize=(16, 12))
            ax = fig.add_axes([0, 0, 1, 1])
            ctx = draw_mpl.RenderContext(doc)
            out = draw_mpl.MatplotlibBackend(ax)
            draw_mpl.Frontend(ctx, out).draw_layout(msp)
            fig.savefig(svg_path, format="svg", bbox_inches="tight", pad_inches=0.1)
            plt.close(fig)

            with open(svg_path, "rb") as f:
                svg_content = f.read()

            return Response(content=svg_content, media_type="image/svg+xml")

        except Exception as e:
            # Fallback: return DXF if SVG conversion fails
            with open(dxf_path, "rb") as f:
                dxf_content = f.read()
            return Response(
                content=dxf_content,
                media_type="application/dxf",
                headers={"X-Fallback": "true", "X-Error": str(e)},
            )
