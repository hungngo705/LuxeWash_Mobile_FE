import zipfile

cur = r'F:\Study\Do An\Git\LuxeWash_Mobile_FE\android\app\build\outputs\apk\release\app-release.apk'
with zipfile.ZipFile(cur) as z:
    files = [n for n in z.namelist() if n.startswith('res/') and n.endswith('.xml')]
    print(f'Total res .xml in current: {len(files)}')
    res_files = z.namelist()
    hq_in = 'res/hq.xml' in res_files
    hq_orig = 'res/Hq.xml' in res_files
    print(f'hq.xml exists: {hq_in}')
    print(f'Hq.xml exists: {hq_orig}')
    bw = 'res/BW.xml'
    print(f'BW.xml (app icon) exists: {bw in res_files}')

# Compare with source
src = r'F:\luxewash_real\android\app\build\outputs\apk\release\app-release.apk'
with zipfile.ZipFile(src) as z:
    files = [n for n in z.namelist() if n.startswith('res/') and n.endswith('.xml')]
    print(f'\nSource total res .xml: {len(files)}')
    res_files = z.namelist()
    hq_in = 'res/hq.xml' in res_files
    hq_orig = 'res/Hq.xml' in res_files
    print(f'hq.xml exists: {hq_in}')
    print(f'Hq.xml exists: {hq_orig}')
    bw = 'res/BW.xml'
    print(f'BW.xml (app icon) exists: {bw in res_files}')