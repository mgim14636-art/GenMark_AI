from PIL import Image
import io

def resize_image(image_bytes: bytes, target_size=(512, 512)) -> bytes:
    image = Image.open(io.BytesIO(image_bytes))
    image = image.resize(target_size, Image.Resampling.LANCZOS)
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()
