from PIL import Image
import os

def make_transparent(path):
    if not os.path.exists(path):
        print(f"File not found: {path}")
        return

    img = Image.open(path)
    img = img.convert("RGBA")
    datas = img.getdata()

    newData = []
    for item in datas:
        # If the pixel is white (or close to white), make it transparent
        if item[0] > 200 and item[1] > 200 and item[2] > 200:
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)

    img.putdata(newData)
    img.save(path, "PNG")
    print(f"Processed {path}")

make_transparent(r"D:\Intern\work\Chemical-PFD-Web-Desktop\desktop-frontend\ui\res\sun.png")
make_transparent(r"D:\Intern\work\Chemical-PFD-Web-Desktop\desktop-frontend\ui\res\moon.png")
