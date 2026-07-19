import zipfile

apk = r'F:\luxewash_real\android\app\build\outputs\apk\release\app-release.apk'
with zipfile.ZipFile(apk) as z:
    data = z.read('res/S7.png')
    # Save to inspect
    with open('F:\luxewash_real\splash-inspect.png', 'wb') as f:
        f.write(data)
    print(f'Saved res/S7.png: {len(data)} bytes')

    # Check other medium size pngs
    for name in z.namelist():
        if name.endswith('.png') or name.endswith('.webp'):
            info = z.getinfo(name)
            if 5000 < info.file_size < 20000 and name.startswith('res/'):
                # Possible splash or icon
                print(f'  Candidate: {name}: {info.file_size} bytes')