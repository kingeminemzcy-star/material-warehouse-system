const categoryPrefixes: Record<string, string> = {
  STEEL: "ST",
  PLATE: "PL",
  CHAIN: "CH",
  MOTOR: "MO",
  FAN: "FA",
  SPRAY_GUN: "SG",
  FILTER: "FI",
  HARDWARE: "HW",
  CABLE: "CB",
  BEARING: "BR",
  CYLINDER: "CY",
  PAINT: "PA",
  OTHER: "OT"
};

function clean(value: string | null | undefined) {
  return (value || "NA")
    .trim()
    .toUpperCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^A-Z0-9.-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 28) || "NA";
}

export function extractDimension(source: string, names: string[]) {
  for (const name of names) {
    const match = source.match(new RegExp(`${name}\\s*[:：]?\\s*([0-9.]+)`, "i"));
    if (match?.[1]) return match[1];
  }
  return "";
}

export function buildMaterialCode(input: {
  category?: string;
  material?: string;
  spec?: string;
  dimensions?: string;
}) {
  const prefix = categoryPrefixes[input.category || ""] ?? categoryPrefixes.OTHER;
  const dimensions = input.dimensions || "";
  const thickness = extractDimension(`${input.spec || ""} ${dimensions}`, ["厚度", "厚", "T", "THK"]);
  const length = extractDimension(`${input.spec || ""} ${dimensions}`, ["长度", "长", "L"]);
  return [
    prefix,
    clean(input.material),
    clean(input.spec),
    thickness ? `T${clean(thickness)}` : "TNA",
    length ? `L${clean(length)}` : "LNA"
  ].join("-");
}

export function inferMaterialCategory(input: string) {
  if (/钢|槽钢|角钢|方管|圆管|矩形管/i.test(input)) return "STEEL";
  if (/板|钢板|板材/i.test(input)) return "PLATE";
  if (/链条/i.test(input)) return "CHAIN";
  if (/电机|马达/i.test(input)) return "MOTOR";
  if (/风机/i.test(input)) return "FAN";
  if (/喷枪/i.test(input)) return "SPRAY_GUN";
  if (/滤芯|过滤/i.test(input)) return "FILTER";
  if (/电缆|线缆/i.test(input)) return "CABLE";
  if (/轴承/i.test(input)) return "BEARING";
  if (/气缸/i.test(input)) return "CYLINDER";
  if (/油漆|涂料/i.test(input)) return "PAINT";
  if (/螺丝|螺栓|螺母|垫片|五金/i.test(input)) return "HARDWARE";
  return "OTHER";
}

export function normalizeMaterialKey(input: {
  name?: string;
  spec?: string;
  material?: string;
  unit?: string;
}) {
  return [input.name, input.spec, input.material, input.unit].map((item) => clean(item)).join("|");
}
