#!/usr/bin/env python3
"""
Build isolated .evo lab archives for DIALux load bisection (layout always validated).

Writes to /opt/cursor/artifacts/evo-lab/ with manifest.json.
"""
from __future__ import annotations

import importlib.util
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "packages/project-io/scripts/evo-assemble.py"
_spec = importlib.util.spec_from_file_location("evo_assemble", SCRIPT)
_mod = importlib.util.module_from_spec(_spec)
assert _spec.loader
_spec.loader.exec_module(_mod)

REF = ROOT / "fixtures/dialux-evo-12.1-reference.evo.zip"
OUT_DIR = Path("/opt/cursor/artifacts/evo-lab")

LAB_ARCHIVE_UUID = "00000000-0000-4000-8000-luxsimlab01"


def load_template_dat() -> str:
    p = ROOT / "fixtures/dialux-evo-12.1-reference/Project/ProjectData/ProjectData.dat"
    data = p.read_bytes()
    if data[:3] == b"\xef\xbb\xbf":
        data = data[3:]
    return data.decode("utf-8")


def load_template_archive_xml() -> str:
    return (ROOT / "fixtures/dialux-evo-12.1-reference/ArchiveInfo/ArchiveInfo.xml").read_text(
        "utf-8"
    )


def patch_dat_file_description_only(dat: str) -> str:
    return re.sub(
        r"FILE_DESCRIPTION \([^)]+\);",
        "FILE_DESCRIPTION ('AED-180297 L9M', 'LUXSIM lab: FILE_DESCRIPTION only');",
        dat,
        count=1,
    )


def patch_dat_storey_heights_only(dat: str) -> str:
    return re.sub(
        r"(StoreyRepresentationData \(#[0-9]+, 0, \$?, \$?, False, \(1\., 1\., 1\.\), )2\.7999999999999998",
        r"\g<1>2.8",
        dat,
    )


def patch_archive_description_only(xml: str) -> str:
    return re.sub(
        r"<Description>[^<]*</Description>",
        "<Description>LUXSIM lab: ArchiveInfo Description only</Description>",
        xml,
    )


def patch_archive_unique_and_description(xml: str, uuid: str = LAB_ARCHIVE_UUID) -> str:
    xml = patch_archive_description_only(xml)
    return re.sub(r"<UniqueName>[^<]*</UniqueName>", f"<UniqueName>{uuid}</UniqueName>", xml)


def patch_project_info_uuid(dat: str, uuid: str = LAB_ARCHIVE_UUID) -> str:
    return re.sub(
        r"(#151 = ProjectInfoPropertySet \(2, '[^']+', ')[^']+(')",
        rf"\g<1>{uuid}\2",
        dat,
        count=1,
    )


VARIANTS: list[dict] = []


def build(name: str, desc: str, overrides: dict[str, bytes]) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / f"{name}.evo"
    _mod.assemble(REF, out, overrides)
    errs = _mod.validate_sequential_layout(out)
    VARIANTS.append(
        {
            "file": str(out),
            "name": name,
            "description": desc,
            "overrides": sorted(overrides.keys()),
            "layout_errors": errs,
        }
    )


def main() -> None:
    dat = load_template_dat()
    xml = load_template_archive_xml()

    build("00-byte-clone", "Zero overrides — byte-identical to official reference.", {})

    build(
        "01-archive-description-only",
        "ArchiveInfo Description only; UniqueName/times unchanged; .dat untouched.",
        {"ArchiveInfo/ArchiveInfo.xml": patch_archive_description_only(xml).encode("utf-8")},
    )

    build(
        "02-archive-new-uniquename-only",
        "New ArchiveInfo UniqueName (Description lab text); .dat untouched — uuid desync like R4.",
        {"ArchiveInfo/ArchiveInfo.xml": patch_archive_unique_and_description(xml).encode("utf-8")},
    )

    build(
        "03-dat-file-description-only",
        "STEP FILE_DESCRIPTION line only; ArchiveInfo untouched (#151 unchanged).",
        {"Project/ProjectData/ProjectData.dat": patch_dat_file_description_only(dat).encode("utf-8")},
    )

    build(
        "04-dat-storey-heights-only",
        "Nine StoreyRepresentationData 2.799…→2.8 only.",
        {"Project/ProjectData/ProjectData.dat": patch_dat_storey_heights_only(dat).encode("utf-8")},
    )

    r4_xml = xml
    r4_xml = re.sub(
        r"<UniqueName>[^<]*</UniqueName>",
        "<UniqueName>lab-r4-style-unique-name</UniqueName>",
        r4_xml,
    )
    r4_xml = re.sub(
        r"<Description>[^<]*</Description>",
        "<Description>R4-style description</Description>",
        r4_xml,
    )
    r4_xml = re.sub(
        r"<CreateTime>[^<]*</CreateTime>", "<CreateTime>2026-11-11T10:00:00.000Z</CreateTime>", r4_xml
    )
    r4_xml = re.sub(
        r"<ModifiedTime>[^<]*</ModifiedTime>",
        "<ModifiedTime>2026-11-11T10:00:00.000Z</ModifiedTime>",
        r4_xml,
    )
    r4_dat = patch_dat_file_description_only(dat)
    r4_dat = re.sub(
        r"FILE_NAME \([^)]+\);",
        "FILE_NAME ('AED-180297 L9M.evo', '', '2026-11-11T10:00:00Z');",
        r4_dat,
        count=1,
    )
    r4_dat = patch_dat_storey_heights_only(r4_dat)

    build(
        "05-r4-style-both-desync",
        "R4-like: new ArchiveInfo UniqueName + ISO times + STEP FILE_* + storey 2.8; #151 still official uuid.",
        {
            "ArchiveInfo/ArchiveInfo.xml": r4_xml.encode("utf-8"),
            "Project/ProjectData/ProjectData.dat": r4_dat.encode("utf-8"),
        },
    )

    build(
        "06-uniquename-synced",
        "ArchiveInfo UniqueName + #151 ProjectInfoPropertySet field 3 updated to same uuid; no other .dat edits.",
        {
            "ArchiveInfo/ArchiveInfo.xml": patch_archive_unique_and_description(xml).encode("utf-8"),
            "Project/ProjectData/ProjectData.dat": patch_project_info_uuid(dat).encode("utf-8"),
        },
    )

    build(
        "07-uniquename-synced-plus-r4-dat",
        "Synced uuid (06) plus R4 STEP header + storey height patches.",
        {
            "ArchiveInfo/ArchiveInfo.xml": patch_archive_unique_and_description(xml).encode("utf-8"),
            "Project/ProjectData/ProjectData.dat": patch_dat_storey_heights_only(
                patch_dat_file_description_only(patch_project_info_uuid(dat))
            ).encode("utf-8"),
        },
    )

    manifest = OUT_DIR / "manifest.json"
    manifest.write_text(json.dumps(VARIANTS, indent=2))
    print("Wrote", manifest)
    for v in VARIANTS:
        print(v["name"], "layout", v["layout_errors"])


if __name__ == "__main__":
    main()
