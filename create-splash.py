"""Create splash replacement image that matches res/S7.png dimensions."""
from PIL import Image
import zipfile

# Read original splash to get its dimensions
src_apk = r'F:\luxewash_real\android\app\build\outputs\apk\release\app-release.apk'
with zipfile.ZipFile(src_apk) as z:
    data = z.read('res/S7.png')
    orig = Image.open(z.open('res/S7.png'))
    print(f'Original res/S7.png: size={orig.size}, mode={orig.mode}')

# Logo dimensions
logo_path = r'F:\Study\Do An\Git\LuxeWash_Mobile_FE\assets\images\logo.png'
logo = Image.open(logo_path).convert("RGBA")
print(f'Logo size: {logo.size}')

# Create splash replacement: same size as original (1242x...)
# Resize logo to fit (with white space around for proper centering)
target_w, target_h = orig.size
print(f'Target size: {target_w}x{target_h}')

# Create canvas with brand blue background
canvas = Image.new("RGBA", (target_w, target_h), (2, 116, 223, 255))  # #0274DF

# Resize logo to fit ~50% of canvas
logo_w, logo_h = logo.size
target_logo_size = int(target_w * 0.5)
ratio = min(target_logo_size / logo_w, target_logo_size / logo_h)
new_w = int(logo_w * ratio)
new_h = int(logo_h * ratio)
logo_resized = logo.resize((new_w, new_h), Image.LANCZOS)

# Center
x = (target_w - new_w) // 2
y = (target_h - new_h) // 2
canvas.paste(logo_resized, (x, y), logo_resized)

# Save as PNG
canvas.convert("RGB").save(r'F:\luxewash_real\splash-replacement.png', "PNG")
print(f'Saved splash replacement: {canvas.size}')

# Verify size matches
new_data = open(r'F:\luxewash_real\splash-replacement.png', 'rb').read()
print(f'Original: {len(data)} bytes, New: {len(new_data)} bytes')