#!/usr/bin/env python3
"""ACE Baby poolside ad: split screen (ACE Baby + live workflow), workflow run, close.
Usage: render.py [--preview t1,t2,...]  (writes still PNGs instead of the MP4)
"""
import math, subprocess, sys, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

D = '/tmp/claude-0/-home-claude/5bcbe5b4-e22c-5d8b-91d6-a7477d36cd10/scratchpad/acevid/'
F = D + 'fonts/package/Montserrat_'
W, H, FPS = 1080, 1920, 30

def font(w, s): return ImageFont.truetype(F + w + '.ttf', s)
BLACK = font('900Black', 64); XB = font('800ExtraBold', 58); B = font('700Bold', 30)
SB = font('600SemiBold', 34); SB_S = font('600SemiBold', 19); CAP = font('800ExtraBold', 54)

CHAR = (28, 28, 30); RED = (211, 32, 39); GOLD = (232, 182, 72); GOLD_HI = (255, 222, 140)
SILVER = (196, 200, 206); IVORY = (251, 246, 236); GREY = (110, 112, 118); WHITE = (255, 255, 255)

# ---------------------------------------------------------------- timeline
T1 = 34.00            # end of split-screen section (voice cut point, before "Seriously though")
P2 = 8.5              # workflow run length (no voice)
VOICE_END = 41.85
VOICE_FILE = 'voiceE_beach.wav'
OUT_NAME = 'ACE_Baby_Beach_v3.mp4'
T2 = T1 + P2
TOTAL = T2 + (VOICE_END - T1) + 0.9

CAPTIONS = [  # (start, end, text, gold words)
    (0.00, 1.78, "Heyyy buddy!", []),
    (2.08, 6.16, "Oh man, you will NOT believe the day I just had.", ["NOT"]),
    (6.94, 7.84, "Okay, listen...", []),
    (8.44, 9.63, "Every new lead?", []),
    (10.18, 12.26, "ACE answered it in minutes.", ["ACE"]),
    (12.55, 13.27, "MINUTES!", ["MINUTES!"]),
    (13.93, 17.08, "Built me a fresh prospect list, sent out my proposals,", []),
    (17.28, 19.69, "followed up, booked my calls for tomorrow...", []),
    (20.22, 23.10, "even posted to ALL my social pages!", ["ALL"]),
    (23.55, 25.00, "And what did I do?", []),
    (26.05, 27.60, "I tapped Approve.", ["Approve."]),
    (29.16, 31.44, "On my phone! On the beach!", []),
    (31.68, 33.38, "Gonna go hang with the boys tonight.", []),
]

# Jim's ACE workflow, in his order (14 Oct 2026): (full name, rail label, result line)
STAGES = [
    ("Lead Generation Accelerator", "Lead Gen", "New leads captured and answered in minutes"),
    ("Content Creation Generator", "Content", "Fresh posts created for the week"),
    ("Social Media Automated Marketing", "Social", "Posted to every social page"),
    ("Full Throttle \u2013 Prospecting Autopilot", "Prospecting", "Fresh, qualified prospect list built"),
    ("Automated Customer Acquisition", "Acquisition", "Proposals out, new customers coming in"),
    ("Pipeline Management & Growth", "Pipeline", "Every lead followed up, calls booked"),
    ("Referral Management", "Referrals", "Happy clients sending referrals"),
    ("Compounding Exponential Growth Autopilot", "Growth", "Growth compounding on autopilot"),
]
# When ACE Baby talks about a stage, it lights up: (time, stage index or None, label, title, result)
EVENTS = [
    (10.25, 0), (13.95, 3), (15.55, 4), (17.30, 5), (20.25, 1), (21.40, 2),
    (26.10, None, "ONE-TAP APPROVAL", "Approved from his phone", "Everything above ran with one tap"),
    (29.16, 6), (30.40, 7),
]
NODES = [(e[0],) for e in EVENTS]   # activation times (used for sound)
FINAL_CARD_T = 31.68

def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def ease(x): x = clamp(x); return 1 - (1 - x) ** 3
def ease_io(x): x = clamp(x); return x * x * (3 - 2 * x)

