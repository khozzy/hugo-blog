#!/usr/bin/env -S uv run --script
# /// script
# dependencies = []
# ///
"""Build incentive PDFs from markdown content.

Usage:
    ./scripts/build_incentive.py --all          # Build all incentives
    ./scripts/build_incentive.py <name>         # Build single incentive
"""

import argparse
import subprocess
import sys
import zipfile
from pathlib import Path


def run_docker(cmd: list[str]) -> None:
    """Run a Docker command."""
    print(f"  $ {' '.join(cmd)}")
    result = subprocess.run(cmd)
    if result.returncode != 0:
        sys.exit(result.returncode)


def build_incentive(name: str, project_root: Path) -> None:
    """Build a single incentive: markdown -> html -> pdf, zip assets."""
    incentive_dir = project_root / "incentives" / name
    dist_dir = project_root / "dist" / "incentives" / name
    dist_dir.mkdir(parents=True, exist_ok=True)

    content_file = incentive_dir / "content.md"
    if not content_file.exists():
        print(f"Error: {content_file} not found", file=sys.stderr)
        sys.exit(1)

    print(f"Building: {name}")

    html_file = dist_dir / "content.html"
    pdf_file = dist_dir / "content.pdf"

    # Markdown -> HTML (pandoc)
    run_docker(
        [
            "docker",
            "run",
            "--rm",
            "--platform",
            "linux/amd64",
            "-v",
            f"{project_root}:/data",
            "pandoc/extra",
            f"/data/incentives/{name}/content.md",
            "-o",
            f"/data/dist/incentives/{name}/content.html",
            "--css=/data/assets/pdf/kozlovski-pdf.css",
            f"--resource-path=/data/incentives/{name}:/data/incentives/{name}/assets",
            "--embed-resources",
            "--standalone",
        ]
    )

    # HTML -> PDF (weasyprint)
    run_docker(
        [
            "docker",
            "run",
            "--rm",
            "--platform",
            "linux/amd64",
            "-v",
            f"{project_root}:/data",
            "minidocks/weasyprint:latest",
            f"/data/dist/incentives/{name}/content.html",
            f"/data/dist/incentives/{name}/content.pdf",
        ]
    )

    # Clean up intermediate HTML
    html_file.unlink(missing_ok=True)
    print(f"Built: {pdf_file.relative_to(project_root)}")

    # Bundle assets if directory exists and has files
    assets_dir = incentive_dir / "assets"
    if assets_dir.is_dir() and any(assets_dir.iterdir()):
        zip_file = dist_dir / "assets.zip"
        zip_file.unlink(missing_ok=True)
        with zipfile.ZipFile(zip_file, "w", zipfile.ZIP_DEFLATED) as zf:
            for asset in assets_dir.iterdir():
                if asset.is_file():
                    zf.write(asset, asset.name)
        print(f"Built: {zip_file.relative_to(project_root)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build incentive PDFs")
    parser.add_argument("name", nargs="?", help="Incentive name to build")
    parser.add_argument("--all", action="store_true", help="Build all incentives")
    args = parser.parse_args()

    project_root = Path(__file__).resolve().parent.parent
    incentives_dir = project_root / "incentives"

    if args.all:
        # Build all incentives
        for incentive_path in sorted(incentives_dir.iterdir()):
            if incentive_path.is_dir() and (incentive_path / "content.md").exists():
                build_incentive(incentive_path.name, project_root)
    elif args.name:
        build_incentive(args.name, project_root)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
