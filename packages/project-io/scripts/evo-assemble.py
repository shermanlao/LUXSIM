#!/usr/bin/env python3
"""
Clone a DIALux reference .evo zip, overriding selected members.

DIALux evo walks local file records sequentially (no gaps). NTFS extra fields
(0x000a) live in the CENTRAL DIRECTORY only — local headers use elen=0.
"""
from __future__ import annotations

import argparse
import base64
import json
import struct
import zlib
import zipfile
from pathlib import Path

LOCAL_HDR = struct.Struct("<IHHHHHIIIHH")


def deflate_raw(data: bytes, level: int = 6) -> bytes:
    co = zlib.compressobj(level, zlib.DEFLATED, -15)
    return co.compress(data) + co.flush()


def crc32(data: bytes) -> int:
    return zlib.crc32(data) & 0xFFFFFFFF


def date_time_to_dos(dt: tuple[int, int, int, int, int, int]) -> tuple[int, int]:
    dos_date = ((dt[0] - 1980) << 9) | (dt[1] << 5) | dt[2]
    dos_time = (dt[3] << 11) | (dt[4] << 5) | (dt[5] // 2)
    return dos_time, dos_date


def parse_local_header(src: bytes, offset: int) -> tuple[int, int, int, int, int]:
    """Return nlen, elen, csize, header_bytes, data_start."""
    (
        sig,
        _ver,
        _flag,
        _comp,
        _t,
        _d,
        _crc,
        csize,
        _usize,
        nlen,
        elen,
    ) = LOCAL_HDR.unpack_from(src, offset)
    if sig != 0x04034B50:
        raise ValueError(f"Bad local signature at {offset}: {sig:#x}")
    header_len = 30 + nlen + elen
    return nlen, elen, csize, header_len, offset + header_len


def copy_local_record(src: bytes, header_offset: int) -> bytes:
    _, elen, csize, header_len, data_start = parse_local_header(src, header_offset)
    return src[header_offset : data_start + csize]


def build_local_record(
    info: zipfile.ZipInfo,
    compressed: bytes,
    uncompressed_size: int,
    crc: int,
) -> bytes:
    name = info.filename.encode("utf-8")
    dos_time, dos_date = date_time_to_dos(info.date_time)
    header = LOCAL_HDR.pack(
        0x04034B50,
        info.extract_version,
        info.flag_bits,
        info.compress_type,
        dos_time,
        dos_date,
        crc,
        len(compressed),
        uncompressed_size,
        len(name),
        0,
    )
    return header + name + compressed


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


def local_chunk(
    src: bytes,
    info: zipfile.ZipInfo,
    new_payload: bytes | None,
) -> bytes:
    if new_payload is None:
        return copy_local_record(src, info.header_offset)

    if info.is_dir():
        return copy_local_record(src, info.header_offset)

    if info.compress_type == zipfile.ZIP_STORED:
        comp = new_payload
    elif info.compress_type == zipfile.ZIP_DEFLATED:
        comp = deflate_raw(new_payload)
    else:
        raise ValueError(f"Unsupported compress_type {info.compress_type}")

    return build_local_record(info, comp, len(new_payload), crc32(new_payload))


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
        chunk = local_chunk(src, info, payload)
        local_chunks.append(chunk)

        if payload is not None:
            crc = crc32(payload)
            _, _, csize, header_len, data_start = parse_local_header(chunk, 0)
            comp = chunk[data_start:]
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


def validate_sequential_layout(path: Path) -> list[str]:
    """Walk local headers from byte 0; return human-readable violations."""
    errors: list[str] = []
    data = path.read_bytes()
    pos = 0
    count = 0
    with zipfile.ZipFile(path, "r") as zf:
        expected_members = len(zf.infolist())

    while pos < len(data) and data[pos : pos + 4] == b"PK\x03\x04":
        try:
            nlen, elen, csize, header_len, data_start = parse_local_header(data, pos)
        except ValueError as e:
            errors.append(str(e))
            break
        if elen != 0:
            errors.append(f"local elen={elen} at offset {pos} (expected 0)")
        record_end = data_start + csize
        count += 1
        pos = record_end
    else:
        if pos < len(data) and data[pos : pos + 4] != b"PK\x01\x02":
            if data[pos : pos + 4] == b"PK\x03\x04":
                errors.append(f"gap before local at {pos}: leftover bytes {data[pos:pos+8]!r}")
            else:
                errors.append(f"expected CD at {pos}, got signature {data[pos:pos+4]!r}")

    if count != expected_members:
        errors.append(f"local walk count {count} != {expected_members} central entries")

    eocd_off = data.rfind(b"PK\x05\x06")
    if eocd_off >= 0:
        cd_offset = struct.unpack_from("<I", data, eocd_off + 16)[0]
        if cd_offset != pos:
            errors.append(f"last local ends at {pos} but EOCD cd offset is {cd_offset}")

    return errors


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("reference")
    ap.add_argument("output")
    ap.add_argument("overrides_json")
    ap.add_argument("--validate", action="store_true")
    args = ap.parse_args()
    spec = json.loads(Path(args.overrides_json).read_text())
    overrides = {k: base64.b64decode(v) for k, v in spec.items()}
    out = Path(args.output)
    assemble(Path(args.reference), out, overrides)
    if args.validate:
        errs = validate_sequential_layout(out)
        if errs:
            raise SystemExit("layout: " + "; ".join(errs))


if __name__ == "__main__":
    main()
