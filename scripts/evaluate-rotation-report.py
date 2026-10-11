"""Offline saved-report evaluation. Requires Pillow and numpy; sends no photos.

Usage: python scripts/evaluate-rotation-report.py /path/to/report.json
Image registration measures a user's correction, NOT an artwork/upright detector.
Low-quality registrations remain unscored; inferred labels are explicitly marked.
"""
import argparse
import base64
import io
import json
import numpy as np
from PIL import Image


def polar(url):
    with Image.open(io.BytesIO(base64.b64decode(url.split(',', 1)[1]))) as image:
        pixels = np.array(image.convert('L').resize((256, 256)), dtype=float)
    theta = np.arange(360) * np.pi / 180
    radius = np.linspace(25, 108, 45)[:, None]
    x = np.clip(np.rint(127.5 + radius * np.cos(theta)), 0, 255).astype(int)
    y = np.clip(np.rint(127.5 + radius * np.sin(theta)), 0, 255).astype(int)
    samples = pixels[y, x]
    samples -= samples.mean(axis=1, keepdims=True)
    samples /= np.maximum(samples.std(axis=1, keepdims=True), 5)
    return samples


def register(first, last):
    a, b = polar(first), polar(last)
    correlation = np.fft.irfft(np.conj(np.fft.rfft(a, axis=1)) *
                              np.fft.rfft(b, axis=1), n=360, axis=1).mean(axis=0) / 360
    best = int(correlation.argmax())
    distant = [i for i in range(360) if min((i-best) % 360, (best-i) % 360) > 12]
    score = float(correlation[best])
    margin = score - float(correlation[distant].max())
    return {'degrees': best if best <= 180 else best-360,
            'correlation': round(score, 3), 'peak_margin': round(margin, 3),
            'usable': score >= .8 and margin >= .2}


def evaluate(data):
    rows = []
    for batch, test in enumerate(t for t in data['tests'] if t.get('flow') == 'batch_rotation'):
        for coin in test['coins']:
            correction = coin.get('manual_correction_clockwise_degrees')
            registration = None
            label_source = 'recorded' if correction is not None else 'unscored'
            if correction is None:
                images = test['images']
                registration = register(images[coin['automatic_image_ref']], images[coin['upright_image_ref']])
                if registration['usable']:
                    correction = registration['degrees']
                    label_source = 'inferred_image_registration'
            residual = None if correction is None else abs((correction+180) % 360-180)
            rows.append({'batch': batch, 'coin': coin['detection_number'],
                         'automatic_confident': coin['automatic_confident'],
                         'label_source': label_source, 'residual_degrees': residual,
                         'within_8_degrees': None if residual is None else residual <= 8,
                         'registration': registration})
    return {'note': 'Registration reconstructs corrections, not coin identity or canonical orientation. Unscored cases are not passes.',
            'total_coins': len(rows), 'scored_coins': sum(r['residual_degrees'] is not None for r in rows),
            'coins': rows}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('report')
    args = parser.parse_args()
    with open(args.report, encoding='utf-8') as report:
        print(json.dumps(evaluate(json.load(report)), indent=2))
