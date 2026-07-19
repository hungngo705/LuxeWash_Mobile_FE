import os
import sys
import shutil
import zipfile
import subprocess
import tempfile
from androguard.core.apk import APK

# Paths
src_apk = r"F:\luxewash_real\android\app\build\outputs\apk\release\app-release.apk"
out_apk = r"F:\Study\Do An\Git\LuxeWash_Mobile_FE\android\app\build\outputs\apk\release\app-release.apk"
keystore = r"F:\Study\Do An\Git\LuxeWash_Mobile_FE\android\app\release.keystore"
keystore_pass = "LuxeWash2026!"
key_alias = "luxewash-release"
key_pass = "LuxeWash2026!"
zipalign = r"C:\Users\Hung Ngo\AppData\Local\Android\Sdk\build-tools\35.0.0\zipalign.exe"
apksigner = r"C:\Users\Hung Ngo\AppData\Local\Android\Sdk\build-tools\35.0.0\apksigner.bat"

NEW_LABEL = "LuxeWash"

# Verify current label
print(f"Reading APK: {src_apk}")
a = APK(src_apk)
print(f"Current app name: {a.get_app_name()!r}")
print(f"Current package: {a.get_package()!r}")

# Strategy: Modify resources.arsc directly by patching the binary
# But resources.arsc uses a complex format. Instead, let's try:
# 1. Decompile APK with apktool-like logic
# 2. Modify strings.xml
# 3. Repackage

# Actually simpler: use androguard to modify and rebuild, or use apktool
# Let's try with apktool if available

# Check apktool
import subprocess as sp
apktool_check = sp.run(["where", "apktool"], capture_output=True, text=True)
print(f"apktool check: {apktool_check.stdout.strip() or 'not found'}")

# Alternative: use androguard's APK with set_app_name won't work since it's read-only
# We'll need to:
# 1. Extract APK
# 2. Decode resources.arsc using androguard's AXMLPrinter/etc
# 3. Modify and re-pack

# Easier approach: use aapt2 modify --rename-manifest-package won't help
# Let's try using aapt2 with --rename-resources-package

# Most reliable: manually patch the resources.arsc binary string
# The label "LuxeWash_Mobile_FE" is stored as a string in the string pool
# We need to find and replace it. But it must be exactly the same length
# unless we rebuild the entire string pool.

# Check lengths:
old_label = a.get_app_name()
print(f"\nOld label: {old_label!r} ({len(old_label.encode('utf-8'))} bytes UTF-8)")
new_label = NEW_LABEL
print(f"New label: {new_label!r} ({len(new_label.encode('utf-8'))} bytes UTF-8)")
print(f"Difference: {len(old_label.encode('utf-8')) - len(new_label.encode('utf-8'))} bytes")

# Pad new label to same length for safe replacement
if len(new_label) < len(old_label):
    new_label_padded = new_label + "\x00" * (len(old_label.encode('utf-8')) - len(new_label.encode('utf-8')))
else:
    new_label_padded = new_label

print(f"Padded label length: {len(new_label_padded.encode('utf-8'))} bytes")

# Now patch the APK
temp_dir = tempfile.mkdtemp()
print(f"\nTemp dir: {temp_dir}")

# Extract APK
extract_dir = os.path.join(temp_dir, "extracted")
os.makedirs(extract_dir)
with zipfile.ZipFile(src_apk, 'r') as z:
    z.extractall(extract_dir)
print("APK extracted")

# Patch resources.arsc
arsc_path = os.path.join(extract_dir, "resources.arsc")
with open(arsc_path, 'rb') as f:
    arsc_data = bytearray(f.read())

# Find and replace old label in UTF-8
old_label_bytes = old_label.encode('utf-8')
new_label_padded_bytes = new_label_padded.encode('utf-8')

count = arsc_data.count(old_label_bytes)
print(f"\nFound {count} occurrences of {old_label!r} in resources.arsc")

if count > 0:
    # Replace all occurrences
    new_data = bytes(arsc_data).replace(old_label_bytes, new_label_padded_bytes)
    with open(arsc_path, 'wb') as f:
        f.write(new_data)
    print(f"Replaced {count} occurrences with padded {new_label!r}")
else:
    print("WARNING: Old label not found in resources.arsc, trying string.xml approach...")

# Also check AndroidManifest.xml
manifest_path = os.path.join(extract_dir, "AndroidManifest.xml")
# Manifest is in binary format, but the app label comes from @string/app_name
# which is in resources.arsc

# Remove META-INF to allow re-signing
meta_inf = os.path.join(extract_dir, "META-INF")
if os.path.exists(meta_inf):
    shutil.rmtree(meta_inf)
    print("Removed old signatures")

# Repackage APK
unsigned_apk = os.path.join(temp_dir, "unsigned.apk")
print("\nCreating new APK...")
with zipfile.ZipFile(unsigned_apk, 'w', zipfile.ZIP_STORED) as z:
    for root, dirs, files in os.walk(extract_dir):
        for file in files:
            file_path = os.path.join(root, file)
            arcname = os.path.relpath(file_path, extract_dir)
            # Store .so and resources.arsc uncompressed
            is_native = file.endswith('.so') or file == 'resources.arsc'
            compress_type = zipfile.ZIP_STORED if is_native else zipfile.ZIP_DEFLATED
            z.write(file_path, arcname, compress_type=compress_type)

unsigned_size = os.path.getsize(unsigned_apk)
print(f"Unsigned APK: {unsigned_size/1024/1024:.2f} MB")

# Zipalign
aligned_apk = os.path.join(temp_dir, "aligned.apk")
result = sp.run([zipalign, "-f", "4", unsigned_apk, aligned_apk], capture_output=True, text=True)
if result.returncode == 0:
    print("zipalign completed")
else:
    print(f"zipalign warning: {result.stderr}")

# Sign APK
signed_apk = os.path.join(temp_dir, "signed.apk")
result = sp.run([
    apksigner, "sign",
    "--ks", keystore,
    "--ks-pass", f"pass:{keystore_pass}",
    "--ks-key-alias", key_alias,
    "--key-pass", f"pass:{key_pass}",
    "--out", signed_apk,
    aligned_apk
], capture_output=True, text=True)

if result.returncode == 0:
    print("APK signed successfully!")
    os.makedirs(os.path.dirname(out_apk), exist_ok=True)
    shutil.copy2(signed_apk, out_apk)
    print(f"Output APK: {out_apk}")
else:
    print(f"apksigner error: {result.stderr}")

# Verify
print("\n=== Verifying new APK ===")
a2 = APK(out_apk)
print(f"New app name: {a2.get_app_name()!r}")

shutil.rmtree(temp_dir)
print("Done!")