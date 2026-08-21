import type {
  AbstractAvatarVariant,
  AvatarAccessory,
  AvatarEyes,
  AvatarFaceShape,
  AvatarGlasses,
  AvatarHair,
  AvatarHairColor,
  AvatarMouth,
  AvatarSkin,
  AvatarVariant,
  FaceAvatar,
} from "@/app/types";

export const ABSTRACT_AVATARS: AbstractAvatarVariant[] = ["crop", "wave", "cap", "bob", "spike", "curl", "bun", "leaf"];
export const AVATAR_SKINS: AvatarSkin[] = ["ivory", "cream", "apricot", "gold"];
export const AVATAR_FACE_SHAPES: AvatarFaceShape[] = ["round", "oval", "soft"];
const ALL_AVATAR_HAIRS: AvatarHair[] = ["short", "crop", "fringe", "bob", "wave", "curl", "center", "shag", "bun", "undercut", "long", "longWave", "ponytail", "braid", "halfUp", "twinTail"];
const ALL_AVATAR_EYES: AvatarEyes[] = ["dot", "smile", "wink", "calm", "bright", "crescent", "glance"];
const ALL_AVATAR_GLASSES: AvatarGlasses[] = ["none", "round", "oval", "square", "half"];
const ALL_AVATAR_MOUTHS: AvatarMouth[] = ["smile", "flat", "open", "grin", "pout", "tiny"];
const ALL_AVATAR_ACCESSORIES: AvatarAccessory[] = ["none", "dot", "star", "leaf", "flower", "clips", "heart", "moon", "sparkle"];

// The editor only exposes the parts represented in the approved reference
// sheet. Legacy values remain parseable below, but are not offered as new
// choices and are rendered through the same restrained SVG system.
export const AVATAR_HAIRS: AvatarHair[] = ALL_AVATAR_HAIRS;
export const AVATAR_HAIR_COLORS: AvatarHairColor[] = ["ink", "cocoa", "chestnut", "coral", "auburn", "blue", "mint", "plum"];
export const AVATAR_EYES: AvatarEyes[] = ALL_AVATAR_EYES;
export const AVATAR_GLASSES: AvatarGlasses[] = ALL_AVATAR_GLASSES;
export const AVATAR_MOUTHS: AvatarMouth[] = ALL_AVATAR_MOUTHS;

export type FaceConfig = {
  skin: AvatarSkin;
  shape: AvatarFaceShape;
  hair: AvatarHair;
  hairColor: AvatarHairColor;
  eyes: AvatarEyes;
  glasses: AvatarGlasses;
  mouth: AvatarMouth;
  accessory: AvatarAccessory;
};

export const DEFAULT_FACE_CONFIG: FaceConfig = {
  skin: "cream",
  shape: "round",
  hair: "short",
  hairColor: "ink",
  eyes: "dot",
  glasses: "none",
  mouth: "smile",
  accessory: "none",
};

// Randomisation deliberately draws from complete, reviewed combinations.
// Fully independent random parts produce many technically valid but visually
// awkward faces (heavy glasses + busy fringe + large badge, for example).
export const CURATED_FACE_PRESETS: FaceConfig[] = [
  { skin: "cream", shape: "round", hair: "short", hairColor: "ink", eyes: "dot", glasses: "none", mouth: "smile", accessory: "none" },
  { skin: "ivory", shape: "round", hair: "fringe", hairColor: "ink", eyes: "dot", glasses: "none", mouth: "open", accessory: "none" },
  { skin: "apricot", shape: "round", hair: "center", hairColor: "cocoa", eyes: "dot", glasses: "none", mouth: "smile", accessory: "none" },
  { skin: "cream", shape: "round", hair: "crop", hairColor: "ink", eyes: "dot", glasses: "round", mouth: "smile", accessory: "none" },
  { skin: "gold", shape: "round", hair: "bun", hairColor: "ink", eyes: "dot", glasses: "none", mouth: "open", accessory: "none" },
  { skin: "ivory", shape: "round", hair: "curl", hairColor: "cocoa", eyes: "dot", glasses: "none", mouth: "smile", accessory: "none" },
  { skin: "cream", shape: "round", hair: "wave", hairColor: "ink", eyes: "wink", glasses: "none", mouth: "smile", accessory: "none" },
  { skin: "cream", shape: "round", hair: "bob", hairColor: "blue", eyes: "dot", glasses: "none", mouth: "smile", accessory: "none" },
  { skin: "cream", shape: "round", hair: "longWave", hairColor: "cocoa", eyes: "crescent", glasses: "none", mouth: "smile", accessory: "none" },
  { skin: "apricot", shape: "round", hair: "ponytail", hairColor: "chestnut", eyes: "bright", glasses: "none", mouth: "open", accessory: "none" },
  { skin: "ivory", shape: "round", hair: "halfUp", hairColor: "ink", eyes: "dot", glasses: "oval", mouth: "smile", accessory: "none" },
  { skin: "gold", shape: "round", hair: "twinTail", hairColor: "auburn", eyes: "wink", glasses: "none", mouth: "tiny", accessory: "none" },
];

