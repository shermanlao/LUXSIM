#!/usr/bin/env python3
"""List remaining diffs vs official reference for an exported .evo."""
import sys
import zipfile
from pathlib import Path

REF = Path(__file__).resolve().parents[1] / "fixtures/dialux-evo-12.1-reference.evo.zip"


def main() -> None:
    path = Path(sys.argv[1])
    zr = zipfile.ZipFile(REF)
    ze = zipfile.ZipFile(path)
    print("=== Members ===")
    for name in sorted(set(zr.namelist()) | set(ze.namelist())):
        if name.endswith("/"):
            continue
        br, be = zr.read(name), ze.read(name)
        if br == be:
            print(f"SAME {name} ({len(br)} B)")
        else:
            print(f"DIFF {name} official={len(br)} export={len(be)}")
    if "Project/ProjectData/ProjectData.dat" in ze.namelist():
        good = zr.read("Project/ProjectData/ProjectData.dat").decode("utf-8-sig").split("\r\n")
        exp = ze.read("Project/ProjectData/ProjectData.dat").decode("utf-8-sig").split("\r\n")
        n = sum(1 for a, b in zip(good, exp) if a != b)
        print(f"\nProjectData.dat changed lines: {n}")
        for i, (a, b) in enumerate(zip(good, exp), 1):
            if a != b:
                print(f"  L{i}:")
                print(f"    - {a[:160]}")
                print(f"    + {b[:160]}")
    rx = zr.read("ArchiveInfo/ArchiveInfo.xml").decode()
    ex = ze.read("ArchiveInfo/ArchiveInfo.xml").decode()
    if rx != ex:
        print("\nArchiveInfo.xml differs")
        import difflib

        for line in difflib.unified_diff(rx.splitlines(), ex.splitlines(), lineterm=""):
            print(line)


if __name__ == "__main__":
    main()