# ---------------------------------------------------------------- sprites
def glow_sprite(r, color, blur):
    s = int(r * 2 + blur * 4)
    im = Image.new('RGBA', (s, s), color + (0,))
    d = ImageDraw.Draw(im)
    d.ellipse([s / 2 - r, s / 2 - r, s / 2 + r, s / 2 + r], fill=color + (255,))
    return im.filter(ImageFilter.GaussianBlur(blur))

HALO = glow_sprite(48, GOLD, 22)
SPARK = glow_sprite(14, GOLD_HI, 9)
SPARK_CORE = glow_sprite(6, (255, 255, 240), 2)
BIG_HALO = glow_sprite(130, GOLD, 70)

def paste_alpha(base, sprite, cx, cy, a):
    if a <= 0.01: return
    sp = sprite
    if a < 0.999:
        sp = sprite.copy(); al = sp.getchannel('A').point(lambda v: int(v * a)); sp.putalpha(al)
    base.alpha_composite(sp, (int(cx - sp.width / 2), int(cy - sp.height / 2)))

def radial_bg(w, h, inner, outer, cx, cy, rad):
    y, x = np.mgrid[0:h, 0:w]
    d = np.clip(np.sqrt((x - cx) ** 2 + (y - cy) ** 2) / rad, 0, 1)[..., None]
    arr = np.array(inner, float) * (1 - d) + np.array(outer, float) * d
    return Image.fromarray(arr.astype(np.uint8), 'RGB').convert('RGBA')

# ---------------------------------------------------------------- assets
baby = Image.open(D + 'master.png').convert('RGB').resize((1400, 1400), Image.LANCZOS)
logo = Image.open(D + 'ace-logo.jpg').convert('RGB').resize((640, 640), Image.LANCZOS)
logo_mask = Image.fromarray(np.clip((np.asarray(logo.convert('L'), float) - 18) * 6, 0, 255).astype(np.uint8))

BOTTOM_TOP = 1010
BOTTOM_BG = radial_bg(W, H - BOTTOM_TOP, (255, 244, 214), IVORY, W / 2, 380, 700)
dd = ImageDraw.Draw(BOTTOM_BG)
for gy in range(30, H - BOTTOM_TOP, 44):
    for gx in range(30, W, 44):
        dd.ellipse([gx - 1.5, gy - 1.5, gx + 1.5, gy + 1.5], fill=(225, 214, 190, 255))
P2_BG = radial_bg(W, H, (255, 240, 205), IVORY, W / 2, H * 0.55, 1250)
P3_BG = radial_bg(W, H, (78, 52, 16), (8, 8, 9), W / 2, 640, 900)

LIGHT_LEAK = radial_bg(1080, 1010, (255, 214, 130), (0, 0, 0), 980, 60, 760)
LL = np.asarray(LIGHT_LEAK.convert('RGB'), float) * 0.20

# ---------------------------------------------------------------- helpers
def text_w(d, s, f): return d.textlength(s, font=f)

def wrap(d, text, f, maxw):
    words, lines, cur = text.split(), [], ''
    for w_ in words:
        t = (cur + ' ' + w_).strip()
        if text_w(d, t, f) <= maxw: cur = t
        else: lines.append(cur); cur = w_
    if cur: lines.append(cur)
    return lines

def draw_rich_centered(d, lines, y, f, gold_words, fill=WHITE, stroke=6, lh=66):
    for i, line in enumerate(lines):
        x = (W - text_w(d, line, f) - 10 * (len(line.split()) - 1)) / 2
        for j, word in enumerate(line.split()):
            col = GOLD_HI if word in gold_words else fill
            d.text((x, y + i * lh), word, font=f, fill=col, stroke_width=stroke, stroke_fill=(0, 0, 0))
            x += text_w(d, word, f) + text_w(d, ' ', f) + 10

def rrect(d, box, r, **kw): d.rounded_rectangle(box, r, **kw)

def check_icon(d, cx, cy, r, bg, fg):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=bg)
    d.line([(cx - r * .45, cy), (cx - r * .1, cy + r * .35), (cx + r * .5, cy - r * .35)], fill=fg, width=max(3, int(r * .22)), joint='curve')

