"""
Blender 拆件检查脚本。

用途：
检查场景中是否存在网页需要的 9 个对象名。
如果通过，可以手动 File > Export > glTF 2.0 导出 glb。
"""

import bpy

REQUIRED_PARTS = [
    "base",
    "body_core",
    "front_legs",
    "back_legs",
    "head",
    "tail_ears",
    "back_mustache",
    "head_lines",
    "ball",
]


def main():
    existing = {obj.name for obj in bpy.context.scene.objects if obj.type == "MESH"}
    missing = [name for name in REQUIRED_PARTS if name not in existing]

    if missing:
        print("还缺这些对象：")
        for name in missing:
            print(f"- {name}")
        raise RuntimeError("拆件命名未完成。")

    print("拆件命名检查通过。")
    print("需要的 9 个对象都存在：")
    for name in REQUIRED_PARTS:
        obj = bpy.data.objects[name]
        print(f"- {name}: {len(obj.data.polygons)} faces")


if __name__ == "__main__":
    main()
