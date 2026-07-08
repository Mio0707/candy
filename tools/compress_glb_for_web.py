import argparse
import os
import sys

import bpy


def count_triangles():
    total = 0
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        for poly in obj.data.polygons:
            total += max(1, len(poly.vertices) - 2)
    return total


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--ratio", type=float, default=0.25)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])

    input_path = os.path.abspath(args.input)
    output_path = os.path.abspath(args.output)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()

    bpy.ops.import_scene.gltf(filepath=input_path)

    before = count_triangles()
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]

    for obj in mesh_objects:
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        modifier = obj.modifiers.new("web_decimate", "DECIMATE")
        modifier.ratio = args.ratio
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.select_set(False)

        obj.data.update()
        obj.data.validate(clean_customdata=False)

    after = count_triangles()

    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format="GLB",
        export_apply=False,
        export_animations=False,
        export_lights=False,
        export_cameras=False,
        export_yup=True,
    )

    print(f"INPUT={input_path}")
    print(f"OUTPUT={output_path}")
    print(f"OBJECTS={len(mesh_objects)}")
    print(f"TRIANGLES_BEFORE={before}")
    print(f"TRIANGLES_AFTER={after}")


if __name__ == "__main__":
    main()
