"""Cut the downloaded source clips down to the short WAV files in samples/.

Run from the project folder after the sources have been saved as renders/raw-<name>.wav
(see samples/CREDITS.md for where each one comes from):

    python tools/make_samples.py

Needs numpy, scipy and soundfile. Every output is mono 16-bit, peaks at 0.9, and has short fades at each cut.
"""
import os
import numpy as np
import scipy.signal as ss
import soundfile as sf

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(HERE, 'renders')
OUT = os.path.join(HERE, 'samples')

# name: (source, rate, [(start, end), ...], options). Several pieces are joined end to end; the engine's `cuts` are where each begins.
PLAN = {
    'rooster': ('rooster', 22050, [(2.60, 5.50)], {}),
    'cow': ('cow', 22050, [(0.60, 1.40)], {}),
    'goat': ('goat', 22050, [(3.90, 5.46), (5.60, 7.10), (15.58, 17.38)], {}),
    'pig': ('pig', 22050, [(0.32, 1.00), (18.68, 19.34), (5.50, 5.72), (9.46, 9.72), (17.74, 18.04), (21.76, 22.08)], {}),
    'countdown': ('countdown', 16000, [(2.85, 20.00)], {'fade_out': 0.6}),
    'houston': ('houston', 16000, [(0.15, 1.75), (5.05, 6.00), (9.85, 11.30)], {}),
    'modem': ('modem', 22050, [(2.00, 3.80), (5.20, 6.10), (7.70, 9.50)], {}),
    'saw': ('chainsaw10', 22050, [(3.00, 3.80)], {'loop': 0.1}),
    'rev': ('chainsaw3', 22050, [(4.30, 6.80)], {'fade_out': 0.4}),
    'wilhelm': ('wilhelm', 22050, [(0.00, 1.15)], {}),
    'explosion': ('explosion', 22050, [(0.05, 2.40)], {'fade_out': 0.3}),
    'gong': ('gong', 22050, [(0.00, 3.50)], {'fade_out': 1.2}),
    'blast': ('blast', 44100, [(15.187, 16.387)], {'edge': 0.002}),
    'casio': ('casio', 32000, [(0.024, 3.252)], {'edge': 0.002}),
    'funk': ('funk', 32000, [(0.0, 3.6923)], {'edge': 0.002}),
}


def load(name):
    x, sr = sf.read(os.path.join(RAW, 'raw-' + name + '.wav'), always_2d=True)
    return x.mean(axis=1), sr


def fade(x, sr, t_in, t_out):
    x = x.copy()
    a = min(len(x) // 2, max(1, int(sr * t_in))); b = min(len(x) // 2, max(1, int(sr * t_out)))
    x[:a] *= np.linspace(0, 1, a); x[-b:] *= np.linspace(1, 0, b)
    return x


def main():
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for name, (src, rate, pieces, opt) in PLAN.items():
        x, sr = load(src)
        parts, cuts, t = [], [], 0.0
        for a, b in pieces:
            seg = x[int(a * sr):int(b * sr)]
            if opt.get('loop'):  # make the end run into the start, so it can go round and round without a click
                n = int(opt['loop'] * sr); body = seg[n:].copy()
                w = np.linspace(0, 1, n); body[-n:] = body[-n:] * (1 - w) + seg[:n] * w; seg = body
            else:
                edge = opt.get('edge', 0.005)
                seg = fade(seg, sr, edge, opt.get('fade_out', edge))
            seg = seg / (np.abs(seg).max() + 1e-9) * 0.9
            parts.append(seg); cuts.append(round(t, 3)); t += len(seg) / sr
        y = np.concatenate(parts)
        if rate != sr:
            y = ss.resample_poly(y, rate, sr)
            y = y / (np.abs(y).max() + 1e-9) * 0.9
        path = os.path.join(OUT, name + '.wav')
        sf.write(path, y, rate, subtype='PCM_16')
        size = os.path.getsize(path); total += size
        print('%-10s %6.3fs  %5d Hz  %4d KB  cuts %s' % (name, len(y) / rate, rate, size // 1024, cuts))
    print('total %d KB' % (total // 1024))


if __name__ == '__main__':
    main()
