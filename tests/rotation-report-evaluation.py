"""Optional offline evaluator regression: python tests/rotation-report-evaluation.py."""
import base64
import importlib.util
import io
from pathlib import Path
import numpy as np
from PIL import Image

spec = importlib.util.spec_from_file_location('evaluator', Path(__file__).resolve().parents[1] / 'scripts/evaluate-rotation-report.py')
evaluator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(evaluator)


def url(image):
    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    return 'data:image/png;base64,' + base64.b64encode(buffer.getvalue()).decode()


# Asymmetric repeatable pixels distinguish quarter turns without real coin data.
pixels = np.random.default_rng(42).integers(0, 256, (256, 256), dtype=np.uint8)
original = Image.fromarray(pixels)
first = url(original)
for degrees in (0, 90, -90, 180):
    measured = evaluator.register(first, url(original.rotate(-degrees)))
    assert measured['usable'], measured
    assert measured['degrees'] == degrees, measured
flat = url(Image.new('L', (256, 256), 128))
assert not evaluator.register(flat, flat)['usable'], 'Featureless images cannot supply labels'
report = {'tests': [{'flow': 'batch_rotation', 'images': {'a': flat, 'b': flat}, 'coins': [
    {'detection_number': 1, 'automatic_confident': True, 'manual_correction_clockwise_degrees': -13},
    {'detection_number': 2, 'automatic_confident': False, 'automatic_image_ref': 'a', 'upright_image_ref': 'b'}]}]}
result = evaluator.evaluate(report)
assert result['scored_coins'] == 1
assert result['coins'][0]['residual_degrees'] == 13
assert result['coins'][1]['within_8_degrees'] is None
print('PASS offline registration: signed rotations, recorded angles and unscorable image rejection')