# ---------------------------------------------------------------- part 1
RAIL_Y = BOTTOM_TOP + 160
RAIL_X = [80 + i * 131 for i in range(8)]

def part1(t):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 255))
    # --- ACE Baby panel: slow push-in with a gentle hammock sway
    z = 1.0 + 0.10 * ease_io(t / T1)
    ang = math.radians(0.9 * math.sin(t * 1.15))
    sc = 1080 / 1150 * z
    ox, oy = 700 + math.sin(t * 0.6) * 6, 640 + math.cos(t * 0.8) * 5
    a, b = math.cos(ang) / sc, math.sin(ang) / sc
    mat = (a, b, ox - a * 540 - b * 505, -b, a, oy + b * 540 - a * 505)
    top = baby.transform((W, BOTTOM_TOP), Image.AFFINE, mat, Image.BICUBIC)
    arr = np.asarray(top, float); arr = np.clip(arr + LL * (0.8 + 0.2 * math.sin(t * 0.7)), 0, 255)
    im.paste(Image.fromarray(arr.astype(np.uint8), 'RGB'), (0, 0))
    d = ImageDraw.Draw(im)
    # tag + live call
    rrect(d, [36, 36, 382, 96], 30, fill=(0, 0, 0, 170))
    d.text((60, 49), "ACE · BABY CEO", font=B, fill=WHITE)
    rrect(d, [W - 330, 36, W - 36, 96], 30, fill=(0, 0, 0, 170))
    pulse = 0.5 + 0.5 * math.sin(t * 6)
    d.ellipse([W - 306, 56, W - 286, 76], fill=(int(160 + 95 * pulse), 30, 36))
    mm, ss = int(t) // 60, int(t) % 60
    d.text((W - 272, 49), f"ON A CALL {mm}:{ss:02d}", font=B, fill=WHITE)
    # captions
    for (s, e, txt, gw) in CAPTIONS:
        if s - 0.05 <= t <= e + 0.25:
            lines = wrap(d, txt, CAP, 960)
            y0 = BOTTOM_TOP - 70 - len(lines) * 66
            draw_rich_centered(d, lines, y0, CAP, gw)
            break
    # divider
    d.rectangle([0, BOTTOM_TOP - 3, W, BOTTOM_TOP + 3], fill=GOLD)
    # --- workflow panel
    im.alpha_composite(BOTTOM_BG, (0, BOTTOM_TOP))
    d = ImageDraw.Draw(im)
    pd = 0.5 + 0.5 * math.sin(t * 5)
    d.ellipse([60, BOTTOM_TOP + 48, 78, BOTTOM_TOP + 66], fill=(int(170 + 85 * pd), 32, 39))
    d.text((92, BOTTOM_TOP + 40), "ACE WORKFLOW  ·  LIVE", font=B, fill=CHAR)
    lit_t = {}
    for e in EVENTS:
        if e[1] is not None: lit_t[e[1]] = e[0]
    done = sum(1 for i in range(8) if t >= lit_t.get(i, 1e9))
    lab_ = f"{done}/8 DONE"
    d.text((W - 60 - text_w(d, lab_, B), BOTTOM_TOP + 40), lab_, font=B, fill=RED if done < 8 else (40, 140, 70))
    d.line([(RAIL_X[0], RAIL_Y), (RAIL_X[-1], RAIL_Y)], fill=(214, 208, 196), width=8)
    for i in range(7):  # gold link between neighbours that are both running
        if t >= lit_t[i] and t >= lit_t[i + 1]:
            k = ease((t - max(lit_t[i], lit_t[i + 1])) / 0.4)
            d.line([(RAIL_X[i], RAIL_Y), (RAIL_X[i] + (RAIL_X[i + 1] - RAIL_X[i]) * k, RAIL_Y)], fill=GOLD, width=8)
    for i in range(8):
        x = RAIL_X[i]; ta = lit_t[i]; act = t >= ta
        if act:
            k = clamp((t - ta) / 0.6)
            paste_alpha(im, HALO, x, RAIL_Y, 0.5 + 0.5 * (1 - k) + 0.1 * math.sin(t * 4 + i))
        d = ImageDraw.Draw(im)
        r = 34 + (8 * (1 - ease((t - ta) / 0.35)) if act and t - ta < 0.35 else 0)
        if act:
            d.ellipse([x - r, RAIL_Y - r, x + r, RAIL_Y + r], fill=CHAR, outline=RED, width=5)
            check_icon(d, x, RAIL_Y, 17, GOLD, CHAR)
        else:
            d.ellipse([x - r, RAIL_Y - r, x + r, RAIL_Y + r], fill=WHITE, outline=SILVER, width=4)
            d.text((x - text_w(d, str(i + 1), B) / 2, RAIL_Y - 19), str(i + 1), font=B, fill=GREY)
        lab = STAGES[i][1]; fl = font('600SemiBold', 17)
        d.text((x - text_w(d, lab, fl) / 2, RAIL_Y + 46), lab, font=fl, fill=CHAR if act else GREY)
    # feature card
    cards = [(-1.0, "ACE STATUS", "Running on autopilot", "While he relaxes in the hammock")]
    for e in EVENTS:
        if e[1] is None: cards.append((e[0], e[2], e[3], e[4]))
        else: cards.append((e[0], f"STAGE {e[1] + 1} \u00b7 ACTIVATED", STAGES[e[1]][0], STAGES[e[1]][2]))
    cards += [(FINAL_CARD_T, "ALL 8 RUNNING", "8 of 8 complete", "While he heads out with the boys")]
    cur = max(i for i, c in enumerate(cards) if t >= c[0])
    for idx in ([cur - 1] if cur > 0 else []) + [cur]:
        c = cards[idx]
        if idx == cur:
            k = ease((t - c[0]) / 0.38) if c[0] >= 0 else 1
            dx, alpha = (1 - k) * 120, k
        else:
            nxt = cards[cur][0]; k = ease((t - nxt) / 0.30)
            if k >= 1: continue
            dx, alpha = -k * 160, 1 - k
        draw_card(im, 60 + dx, BOTTOM_TOP + 300, c, alpha, t - max(c[0], 0), idx == len(cards) - 1)
    # progress bar
    d = ImageDraw.Draw(im)
    by = H - 175
    rrect(d, [60, by, W - 60, by + 22], 11, fill=(232, 224, 208))
    pw = (W - 120) * done / 8
    if pw > 0: rrect(d, [60, by, 60 + pw, by + 22], 11, fill=GOLD)
    d.text((60, by + 36), "Tasks handled by ACE today", font=SB_S, fill=GREY)
    return im

