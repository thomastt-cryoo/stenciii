"""Use the independent M0 validator on exact exported float32 coordinates."""
import sys
import json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'm0'))
from validate_artifacts import inspect
print(json.dumps(inspect(Path(sys.argv[1]))))
