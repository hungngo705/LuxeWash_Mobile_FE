import os
import shutil
import zipfile
import subprocess
import tempfile

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

# Create output directory
os.makedirs(out_dir, exist_ok=True)

# Create temp directory
temp_dir = tempfile.mkdtemp()
print(f"Using temp dir: {temp_dir}")

# Extract APK
extract_dir = os.path.join(temp_dir, "extracted")
os.makedirs(extract_dir)
print(f"Extracting APK...")
with zipfile.ZipFile(src_apk, 'r') as zip_ref:
    zip_ref.extractall(extract_dir)

# Replace JS bundle
bundle_src_path = os.path.join(bundle_src, "index.android.bundle")
bundle_dest_path = os.path.join(extract_dir, "assets", "index.android.bundle")
if os.path.exists(bundle_src_path):
    if os.path.exists(bundle_dest_path):
        os.remove(bundle_dest_path)
    shutil.copy2(bundle_src_path, bundle_dest_path)
    bundle_size = os.path.getsize(bundle_dest_path)
    print(f"Replaced JS bundle: {bundle_size/1024/1024:.2f} MB")
else:
    print(f"WARNING: Bundle not found at {bundle_src_path}")

# Copy logo assets to assets folder
assets_extract_dir = os.path.join(extract_dir, "assets")
for item in os.listdir(assets_dir):
    src_path = os.path.join(assets_dir, item)
    dest_path = os.path.join(assets_extract_dir, item)
    if os.path.isfile(src_path):
        shutil.copy2(src_path, dest_path)
        print(f"Copied asset: {item}")

# Remove META-INF to allow re-signing
meta_inf = os.path.join(extract_dir, "META-INF")
if os.path.exists(meta_inf):
    shutil.rmtree(meta_inf)
    print("Removed old signatures")

# Create new unsigned APK
# Native libs (.so) and resources.arsc must be stored uncompressed for Android 11+
unsigned_apk = os.path.join(temp_dir, "unsigned.apk")
print("Creating new APK (native libs + resources.arsc uncompressed)...")
UNCOMPRESSED_EXTENSIONS = ['.so', '.arsc']

with zipfile.ZipFile(unsigned_apk, 'w', zipfile.ZIP_STORED) as zipf:
    for root, dirs, files in os.walk(extract_dir):
        for file in files:
            file_path = os.path.join(root, file)
            arcname = os.path.relpath(file_path, extract_dir)
            
            # Store native libs and resources.arsc uncompressed
            is_native_lib = any(file.endswith(ext) for ext in ['.so']) or file == 'resources.arsc'
            compress_type = zipfile.ZIP_STORED if is_native_lib else zipfile.ZIP_DEFLATED
            
            zipf.write(file_path, arcname, compress_type=compress_type)

unsigned_size = os.path.getsize(unsigned_apk)
print(f"Unsigned APK: {unsigned_size/1024/1024:.2f} MB")

# Zipalign
aligned_apk = os.path.join(temp_dir, "aligned.apk")
print("Running zipalign...")
result = subprocess.run([zipalign, "-f", "4", unsigned_apk, aligned_apk], capture_output=True, text=True)
if result.returncode != 0:
    print(f"zipalign warning: {result.stderr}")
else:
    print("zipalign completed")

# Sign APK with apksigner
signed_apk = os.path.join(temp_dir, "signed.apk")
print("Signing APK with apksigner...")
result = subprocess.run([
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
    signed_size = os.path.getsize(signed_apk)
    shutil.copy2(signed_apk, out_apk)
    print(f"Output APK: {out_apk} ({signed_size/1024/1024:.2f} MB)")
else:
    print(f"apksigner error: {result.stderr}")
    shutil.copy2(aligned_apk, out_apk)
    print(f"Copied aligned APK: {out_apk}")

# Cleanup
shutil.rmtree(temp_dir)
print("Done!")
