"""Generate splash-icon.png from logo.png for Expo splash screen."""
from PIL import Image
import os

logo_path = r"F:\Study\Do An\Git\LuxeWash_Mobile_FE\assets\images\logo.png"
out_path = r"F:\Study\Do An\Git\LuxeWash_Mobile_FE\assets\images\splash-icon.png"

# Splash screen image should be large enough for various device resolutions
# Standard size: 1242x2436 (iPhone X) but we can use similar
# Common Expo recommendation: 1284x2778 or larger
# Logo aspect ratio: 1165/1218 = 0.957

logo = Image.open(logo_path).convert("RGBA")
print(f"Logo size: {logo.size}")

# Target: 1024x1024 with logo centered (contain mode means padding)
# Or match Expo default: 1284x2778 (aspect ~ 0.46 portrait)
# Since logo is square-ish, use square canvas
target_size = 1024

# Resize logo to fit within target_size, keeping aspect ratio
logo_w, logo_h = logo.size
ratio = min(target_size / logo_w, target_size / logo_h)
new_w = int(logo_w * ratio)
new_h = int(logo_h * ratio)
logo_resized = logo.resize((new_w, new_h), Image.LANCZOS)
print(f"Resized logo: {logo_resized.size}")

# Create canvas with transparent background
canvas = Image.new("RGBA", (target_size, target_size), (0, 0, 0, 0))

# Center the logo
x = (target_size - new_w) // 2
y = (target_size - new_h) // 2
canvas.paste(logo_resized, (x, y), logo_resized)

canvas.save(out_path, "PNG")
print(f"Saved splash-icon.png: {canvas.size}")

# Also generate other Expo icons from logo
icon_path = r"F:\Study\Do An\Git\LuxeWash_Mobile_FE\assets\images\icon.png"
icon = Image.open(logo_path).convert("RGBA")
icon_w, icon_h = icon.size
icon_size = 1024
ratio = min(icon_size / icon_w, icon_size / icon_h)
new_w = int(icon_w * ratio)
new_h = int(icon_h * ratio)
icon_resized = icon.resize((new_w, new_h), Image.LANCZOS)
icon_canvas = Image.new("RGBA", (icon_size, icon_size), (0, 0, 0, 0))
x = (icon_size - new_w) // 2
y = (icon_size - new_h) // 2
icon_canvas.paste(icon_resized, (x, y), icon_resized)
icon_canvas.save(icon_path, "PNG")
print(f"Saved icon.png: {icon_canvas.size}")

# Android foreground: 432x432 (108dp at xxxhdpi)
fg_path = r"F:\Study\Do An\Git\LuxeWash_Mobile_FE\assets\images\android-icon-foreground.png"
fg_size = 432
ratio = min(fg_size / logo_w, fg_size / logo_h)
new_w = int(logo_w * ratio)
new_h = int(logo_h * ratio)
fg_resized = logo.resize((new_w, new_h), Image.LANCZOS)
fg_canvas = Image.new("RGBA", (fg_size, fg_size), (0, 0, 0, 0))
x = (fg_size - new_w) // 2
y = (fg_size - new_h) // 2
fg_canvas.paste(fg_resized, (x, y), fg_resized)
fg_canvas.save(fg_path, "PNG")
print(f"Saved android-icon-foreground.png: {fg_canvas.size}")

# Android monochrome: same as foreground but white
mono_path = r"F:\Study\Do An\Git\LuxeWash_Mobile_FE\assets\images\android-icon-monochrome.png"
mono_resized = logo.resize((new_w, new_h), Image.LANCZOS)
mono_canvas = Image.new("RGBA", (fg_size, fg_size), (0, 0, 0, 0))
x = (fg_size - new_w) // 2
y = (fg_size - new_h) // 2
mono_canvas.paste(mono_resized, (x, y), mono_resized)
mono_canvas.save(mono_path, "PNG")
print(f"Saved android-icon-monochrome.png: {mono_canvas.size}")

# Favicon
fav_path = r"F:\Study\Do An\Git\LuxeWash_Mobile_FE\assets\images\favicon.png"
fav_size = 48
ratio = min(fav_size / logo_w, fav_size / logo_h)
new_w = int(logo_w * ratio)
new_h = int(logo_h * ratio)
fav_resized = logo.resize((new_w, new_h), Image.LANCZOS)
fav_canvas = Image.new("RGBA", (fav_size, fav_size), (0, 0, 0, 0))
x = (fav_size - new_w) // 2
y = (fav_size - new_h) // 2
fav_canvas.paste(fav_resized, (x, y), fav_resized)
fav_canvas.save(fav_path, "PNG")
print(f"Saved favicon.png: {fav_canvas.size}")

# Background (use solid color or pattern)
bg_path = r"F:\Study\Do An\Git\LuxeWash_Mobile_FE\assets\images\android-icon-background.png"
bg_canvas = Image.new("RGB", (432, 432), (2, 116, 223))  # #0274DF
bg_canvas.save(bg_path, "PNG")
print(f"Saved android-icon-background.png: {bg_canvas.size}")

print("\nAll icons generated!")