def draw_card(base, x, y, c, alpha, age, final):
    cw, ch = 960, 370
    layer = Image.new('RGBA', (cw + 80, ch + 80), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    sh = Image.new('RGBA', layer.size, (0, 0, 0, 0)); ImageDraw.Draw(sh).rounded_rectangle([40, 52, 40 + cw, 52 + ch], 30, fill=(90, 60, 10, 70))
    layer.alpha_composite(sh.filter(ImageFilter.GaussianBlur(16)))
    glow = 1 - clamp(age / 1.2)
    border = tuple(int(SILVER[i] * (1 - glow) + GOLD[i] * glow) for i in range(3)) if not final else GOLD
    rrect(d, [40, 40, 40 + cw, 40 + ch], 30, fill=WHITE, outline=border, width=4)
    rrect(d, [40, 40, 56, 40 + ch], 8, fill=RED)
    label, title, res = c[1], c[2], c[3]
    d.text((92, 86), label, font=B, fill=RED)
    lines = wrap(d, title, XB, 840)
    for i, ln in enumerate(lines[:2]):
        d.text((92, 140 + i * 68), ln, font=XB, fill=CHAR)
    ry = 140 + len(lines[:2]) * 68 + 38
    check_icon(d, 112, ry + 20, 20, GOLD, CHAR)
    d.text((148, ry), res, font=SB, fill=GREY)
    if alpha < 0.999:
        a = layer.getchannel('A').point(lambda v: int(v * alpha)); layer.putalpha(a)
    base.alpha_composite(layer, (int(x - 40), int(y - 40)))

# ---------------------------------------------------------------- part 2
# A camera flies forward down the workflow: nodes come toward the viewer and
# drift slightly downward as they pass; each lands with a heavy boom; GROWTH
# arrives last with an animated rising arrow in warm golden light.
P2_ITEMS = [st[0] for st in STAGES]
P2_RES = [st[2] for st in STAGES[:7]] + ["Your business, accelerating"]
FOC, SPACING, SPEED, FIRST_T = 900.0, 700.0, 875.0, 0.6
P2_HERO = [FIRST_T + i * SPACING / SPEED for i in range(8)]   # time each node arrives
P2_STEP = SPACING / SPEED
HORIZON_Y, NODE_Y = 700.0, 330.0
NODE_X = [-130 if i % 2 == 0 else 130 for i in range(7)] + [0]

def make_node_sprite(i, active):
    growth = i == 7
    bw, bh = (760, 240) if growth else (680, 190)
    im = Image.new('RGBA', (bw + 60, bh + 80), (0, 0, 0, 0))
    sh = Image.new('RGBA', im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([30, 44, 30 + bw, 44 + bh], 34, fill=(110, 70, 10, 90))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(14)))
    d = ImageDraw.Draw(im)
    box = [30, 30, 30 + bw, 30 + bh]
    if growth:
        rrect(d, box, 40, fill=CHAR, outline=GOLD if active else SILVER, width=7)
        col = GOLD_HI if active else GREY
        for txt, fsz, yy in (("COMPOUNDING EXPONENTIAL", 38, 22), ("GROWTH", 96, 66), ("AUTOPILOT", 38, 176)):
            f_ = font('900Black', fsz); d.text((30 + (bw - text_w(d, txt, f_)) / 2, 30 + yy), txt, font=f_, fill=col)
        return im
    rrect(d, box, 34, fill=CHAR if active else WHITE, outline=RED if active else SILVER, width=6)
    if active: check_icon(d, 30 + 78, 30 + bh / 2, 38, GOLD, CHAR)
    else: d.ellipse([30 + 40, 30 + bh / 2 - 38, 30 + 116, 30 + bh / 2 + 38], outline=SILVER, width=5)
    fnt = font('800ExtraBold', 42)
    ls = wrap(d, P2_ITEMS[i], fnt, bw - 180)
    for j, ln in enumerate(ls):
        d.text((30 + 150, 30 + bh / 2 - len(ls) * 25 + j * 50 - 4), ln, font=fnt, fill=WHITE if active else GREY)
    return im