function stableHash(value: string): number {
  let result = 0;
  for (let index = 0; index < value.length; index++) result = (result * 31 + value.charCodeAt(index)) >>> 0;
  return result;
}

export function abstractAvatarFor(seed: string): AbstractAvatarVariant {
  return ABSTRACT_AVATARS[stableHash(seed) % ABSTRACT_AVATARS.length];
}

export function encodeFaceAvatar(config: FaceConfig): FaceAvatar {
  return ["custom2", config.skin, config.shape, config.hair, config.hairColor, config.eyes, config.glasses, config.mouth, "none"].join(":") as FaceAvatar;
}

export function parseFaceAvatar(value: string | null | undefined): FaceConfig | null {
  if (value?.startsWith("custom:")) {
    const [, skin, hair, glasses, mouth, accessory, ...extra] = value.split(":");
    if (extra.length > 0
      || !AVATAR_SKINS.includes(skin as AvatarSkin)
      || !["short", "bob", "wave", "bun"].includes(hair)
      || !["none", "round", "square"].includes(glasses)
      || !["smile", "flat", "open"].includes(mouth)
      || !["none", "dot", "star", "leaf"].includes(accessory)) return null;
    return {
      ...DEFAULT_FACE_CONFIG,
      skin: skin as AvatarSkin,
      hair: hair as AvatarHair,
      glasses: glasses as AvatarGlasses,
      mouth: mouth as AvatarMouth,
      accessory: accessory as AvatarAccessory,
    };
  }
  if (!value?.startsWith("custom2:")) return null;
  const [, skin, shape, hair, hairColor, eyes, glasses, mouth, accessory, ...extra] = value.split(":");
  if (extra.length > 0
    || !AVATAR_SKINS.includes(skin as AvatarSkin)
    || !AVATAR_FACE_SHAPES.includes(shape as AvatarFaceShape)
    || !ALL_AVATAR_HAIRS.includes(hair as AvatarHair)
    || !AVATAR_HAIR_COLORS.includes(hairColor as AvatarHairColor)
    || !ALL_AVATAR_EYES.includes(eyes as AvatarEyes)
    || !ALL_AVATAR_GLASSES.includes(glasses as AvatarGlasses)
    || !ALL_AVATAR_MOUTHS.includes(mouth as AvatarMouth)
    || !ALL_AVATAR_ACCESSORIES.includes(accessory as AvatarAccessory)) return null;
  return {
    skin: skin as AvatarSkin,
    shape: shape as AvatarFaceShape,
    hair: hair as AvatarHair,
    hairColor: hairColor as AvatarHairColor,
    eyes: eyes as AvatarEyes,
    glasses: glasses as AvatarGlasses,
    mouth: mouth as AvatarMouth,
    accessory: accessory as AvatarAccessory,
  };
}

export function isAvatarVariant(value: string | null | undefined): value is AvatarVariant {
  return Boolean(value && (ABSTRACT_AVATARS.includes(value as AbstractAvatarVariant) || parseFaceAvatar(value)));
}
