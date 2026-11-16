"""
Headless Blender 5.2 worker script for Phase 2 asset export.
Deterministic glTF 2.0 Binary export with strict version checks, studio-helper stripping,
optional armature-preserving LOD1 decimation, and zero local add-on dependencies (--factory-startup).
"""

import argparse
import json
import os
import sys
import bpy

PINNED_BLENDER_MAJOR_MINOR = (5, 2)


def parse_args():
    argv = sys.argv
    if "--" not in argv:
        raise RuntimeError("Expected '--' separator before script arguments")
    args_list = argv[argv.index("--") + 1 :]
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True, help="Output LOD0 GLB path")
    parser.add_argument("--lod1-out", default=None, help="Optional decimated LOD1 GLB path")
    parser.add_argument("--lod1-ratio", type=float, default=0.35, help="LOD1 decimate ratio")
    parser.add_argument("--strip-helpers", action="store_true", help="Remove cameras, lights, studio backdrops, and curves")
    parser.add_argument("--image-format", default="WEBP", choices=["AUTO", "JPEG", "WEBP", "NONE"])
    parser.add_argument("--draco", action="store_true", help="Enable Draco mesh compression")
    parser.add_argument("--allow-blender-mismatch", action="store_true")
    parser.add_argument("--meta-out", default=None, help="Optional JSON metadata sidecar path")
    return parser.parse_args(args_list)


def strip_non_runtime_objects():
    """Keep active visible runtime meshes + their Armatures/ancestors; remove cameras, lights, backdrops, curves, and hidden sculpt copies."""
    exact_helper_names = {"Camera", "Light", "Cube"}
    helper_prefixes = ("Reference portrait camera", "Large softbox", "Studio floor", "Front fill", "Hair rim")
    keep = set()

    for obj in bpy.data.objects:
        if obj.name in exact_helper_names or obj.name.startswith(helper_prefixes):
            continue
        if obj.type in {"CAMERA", "LIGHT", "FONT", "CURVE"}:
            continue
        if not obj.visible_get():
            continue
        keep.add(obj)
        if obj.type == "MESH":
            for mod in obj.modifiers:
                if mod.type == "ARMATURE" and getattr(mod, "object", None):
                    keep.add(mod.object)
        cur = obj.parent
        while cur is not None:
            if cur.type not in {"CAMERA", "LIGHT", "FONT", "CURVE"}:
                keep.add(cur)
            cur = cur.parent

    # Make kept armatures/ancestors unhidden so glTF exporter emits skins & animations reliably
    for obj in keep:
        try:
            obj.hide_viewport = False
            obj.hide_set(False)
        except Exception:
            pass

    for obj in list(bpy.data.objects):
        if obj not in keep:
            bpy.data.objects.remove(obj, do_unlink=True)

    # Remove actions belonging solely to stripped backup armatures (e.g. '.001' copies)
    referenced_actions = set()
    for obj in keep:
        ad = getattr(obj, "animation_data", None)
        if not ad:
            continue
        if ad.action:
            referenced_actions.add(ad.action)
        for track in getattr(ad, "nla_tracks", []):
            for strip in getattr(track, "strips", []):
                if strip.action:
                    referenced_actions.add(strip.action)

    # Keep actions matching kept base names (without '.001' clone suffixes) or referenced directly
    referenced_names = {a.name for a in referenced_actions}
    for action in list(bpy.data.actions):
        if referenced_actions and action not in referenced_actions and action.name.endswith(".001") and action.name[:-4] in referenced_names:
            bpy.data.actions.remove(action)

    try:
        bpy.ops.outliner.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)
    except Exception:
        pass


def export_glb(filepath, args):
    os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_image_format=args.image_format,
        export_image_quality=82,
        export_unused_images=False,
        export_unused_textures=False,
        export_cameras=False,
        export_lights=False,
        export_extras=False,
        export_animations=True,
        export_skins=True,
        export_optimize_animation_size=True,
        export_draco_mesh_compression_enable=bool(args.draco),
        export_draco_mesh_compression_level=6 if args.draco else 0,
    )


def apply_lod_decimate(ratio):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.data.objects:
        if obj.type != "MESH" or not obj.data or len(obj.data.polygons) < 40:
            continue
        mod = obj.modifiers.new(name="Phase2LODDecimate", type="DECIMATE")
        mod.decimate_type = "COLLAPSE"
        mod.ratio = max(0.1, min(0.95, ratio))
        mod.use_collapse_triangulate = True


def collect_scene_stats():
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    armatures = [o for o in bpy.data.objects if o.type == "ARMATURE"]
    tris = 0
    for m in meshes:
        if m.data:
            for p in m.data.polygons:
                tris += max(1, len(p.vertices) - 2)
    return {
        "blenderVersion": ".".join(str(x) for x in bpy.app.version),
        "meshCount": len(meshes),
        "armatureCount": len(armatures),
        "actions": len(bpy.data.actions),
        "estimatedTriangles": tris,
    }


def main():
    args = parse_args()
    ver = bpy.app.version[:2]
    if not args.allow_blender_mismatch and ver != PINNED_BLENDER_MAJOR_MINOR:
        sys.stderr.write(
            f"Blender version {bpy.app.version_string} does not match pinned {PINNED_BLENDER_MAJOR_MINOR[0]}.{PINNED_BLENDER_MAJOR_MINOR[1]}\n"
        )
        sys.exit(2)

    if args.strip_helpers:
        strip_non_runtime_objects()

    lod0_stats = collect_scene_stats()
    export_glb(args.out, args)

    lod1_stats = None
    if args.lod1_out:
        apply_lod_decimate(args.lod1_ratio)
        export_glb(args.lod1_out, args)
        lod1_stats = {
            "ratio": args.lod1_ratio,
            "path": os.path.abspath(args.lod1_out),
            "outBytes": os.path.getsize(args.lod1_out),
        }

    meta = {
        "out": os.path.abspath(args.out),
        "outBytes": os.path.getsize(args.out),
        "lod0": lod0_stats,
        "lod1": lod1_stats,
    }
    if args.meta_out:
        os.makedirs(os.path.dirname(os.path.abspath(args.meta_out)), exist_ok=True)
        with open(args.meta_out, "w", encoding="utf-8") as fh:
            json.dump(meta, fh, indent=2)
    print(json.dumps(meta))


if __name__ == "__main__":
    main()
