import json
import os
import struct
import sys


def main():
    path = sys.argv[1]
    with open(path, "rb") as f:
        data = f.read()

    magic, version, declared_length = struct.unpack_from("<III", data, 0)
    offset = 12
    gltf_json = None
    chunks = []

    while offset + 8 <= len(data):
        chunk_length, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        chunk = data[offset : offset + chunk_length]
        offset += chunk_length
        chunks.append((chunk_type, chunk_length))
        if chunk_type == 0x4E4F534A:
            gltf_json = json.loads(chunk.decode("utf-8").rstrip("\x00 \t\r\n"))

    if gltf_json is None:
        raise SystemExit("No JSON chunk found.")

    print(f"FILE={os.path.abspath(path)}")
    print(f"SIZE={len(data)}")
    print(f"HEADER={magic.to_bytes(4, 'little').decode('ascii')} v{version} declared={declared_length}")
    print("COUNTS=" + json.dumps({
        key: len(gltf_json.get(key, []))
        for key in ["nodes", "meshes", "materials", "textures", "images", "animations"]
    }, ensure_ascii=False))
    print("NODES=")
    for node in gltf_json.get("nodes", []):
        print(node.get("name", "<unnamed>"))


if __name__ == "__main__":
    main()
