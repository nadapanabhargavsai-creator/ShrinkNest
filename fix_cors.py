import os

dir_path = r'c:\Users\nadap\OneDrive\Desktop\ShrinkNest\ShrinkNest'

for root, _, files in os.walk(dir_path):
    for file in files:
        if file.endswith('.html'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Add crossorigin to Google Fonts CSS
            content = content.replace(
                '<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">',
                '<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet" crossorigin="anonymous">'
            )
            
            # Add crossorigin to Font Awesome
            content = content.replace(
                '<link rel="stylesheet"\n        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">',
                '<link rel="stylesheet"\n        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" crossorigin="anonymous">'
            )
            
            # Add crossorigin to JS scripts
            content = content.replace(
                '<script src="https://cdn.jsdelivr.net/npm/browser-image-compression@2.0.2/dist/browser-image-compression.js"></script>',
                '<script src="https://cdn.jsdelivr.net/npm/browser-image-compression@2.0.2/dist/browser-image-compression.js" crossorigin="anonymous"></script>'
            )
            content = content.replace(
                '<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>',
                '<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js" crossorigin="anonymous"></script>'
            )
            content = content.replace(
                '<script src="https://unpkg.com/@ffmpeg/ffmpeg@0.12.7/dist/umd/ffmpeg.js"></script>',
                '<script src="https://unpkg.com/@ffmpeg/ffmpeg@0.12.7/dist/umd/ffmpeg.js" crossorigin="anonymous"></script>'
            )
            content = content.replace(
                '<script src="https://unpkg.com/@ffmpeg/util@0.12.1/dist/umd/index.js"></script>',
                '<script src="https://unpkg.com/@ffmpeg/util@0.12.1/dist/umd/index.js" crossorigin="anonymous"></script>'
            )

            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
