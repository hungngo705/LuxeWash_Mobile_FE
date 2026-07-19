import os
import sys
import shutil
import zipfile
import subprocess
import tempfile
import logging

# Suppress androguard debug logs
logging.disable(logging.DEBUG)
logging.getLogger("androguard").setLevel(logging.WARNING)
for name in list(logging.root.manager.loggerDict):
    logging.getLogger(name).setLevel(logging.WARNING)

from androguard.core.apk import APK

# Paths
src_apk = r"F:\luxewash_real\android\app\build\outputs\apk\release\app-release.apk"
out_dir = r"F:\Study\Do An\Git\LuxeWash_Mobile_FE\android\app\build\outputs\apk\release"
out_apk = os.path.join(out_dir, "app-release.apk")
assets_dir = r"F:\Study\Do An\Git\LuxeWash_Mobile_FE\assets\images"
bundle_src = r"F:\Study\Do An\Git\LuxeWash_Mobile_FE\android\app\build\generated\assets\createBundleReleaseJsAndAssets"
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

# Files to inject/replace in APK (path in APK -> source path)
# None means the file is special (resources.arsc - will be patched inline)
new_files = {
    "assets/index.android.bundle": os.path.join(bundle_src, "index.android.bundle"),
    "resources.arsc": None,
    "res/S7.png": r"F:\luxewash_real\splash-replacement.png",
}

for f in os.listdir(assets_dir):
    asset_path = os.path.join(assets_dir, f)
    if os.path.isfile(asset_path):
        new_files[f"assets/{f}"] = asset_path

files_to_replace = set(new_files.keys())

# Read and patch resources.arsc
with zipfile.ZipFile(src_apk, 'r') as src_zip:
    arsc_info = src_zip.getinfo("resources.arsc")
    arsc_data = src_zip.read("resources.arsc")

old_label = "LuxeWash_Mobile_FE"
old_bytes = old_label.encode('utf-8')

# IMPORTANT: For resources.arsc string pool, we MUST preserve byte length
# Otherwise pool offsets break. The string is null-terminated in the pool.
new_label_padded = NEW_LABEL + "\x00" * (len(old_bytes) - len(NEW_LABEL.encode('utf-8')))
new_bytes = new_label_padded.encode('utf-8')

count = arsc_data.count(old_bytes)
print(f"Found {count} occurrences of {old_label!r} in resources.arsc")
new_arsc = arsc_data.replace(old_bytes, new_bytes)

# Build new APK
temp_dir = tempfile.mkdtemp()
new_unsigned = os.path.join(temp_dir, "new-unsigned.apk")

print("\nRebuilding APK...")
with zipfile.ZipFile(src_apk, 'r') as src_zip:
    with zipfile.ZipFile(new_unsigned, 'w', zipfile.ZIP_STORED) as dst_zip:
        for item in src_zip.infolist():
            if item.filename in files_to_replace:
                continue
            # Preserve original compression type
            new_info = zipfile.ZipInfo(item.filename)
            new_info.compress_type = item.compress_type
            new_info.date_time = item.date_time
            new_info.external_attr = item.external_attr
            new_info.create_system = item.create_system
            data = src_zip.read(item.filename)
            dst_zip.writestr(new_info, data)

# Add patched resources.arsc with original info
print("Adding patched resources.arsc...")
with zipfile.ZipFile(new_unsigned, 'a', zipfile.ZIP_STORED) as dst_zip:
    new_info = zipfile.ZipInfo(arsc_info.filename)
    new_info.compress_type = arsc_info.compress_type
    new_info.date_time = arsc_info.date_time
    new_info.external_attr = arsc_info.external_attr
    new_info.create_system = arsc_info.create_system
    dst_zip.writestr(new_info, new_arsc)

# Add new/replaced asset files
print("\nAdding new files:")
with zipfile.ZipFile(new_unsigned, 'a', zipfile.ZIP_STORED) as dst_zip:
    for apk_path, src_path in new_files.items():
        if src_path is None:
            continue
        if not os.path.exists(src_path):
            continue
        # Preserve original compression if exists in source
        with zipfile.ZipFile(src_apk, 'r') as sz:
            try:
                orig_info = sz.getinfo(apk_path)
                compress_type = orig_info.compress_type
            except KeyError:
                # Default: .so and resources.arsc are STORED
                is_native = apk_path.endswith('.so') or apk_path == 'resources.arsc'
                compress_type = zipfile.ZIP_STORED if is_native else zipfile.ZIP_DEFLATED
        with open(src_path, 'rb') as f:
            data = f.read()
        zi = zipfile.ZipInfo(apk_path)
        zi.compress_type = compress_type
        dst_zip.writestr(zi, data)
        print(f"  + {apk_path} ({len(data)/1024:.1f} KB)")

unsigned_size = os.path.getsize(new_unsigned)
print(f"\nUnsigned APK: {unsigned_size/1024/1024:.2f} MB")

# Zipalign
aligned = os.path.join(temp_dir, "aligned.apk")
print("Running zipalign...")
result = subprocess.run([zipalign, "-f", "4", new_unsigned, aligned], capture_output=True, text=True)
if result.returncode == 0:
    print("zipalign completed")
else:
    print(f"zipalign warning: {result.stderr}")

# Sign APK
signed = os.path.join(temp_dir, "signed.apk")
print("Signing APK...")
result = subprocess.run([
    apksigner, "sign",
    "--ks", keystore,
    "--ks-pass", f"pass:{keystore_pass}",
    "--ks-key-alias", key_alias,
    "--key-pass", f"pass:{key_pass}",
    "--out", signed,
    aligned
], capture_output=True, text=True)

if result.returncode == 0:
    print("APK signed successfully!")
    os.makedirs(out_dir, exist_ok=True)
    shutil.copy2(signed, out_apk)
    print(f"Output APK: {out_apk}")
else:
    print(f"apksigner error: {result.stderr}")
    shutil.copy2(aligned, out_apk)

shutil.rmtree(temp_dir)

# Verify
print("\n=== Verification ===")
a2 = APK(out_apk)
print(f"New app name: {a2.get_app_name()!r}")

with zipfile.ZipFile(src_apk) as z1:
    src_count = len(z1.namelist())
with zipfile.ZipFile(out_apk) as z2:
    cur_count = len(z2.namelist())
print(f"Source files: {src_count}, New APK files: {cur_count}")
if src_count == cur_count:
    print("PASS: All files preserved")
else:
    missing = set(z1.namelist()) - set(z2.namelist())
    print(f"Missing: {len(missing)}")
    for m in sorted(missing)[:10]:
        print(f"  {m}")

# Check that resources.arsc only appears once
with zipfile.ZipFile(out_apk) as z2:
    arsc_count = sum(1 for n in z2.namelist() if n == 'resources.arsc')
print(f"resources.arsc entries: {arsc_count} (should be 1)")

print("\nDone!")