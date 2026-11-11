#!/usr/bin/env python3
"""Validate DIALux-faithful sequential local zip layout. Prints JSON errors list."""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

_SCRIPT = Path(__file__).resolve().parent / "evo-assemble.py"
_spec = importlib.util.spec_from_file_location("evo_assemble", _SCRIPT)
_mod = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(_mod)

if __name__ == "__main__":
    errs = _mod.validate_sequential_layout(Path(sys.argv[1]))
    print(json.dumps(errs))
