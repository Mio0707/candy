"""
Blender 拆件准备脚本。

用途：
1. 导入项目里的 `模型/葫芦狮-原件.glb`。
2. 把整体网格按“松散部件”分离成很多小对象。
3. 建好 9 个目标集合，方便人工把小对象归类。

使用方式：
在 Blender 中打开 Scripting 面板，把本脚本粘贴进去运行。
运行后会保存一个 `模型/葫芦狮-拆件工作台.blend`。
"""

import bpy
from pathlib import Path

PROJECT_DIR = Path(r"C:\Users\Administrator\Documents\糖塑")
INPUT_GLB = PROJECT_DIR / "模型" / "葫芦狮-原件.glb"
OUTPUT_BLEND = PROJECT_DIR / "模型" / "葫芦狮-拆件工作台.blend"

TARGET_PARTS = [
    ("base", "红色底座"),
    ("body_core", "黑色身体主体"),
    ("front_legs", "两只前脚"),
    ("back_legs", "两只后脚"),
    ("head", "头部、大眼、大嘴"),
    ("tail_ears", "尾巴、耳朵或飘带装饰"),
    ("back_mustache", "背部糖衣和胡子"),
    ("head_lines", "头部和嘴部糖条"),
    ("ball", "爪子下方圆球"),
]


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def ensure_collection(name):
    collection = bpy.data.collections.get(name)
    if collection is None:
        collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(collection)
    return collection


def move_to_collection(obj, target_collection):
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    target_collection.objects.link(obj)


def separate_loose_parts():
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("没有找到网格对象，请确认 glb 是否导入成功。")

    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()

    joined = bpy.context.view_layer.objects.active
    joined.name = "source_joined_for_loose_split"

    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.separate(type="LOOSE")
    bpy.ops.object.mode_set(mode="OBJECT")

    loose_parts = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    loose_parts.sort(key=lambda obj: obj.name)
    for index, obj in enumerate(loose_parts, start=1):
        obj.name = f"loose_{index:03d}"
        obj.data.name = f"loose_{index:03d}_mesh"
        obj.show_name = True
        obj.color = (1.0, 0.82, 0.32, 1.0)

    return loose_parts


def add_part_labels():
    for index, (part_name, description) in enumerate(TARGET_PARTS):
        bpy.ops.object.text_add(location=(-1.4, 1.2 - index * 0.16, 0))
        text = bpy.context.object
        text.name = f"label_{part_name}"
        text.data.body = f"{part_name} - {description}"
        text.data.align_x = "LEFT"
        text.data.size = 0.055
        text.rotation_euler[0] = 1.2


def main():
    if not INPUT_GLB.exists():
        raise FileNotFoundError(f"找不到模型文件：{INPUT_GLB}")

    reset_scene()
    bpy.ops.import_scene.gltf(filepath=str(INPUT_GLB))

    loose_parts = separate_loose_parts()

    waiting_collection = ensure_collection("00_待分配_loose_parts")
    for obj in loose_parts:
        move_to_collection(obj, waiting_collection)

    for part_name, description in TARGET_PARTS:
        ensure_collection(f"PART_{part_name}__{description}")

    add_part_labels()

    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_BLEND))
    print(f"已生成拆件工作台：{OUTPUT_BLEND}")
    print(f"松散部件数量：{len(loose_parts)}")
    print("下一步：把 loose_xxx 小对象拖到对应 PART_ 集合里，再按集合合并成 9 个对象。")


if __name__ == "__main__":
    main()
