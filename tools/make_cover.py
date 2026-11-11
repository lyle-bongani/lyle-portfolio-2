"""Builds the LinkedIn cover (1920x1080) and the link-preview image (1200x627) from real frames of the site.
  python tools/make_cover.py <earth.jpg> <saturn.jpg> <galaxy.jpg>
"""
import sys
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter

earth, saturn, galaxy = sys.argv[1:4]
FONTS = "C:/Windows/Fonts/"


def load_clean(path):
    """A browser screenshot, with the screenshot tool's mouse pointer and corner button painted out."""
    img = cv2.imread(path)
    mask = np.zeros(img.shape[:2], np.uint8)
    mask[272:312, 628:668] = 255          # mouse pointer sits in the middle of every capture
    mask[446:490, 1234:1276] = 255        # extension button, bottom right
    img = cv2.inpaint(img, mask, 6, cv2.INPAINT_TELEA)
    return Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))


def cover(img, W, H, focus=0.5):
    """Scale to fill W x H, cropping the sides; `focus` picks which part of the width to keep."""
    s = max(W / img.width, H / img.height)
    big = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    x0 = round((big.width - W) * focus)
    y0 = (big.height - H) // 2
    return big.crop((x0, y0, x0 + W, y0 + H))


def font(name, size):
    return ImageFont.truetype(FONTS + name, size)


def compose(bg, W, H, focus, out, title_lines, kicker, sub, url):
    base = cover(bg, W, H, focus).convert("RGB")
    if W > 1400:  # upscaled frames look soft: sharpen a touch and add fine grain so it reads as film, not blur
        base = base.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
        g = np.random.default_rng(3).normal(0, 3.2, (H, W, 1)).astype(np.float32)
        base = Image.fromarray(np.clip(np.asarray(base).astype(np.float32) + g, 0, 255).astype(np.uint8))
    # darken the left so the words stay readable over bright planets
    grad = np.linspace(0, 1, W, dtype=np.float32)
    shade = np.clip(1 - (grad / 0.66) ** 1.35, 0, 1) * 0.9
    a = np.asarray(base).astype(np.float32) * (1 - shade[None, :, None])
    base = Image.fromarray(a.astype(np.uint8))
    d = ImageDraw.Draw(base)
    u = H / 627  # everything sizes from the image height

    x = round(64 * u)
    y = round(88 * u)
    red = (255, 84, 64)
    d.line([(x, y + 14 * u), (x + 58 * u, y + 14 * u)], fill=red, width=max(2, round(3 * u)))
    d.text((x + 76 * u, y), kicker, font=font("segoeuisb.ttf" if False else "seguisb.ttf", round(21 * u)), fill=(230, 226, 220))
    ty = y + 62 * u
    f_title = font("segoeuisl.ttf", round(66 * u))
    for line in title_lines:
        d.text((x, ty), line, font=f_title, fill=(246, 243, 238))
        ty += 76 * u
    d.text((x, ty + 22 * u), sub, font=font("segoeuil.ttf", round(26 * u)), fill=(206, 200, 194))
    d.text((x, H - 72 * u), url, font=font("seguisb.ttf", round(27 * u)), fill=(255, 255, 255))
    base.save(out, quality=92, subsampling=0)
    print("saved", out, base.size)


title = ["A portfolio that", "crosses the", "solar system"]
kicker = "LYLE CHADYA"
sub = "Scroll-driven 3D, built with Three.js and Blender"
url = "2.lyle-portfolio.dev"

compose(load_clean(saturn), 1200, 627, 0.62, "public/og-image.jpg", title, kicker, sub, url)          # link preview (LinkedIn, X, chat apps)
compose(load_clean(saturn), 1280, 720, 0.62, "linkedin/cover-1280x720.jpg", title, kicker, sub, url)       # article cover, 16:9
