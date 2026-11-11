#!/usr/bin/env python3
"""
Clone a DIALux reference .evo zip, overriding selected members.

Unchanged local file records (header + compressed payload) are copied verbatim
from the reference archive. Replaced members reuse the reference ZipInfo metadata.
"""
from __future__ import annotations

import argparse
import base64
import json
import struct
import zlib
import zipfile
from pathlib import Path


def deflate_raw(data: bytes, level: int = 6) -> bytes:
    co = zlib.compressobj(level, zlib.DEFLATED, -15)
    return co.compress(data) + co.flush()


def crc32(data: bytes) -> int:
    return zlib.crc32(data) & 0xFFFFFFFF


def local_header_size(name_len: int, extra_len: int) -> int:
    return 30 + name_len + extra_len


def date_time_to_dos(dt: tuple[int, int, int, int, int, int]) -> tuple[int, int]:
    dos_date = ((dt[0] - 1980) << 9) | (dt[1] << 5) | dt[2]
    dos_time = (dt[3] << 11) | (dt[4] << 5) | (dt[5] // 2)
    return dos_time, dos_date


def clone_entry(
    src: bytes,
    info: zipfile.ZipInfo,
    new_payload: bytes | None,
) -> bytes:
    name = info.filename.encode("utf-8")
    extra = info.extra
    if new_payload is None:
        start = info.header_offset
        end = start + local_header_size(len(name), len(extra)) + info.compress_size
        return src[start:end]

    if info.is_dir():
        return src[info.header_offset : info.header_offset + local_header_size(len(name), len(extra))]

    if info.compress_type == zipfile.ZIP_STORED:
        comp = new_payload
    elif info.compress_type == zipfile.ZIP_DEFLATED:
        comp = deflate_raw(new_payload)
    else:
        raise ValueError(f"Unsupported compress_type {info.compress_type}")

    dos_time, dos_date = date_time_to_dos(info.date_time)
    crc = crc32(new_payload)
    header = struct.pack(
        "<IHHHHHIIIHH",
        0x04034B50,
        info.extract_version,
        info.flag_bits,
        info.compress_type,
        dos_time,
        dos_date,
        crc,
        len(comp),
        len(new_payload),
        len(name),
        len(extra),
    )
    return header + name + extra + comp


def central_directory_record(
    info: zipfile.ZipInfo,
    offset: int,
    csize: int,
    usize: int,
    crc: int,
) -> bytes:
    name = info.filename.encode("utf-8")
    extra = info.extra
    comment = info.comment.encode("utf-8") if info.comment else b""
    dos_time, dos_date = date_time_to_dos(info.date_time)
    return (
        struct.pack(
            "<IHHHHHHIIIHHHHHII",
            0x02014B50,
            info.create_version,
            info.extract_version,
            info.flag_bits,
            info.compress_type,
            dos_time,
            dos_date,
            crc,
            csize,
            usize,
            len(name),
            len(extra),
            len(comment),
            0,
            info.internal_attr,
            info.external_attr,
            offset,
        )
        + name
        + extra
        + comment
    )


def assemble(reference: Path, output: Path, overrides: dict[str, bytes]) -> None:
    src = reference.read_bytes()
    with zipfile.ZipFile(reference, "r") as zin:
        infos = zin.infolist()

    local_chunks: list[bytes] = []
    cd_records: list[bytes] = []
    offset = 0

    for info in infos:
        name = info.filename
        payload = overrides.get(name) if not name.endswith("/") else None
        chunk = clone_entry(src, info, payload)
        local_chunks.append(chunk)

        if payload is not None:
            name_b = info.filename.encode("utf-8")
            hdr = local_header_size(len(name_b), len(info.extra))
            comp = chunk[hdr:]
            crc = crc32(payload)
            csize = len(comp)
            usize = len(payload)
        else:
            crc = info.CRC
            csize = info.compress_size
            usize = info.file_size

        cd_records.append(central_directory_record(info, offset, csize, usize, crc))
        offset += len(chunk)

    cd_blob = b"".join(cd_records)
    cd_start = offset
    end = struct.pack(
        "<IHHHHIIH",
        0x06054B50,
        0,
        0,
        len(cd_records),
        len(cd_records),
        len(cd_blob),
        cd_start,
        0,
    )
    output.write_bytes(b"".join(local_chunks) + cd_blob + end)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("reference")
    ap.add_argument("output")
    ap.add_argument("overrides_json")
    args = ap.parse_args()
    spec = json.loads(Path(args.overrides_json).read_text())
    overrides = {k: base64.b64decode(v) for k, v in spec.items()}
    assemble(Path(args.reference), Path(args.output), overrides)


if __name__ == "__main__":
    main()
