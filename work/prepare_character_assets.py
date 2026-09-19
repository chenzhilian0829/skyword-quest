from pathlib import Path
from PIL import Image

SOURCE = Path(r"C:\Users\Administrator\Desktop\新建文件夹 (2)")
OUTPUT = Path(__file__).resolve().parents[1] / "public" / "assets" / "characters"

files = [SOURCE / "生成我的世界角色图片.png"]
files.extend(SOURCE / f"生成我的世界角色图片 ({index}).png" for index in range(1, 15))

OUTPUT.mkdir(parents=True, exist_ok=True)

for index, source in enumerate(files, start=1):
    with Image.open(source) as image:
        image = image.convert("RGB")
        image.thumbnail((640, 640), Image.Resampling.LANCZOS)
        destination = OUTPUT / f"character-{index:02d}.webp"
        image.save(destination, "WEBP", quality=84, method=6)
        print(f"{source.name} -> {destination.name} {image.size}")
