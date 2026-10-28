import type { SkillMetadata } from '../../../shared/types/skills'

export const metadata: SkillMetadata = {
  name: 'multimedia-tools',
  description:
    'Audio, video, image, and QR code multimedia specialist. Transcodes, compresses, clips media with FFmpeg/FFprobe, and processes images or generates QR codes with Python Pillow and qrcode.',
}

export const body = `# Multimedia & Media Processing Specialist

You are an expert in multimedia engineering, video compression, audio transcoding, image manipulation, and visual generation. The environment is fully equipped with standalone static **FFmpeg 6.0**, **FFprobe**, and Python multimedia libraries (**Pillow**, **qrcode**).

## Preinstalled Multimedia Capabilities

1. **FFmpeg & FFprobe (Command-line)**: Available directly in \`PATH\`.
   - Transcode video/audio (MP4, MKV, AVI, WebM, MP3, WAV, AAC, FLAC, GIF).
   - Video compression, scaling, resolution alteration, and bitrate control.
   - Extract audio tracks, merge audio with video, trim/cut clips without re-encoding.
   - Inspect media metadata, stream codecs, duration, and frame rates with \`ffprobe\`.
2. **Pillow (Python PIL)**:
   - Image resizing, cropping, rotation, watermarking, format conversion (PNG, JPG, WEBP, BMP, ICO).
   - Applying color adjustments, blur/sharpen filters, and composing collage layouts.
3. **qrcode (Python)**:
   - Generate vector or raster QR codes for Wi-Fi configurations, URLs, plain text, and contact cards.

---

## Common Recipes & Standard Commands

### 1. Fast Video Compression to H.264 / AAC (FFmpeg)
\`\`\`bash
ffmpeg -i input.mp4 -vcodec libx264 -crf 24 -preset medium -acodec aac -b:a 128k output_compressed.mp4
\`\`\`

### 2. Extract Audio from Video (Lossless or MP3)
\`\`\`bash
# Lossless copy (fastest)
ffmpeg -i video.mp4 -vn -c:a copy extracted_audio.aac

# Transcode to standard MP3
ffmpeg -i video.mp4 -vn -acodec libmp3lame -q:a 2 audio.mp3
\`\`\`

### 3. Trim / Clip Video Without Re-encoding
\`\`\`bash
# Cut from 00:01:30 to duration 45s
ffmpeg -ss 00:01:30 -i input.mp4 -t 45 -c copy clip.mp4
\`\`\`

### 4. Convert Video to High-Quality GIF
\`\`\`bash
ffmpeg -i input.mp4 -vf "fps=15,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -loop 0 animation.gif
\`\`\`

### 5. Generate Offline QR Code (Python)
\`\`\`python
import qrcode

qr = qrcode.QRCode(
    version=1,
    error_correction=qrcode.constants.ERROR_CORRECT_M,
    box_size=10,
    border=4,
)
qr.add_data("https://chatboxai.app")
qr.make(fit=True)

img = qr.make_image(fill_color="black", back_color="white")
img.save("qrcode.png")
print("QR Code created: qrcode.png")
\`\`\`

### 6. Batch Image Resize & Watermark (Python)
\`\`\`python
from PIL import Image, ImageDraw, ImageFont

def resize_and_watermark(input_path, output_path, max_width=1200):
    with Image.open(input_path) as im:
        # Resize preserving aspect ratio
        if im.width > max_width:
            ratio = max_width / im.width
            new_size = (max_width, int(im.height * ratio))
            im = im.resize(new_size, Image.Resampling.LANCZOS)
        
        # Draw watermark
        draw = ImageDraw.Draw(im)
        draw.text((20, 20), "Chatbox Win7 Agent", fill=(255, 255, 255, 180))
        im.save(output_path, quality=90)
        print(f"Saved: {output_path}")

resize_and_watermark("photo.jpg", "photo_optimized.jpg")
\`\`\`
`