NODE_SPR = [[make_node_sprite(i, False), make_node_sprite(i, True)] for i in range(8)]

def cam_z(t):
    lin_end = P2_HERO[7] - 0.6
    if t < lin_end: return SPEED * (t - FIRST_T)
    z0 = SPEED * (lin_end - FIRST_T); z1 = SPEED * (P2_HERO[7] - FIRST_T) + 120
    return z0 + (z1 - z0) * ease((t - lin_end) / ((z1 - z0) * 3 / SPEED))

def project(i, t):
    zr = FOC + i * SPACING - cam_z(t)
    sc = FOC / max(zr, 1)
    return W / 2 + NODE_X[i] * sc, HORIZON_Y + NODE_Y * sc, sc, zr

def growth_arrow(im, cx, cy, sc, k, t):
    """Rising zig-zag growth line with arrowhead, drawn progressively."""
    if k <= 0: return
    pts = [(-300, 120), (-170, 30), (-70, 75), (60, -60), (150, -20), (300, -230)]
    pts = [(cx + x * sc, cy + y * sc) for x, y in pts]
    seg = [math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    total, run = sum(seg) * k, 0.0
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    drawn = [pts[0]]
    for i, L in enumerate(seg):
        if run + L <= total: drawn.append(pts[i + 1]); run += L
        else:
            f_ = (total - run) / L
            drawn.append((pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f_, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f_)); break
    wdt = max(6, int(26 * sc))
    d.line(drawn, fill=GOLD_HI + (255,), width=wdt, joint='curve')
    hx, hy = drawn[-1]; px, py = drawn[-2]
    ang = math.atan2(hy - py, hx - px); L = 70 * sc
    tip = (hx + math.cos(ang) * L * 0.6, hy + math.sin(ang) * L * 0.6)
    left = (hx + math.cos(ang + 2.5) * L * 0.75, hy + math.sin(ang + 2.5) * L * 0.75)
    right = (hx + math.cos(ang - 2.5) * L * 0.75, hy + math.sin(ang - 2.5) * L * 0.75)
    d.polygon([tip, left, right], fill=GOLD_HI + (255,))
    glow = lay.filter(ImageFilter.GaussianBlur(18))
    im.alpha_composite(glow); im.alpha_composite(glow); im.alpha_composite(lay)

def part2(t):
    im = P2_BG.copy(); d = ImageDraw.Draw(im)
    tt = "THE ACE WORKFLOW"; d.text(((W - text_w(d, tt, BLACK)) / 2, 120), tt, font=BLACK, fill=CHAR)
    st = "Running your business while you live your life"; d.text(((W - text_w(d, st, SB)) / 2, 210), st, font=SB, fill=GREY)
    P = [project(i, t) for i in range(8)]
    # path: grey track + gold current up to the spark
    for i in range(7):
        a_, b_ = P[i], P[i + 1]
        if a_[3] < 520 or b_[3] < 520: continue
        d.line([(a_[0], a_[1]), (b_[0], b_[1])], fill=(222, 212, 192), width=max(3, int(16 * min(a_[2], 1.4))))
    spark = None
    for i in range(7):
        t0, t1_ = P2_HERO[i], P2_HERO[i + 1]
        if t < t0: break
        f_ = clamp((t - t0) / (t1_ - t0 - 0.1))
        a_, b_ = P[i], P[i + 1]
        if a_[3] < 520: continue
        e = (a_[0] + (b_[0] - a_[0]) * f_, a_[1] + (b_[1] - a_[1]) * f_)
        d.line([(a_[0], a_[1]), e], fill=GOLD, width=max(4, int(16 * min(a_[2], 1.4))))
        if f_ < 1: spark = (e, a_[2])
    # nodes, far to near
    for i in sorted(range(8), key=lambda i: -P[i][3]):
        x, y, sc, zr = P[i]
        if zr < 520 or sc < 0.12: continue
        act = t >= P2_HERO[i] - 0.12
        alpha = clamp((sc - 0.12) / 0.35) * clamp((zr - 520) / 260)
        if act:
            age = t - P2_HERO[i]
            paste_alpha(im, BIG_HALO if i == 7 else HALO, x, y, alpha * ((1.0 if i == 7 else 0.8) + 0.4 * max(0, 1 - age / 0.5)))
        spr = NODE_SPR[i][1 if act else 0]
        land = 1 + (0.10 * max(0, 1 - (t - P2_HERO[i]) / 0.25) if act and t - P2_HERO[i] < 0.25 else 0)
        s2 = sc * 0.98 * land
        sw, sh_ = max(2, int(spr.width * s2)), max(2, int(spr.height * s2))
        sp = spr.resize((sw, sh_), Image.BILINEAR)
        if alpha < 0.999:
            al = sp.getchannel('A').point(lambda v: int(v * alpha)); sp.putalpha(al)
        im.alpha_composite(sp, (int(x - sw / 2), int(y - sh_ / 2)))
        if act and i < 7 and sc > 0.55:
            d = ImageDraw.Draw(im); f2 = font('600SemiBold', max(12, int(30 * sc)))
            rs = P2_RES[i]; d.text((x - text_w(d, rs, f2) / 2, y + sh_ / 2 - 6 * sc), rs, font=f2, fill=tuple(int(IVORY[c] * (1 - alpha) + GREY[c] * alpha) for c in range(3)))
    if spark:
        (sx, sy), ssc = spark
        paste_alpha(im, SPARK, sx, sy, 1); paste_alpha(im, SPARK_CORE, sx, sy, 1)
    # GROWTH arrow + caption
    gx, gy, gsc, gzr = P[7]
    if t >= P2_HERO[7] - 0.1:
        growth_arrow(im, gx, gy - 230 * gsc, gsc, ease((t - P2_HERO[7]) / 1.1), t)
        d = ImageDraw.Draw(im); rs = P2_RES[7]
        k = ease((t - P2_HERO[7] - 0.6) / 0.5)
        if k > 0: d.text(((W - text_w(d, rs, SB)) / 2, gy + 150 * gsc), rs, font=SB, fill=tuple(int(IVORY[c] * (1 - k) + CHAR[c] * k) for c in range(3)))
    a_in = ease(t / 0.4)
    if a_in < 1: im = Image.blend(Image.new('RGBA', (W, H), (255, 255, 255, 255)), im, a_in)
    return im

# ---------------------------------------------------------------- part 3
def part3(t):
    im = P3_BG.copy()
    k = ease(t / 0.9)
    s = int(640 * (0.88 + 0.12 * k))
    lg = logo.resize((s, s), Image.LANCZOS); mk = logo_mask.resize((s, s), Image.LANCZOS).point(lambda v: int(v * k))
    im.paste(lg, (int((W - s) / 2), int(640 - s / 2)), mk)
    d = ImageDraw.Draw(im)
    tk = ease((t - 1.50) / 0.6)
    if tk > 0:
        lines = ["Stop paying the price", "for not automating."]
        for i, ln in enumerate(lines):
            col = tuple(int(255 * tk) for _ in range(3))
            d.text(((W - text_w(d, ln, BLACK)) / 2, 1000 + i * 84 + (1 - tk) * 30), ln, font=BLACK, fill=col)
    ck = ease((t - 5.36) / 0.45)
    if ck > 0:
        cy = 1470
        paste_alpha(im, BIG_HALO, W / 2, cy, 0.45 * ck); d = ImageDraw.Draw(im)
        head = 'Type "AUTOMATE"'; hf = font('900Black', 74)
        d.text(((W - text_w(d, head, hf)) / 2, cy - 150), head, font=hf, fill=tuple(int(255 * ck) for _ in range(3)))
        # comment box the viewer types into: no button, just the word appearing
        bw = 820; bx = (W - bw) / 2; by_ = cy - 20
        rrect(d, [bx, by_, bx + bw, by_ + 110], 55, fill=tuple(int(v * ck) for v in (34, 34, 38)), outline=tuple(int(v * ck) for v in SILVER), width=3)
        bub = [bx + 34, by_ + 30, bx + 84, by_ + 74]; d.rounded_rectangle(bub, 14, outline=tuple(int(v * ck) for v in SILVER), width=4)
        d.polygon([(bx + 46, by_ + 72), (bx + 46, by_ + 88), (bx + 62, by_ + 72)], fill=tuple(int(v * ck) for v in SILVER))
        word = "AUTOMATE"; n = int(clamp((t - 5.75) / 1.1) * len(word) + 0.0001)
        tf = font('800ExtraBold', 54)
        typed = word[:n]
        if n == 0: d.text((bx + 112, by_ + 26), "Add a comment...", font=SB, fill=tuple(int(v * ck) for v in GREY))
        else: d.text((bx + 112, by_ + 22), typed, font=tf, fill=GOLD_HI)
        if int(t * 2.2) % 2 == 0:
            cx_ = bx + 112 + (text_w(d, typed, tf) if n else 0) + 6
            d.rectangle([cx_, by_ + 26, cx_ + 5, by_ + 84], fill=WHITE)
        sub = "for a free demo"; d.text(((W - text_w(d, sub, SB)) / 2, by_ + 150), sub, font=SB, fill=tuple(int(c * ck) for c in SILVER))
    fade_in = ease(t / 0.35)
    if fade_in < 1: im = Image.blend(Image.new('RGBA', (W, H), (0, 0, 0, 255)), im, fade_in)
    return im

def frame_at(t):
    if t < T1:
        im = part1(t)
        if t > T1 - 0.25: im = Image.blend(im, Image.new('RGBA', (W, H), (255, 255, 255, 255)), ease((t - (T1 - 0.25)) / 0.25))
        return im
    if t < T2:
        im = part2(t - T1)
        if t > T2 - 0.3: im = Image.blend(im, Image.new('RGBA', (W, H), (0, 0, 0, 255)), ease((t - (T2 - 0.3)) / 0.3))
        return im
    return part3(t - T2)

# ---------------------------------------------------------------- audio
SR = 44100
def lowpass(x, cutoff):
    a_ = math.exp(-2 * math.pi * cutoff / SR); y = np.zeros_like(x); acc = 0.0
    for i_ in range(len(x)): acc = (1 - a_) * x[i_] + a_ * acc; y[i_] = acc
    return y
def heavy_boom(dur=1.4, depth=1.0):
    """A massive package landing: deep body thump with a pitch drop, a muffled
    impact transient and a short sub rumble. No crackle, no explosion."""
    n = int(SR * dur); tt = np.arange(n) / SR
    f = 34 + 38 * np.exp(-tt * 9)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * (1 - np.exp(-tt * 400)) * np.exp(-tt * 3.2)
    sub = np.sin(2 * np.pi * 27 * tt) * np.exp(-tt * 2.0) * 0.45
    rng = np.random.default_rng(7)
    hit = lowpass(rng.normal(0, 1, n) * np.exp(-tt * 45), 180) * 2.2
    thud = lowpass(rng.normal(0, 1, n) * np.exp(-tt * 12), 90) * 1.4
    s_ = (body + sub + hit + thud) * depth
    return s_ / np.max(np.abs(s_))
def air_fall(dur=0.45):
    n = int(SR * dur); tt = np.arange(n) / SR
    nz = np.random.default_rng(3).normal(0, 1, n)
    return lowpass(nz, 500) * (tt / dur) ** 2 * 0.25
def riser(dur):
    n = int(SR * dur); tt = np.arange(n) / SR
    f = 60 + 90 * (tt / dur) ** 2
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * (tt / dur) ** 1.5 * 0.25

def build_audio():
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', D + VOICE_FILE, '-ac', '1', '-ar', str(SR), D + 'voice.wav'], check=True)
    with wave.open(D + 'voice.wav') as w_: v = np.frombuffer(w_.readframes(w_.getnframes()), np.int16).astype(float) / 32768
    v = v / max(np.max(np.abs(v)), 1e-9) * 0.9
    total = np.zeros(int(SR * (TOTAL + 0.5)))
    a = v[:int(T1 * SR)]; total[:len(a)] += a
    b = v[int(T1 * SR):]; o = int(T2 * SR); total[o:o + len(b)] += b
    bm_small = heavy_boom(1.1); bm = heavy_boom(1.5); bm_big = heavy_boom(2.4, 1.0); fall = air_fall()
    def add(sig, at, g):
        o = int(at * SR)
        if o < 0: sig, o = sig[-o:], 0
        total[o:o + len(sig)] += sig[:len(total) - o] * g
    for n in NODES: add(bm_small, n[0], 0.30)
    add(riser(P2 - 0.6), T1 + 0.2, 0.5)
    for i in range(8):
        add(fall, T1 + P2_HERO[i] - 0.45, 0.6)
        add(bm_big if i == 7 else bm, T1 + P2_HERO[i], 0.85 if i == 7 else 0.6)
    add(bm_big, T2 + 0.05, 0.55)
    peak = np.max(np.abs(total)); total = total / max(peak, 1e-9) * 0.95
    with wave.open(D + 'mix.wav', 'wb') as w_:
        w_.setnchannels(1); w_.setsampwidth(2); w_.setframerate(SR)
        w_.writeframes((total * 32767).astype(np.int16).tobytes())

if __name__ == '__main__':
    if len(sys.argv) > 2 and sys.argv[1] == '--preview':
        for s in sys.argv[2].split(','):
            frame_at(float(s)).convert('RGB').save(D + f'prev_{s}.jpg', quality=88)
        sys.exit()
    build_audio()
    out = D + OUT_NAME
    p = subprocess.Popen(['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                          '-i', D + 'mix.wav', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p',
                          '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], stdin=subprocess.PIPE)
    nf = int(TOTAL * FPS)
    for i in range(nf):
        p.stdin.write(frame_at(i / FPS).convert('RGB').tobytes())
        if i % 150 == 0: print(f'{i}/{nf}', flush=True)
    p.stdin.close(); p.wait(); print('done', out)
