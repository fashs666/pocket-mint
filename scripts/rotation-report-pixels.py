"""Decode private report pixels for the offline JS evaluator; no file writes."""
import base64
import importlib.util
import io
import json
from pathlib import Path
import sys
from PIL import Image

spec = importlib.util.spec_from_file_location('registration', Path(__file__).with_name('evaluate-rotation-report.py'))
registration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(registration)
with open(sys.argv[1], encoding='utf-8') as report:
    tests = [t for t in json.load(report)['tests'] if t.get('flow') == 'batch_rotation']
pixels, keys = {}, {}
for test in tests:
    for coin in test['coins']:
        expected = coin.get('expected_clockwise_degrees')
        if expected is None:
            measured = registration.register(test['images'][coin['original_image_ref']], test['images'][coin['upright_image_ref']])
            expected = measured['degrees'] if measured['usable'] else None
        coin['evaluation_expected'] = expected
    for url in test['images'].values():
        if url in keys:
            continue
        with Image.open(io.BytesIO(base64.b64decode(url.split(',', 1)[1]))) as source:
            image = source.convert('RGBA')
        image.thumbnail((180, 180), Image.Resampling.BILINEAR)
        canvas = Image.new('RGBA', (180, 180), '#f3f0e9')
        canvas.alpha_composite(image, ((180-image.width)//2, (180-image.height)//2))
        key = 'data:image/jpeg;base64,' + str(len(keys))
        keys[url] = key
        pixels[key] = base64.b64encode(canvas.tobytes()).decode()
for test in tests:
    test['images'] = {ref: keys[url] for ref, url in test['images'].items()}
print(json.dumps({'tests': tests, 'pixels': pixels}))
